import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { AddCartItemDto } from './dto/add-cart-item.dto';
import { MergeCartDto } from './dto/merge-cart.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';
import {
  CartApiResponseDto,
  CartItemResponseDto,
  CartResponseDto,
} from './dto/cart-response.dto';

// Full cart shape returned from Prisma (with relations)
type CartWithRelations = Prisma.CartGetPayload<{
  include: {
    cartItems: {
      include: {
        product: {
          select: {
            id: true;
            name: true;
            sku: true;
            price: true;
            imageUrl: true;
            isActive: true;
          };
        };
      };
    };
  };
}>;

// Reusable include block for all cart queries
const CART_INCLUDE = {
  cartItems: {
    include: {
      product: {
        select: {
          id: true,
          name: true,
          sku: true,
          price: true,
          imageUrl: true,
          isActive: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' as const },
  },
} satisfies Prisma.CartInclude;

@Injectable()
export class CartsService {
  constructor(private readonly prismaService: PrismaService) {}

  // ─── Get or create active cart ────────────────────────────────────────────
  // Returns the user's first non-checked-out cart, or creates one if none exists.
  async getOrCreateActiveCart(
    userId: string,
  ): Promise<CartApiResponseDto<CartResponseDto>> {
    const cart = await this.findOrCreateActiveCart(userId);
    return this.response(this.formatCart(cart), 'Cart retrieved successfully');
  }

  // ─── Add item to cart ─────────────────────────────────────────────────────
  // Flow:
  //  1. Get or create active cart.
  //  2. Validate product: exists, active, sufficient stock.
  //  3. If item already in cart → increment quantity; else create new CartItem.
  async addItem(
    userId: string,
    addCartItemDto: AddCartItemDto,
  ): Promise<CartApiResponseDto<CartResponseDto>> {
    const { productId, quantity } = addCartItemDto;

    const [cart, product] = await Promise.all([
      this.findOrCreateActiveCart(userId),
      this.prismaService.product.findUnique({ where: { id: productId } }),
    ]);

    if (!product) {
      throw new NotFoundException(`Product with ID "${productId}" not found`);
    }
    if (!product.isActive) {
      throw new BadRequestException(
        `Product "${product.name}" is currently unavailable`,
      );
    }
    if (product.stock < quantity) {
      throw new BadRequestException(
        `Insufficient stock for "${product.name}". Available: ${product.stock}, requested: ${quantity}`,
      );
    }

    const existingItem = cart.cartItems.find((i) => i.productId === productId);

    if (existingItem) {
      const newQty = existingItem.quantity + quantity;
      if (product.stock < newQty) {
        throw new BadRequestException(
          `Insufficient stock for "${product.name}". Available: ${product.stock}, already in cart: ${existingItem.quantity}`,
        );
      }
      await this.prismaService.cartItem.update({
        where: { id: existingItem.id },
        data: { quantity: newQty },
      });
    } else {
      await this.prismaService.cartItem.create({
        data: { cartId: cart.id, productId, quantity },
      });
    }

    const updatedCart = await this.prismaService.cart.findUniqueOrThrow({
      where: { id: cart.id },
      include: CART_INCLUDE,
    });

    return this.response(this.formatCart(updatedCart), 'Item added to cart');
  }

  // ─── Update cart item quantity ────────────────────────────────────────────
  async updateItem(
    userId: string,
    itemId: string,
    updateCartItemDto: UpdateCartItemDto,
  ): Promise<CartApiResponseDto<CartResponseDto>> {
    const { quantity } = updateCartItemDto;

    const cartItem = await this.prismaService.cartItem.findUnique({
      where: { id: itemId },
      include: {
        cart: true,
        product: true,
      },
    });

    if (!cartItem) throw new NotFoundException('Cart item not found');
    if (cartItem.cart.userId !== userId) {
      throw new NotFoundException('Cart item not found');
    }
    if (cartItem.cart.checkedOut) {
      throw new BadRequestException('Cannot modify a checked-out cart');
    }
    if (cartItem.product.stock < quantity) {
      throw new BadRequestException(
        `Insufficient stock for "${cartItem.product.name}". Available: ${cartItem.product.stock}`,
      );
    }

    await this.prismaService.cartItem.update({
      where: { id: itemId },
      data: { quantity },
    });

    const updatedCart = await this.prismaService.cart.findUniqueOrThrow({
      where: { id: cartItem.cartId },
      include: CART_INCLUDE,
    });

    return this.response(
      this.formatCart(updatedCart),
      'Cart item updated successfully',
    );
  }

  // ─── Remove item from cart ────────────────────────────────────────────────
  async removeItem(
    userId: string,
    itemId: string,
  ): Promise<CartApiResponseDto<CartResponseDto>> {
    const cartItem = await this.prismaService.cartItem.findUnique({
      where: { id: itemId },
      include: { cart: true },
    });

    if (!cartItem) throw new NotFoundException('Cart item not found');
    if (cartItem.cart.userId !== userId) {
      throw new NotFoundException('Cart item not found');
    }
    if (cartItem.cart.checkedOut) {
      throw new BadRequestException('Cannot modify a checked-out cart');
    }

    await this.prismaService.cartItem.delete({ where: { id: itemId } });

    const updatedCart = await this.prismaService.cart.findUniqueOrThrow({
      where: { id: cartItem.cartId },
      include: CART_INCLUDE,
    });

    return this.response(
      this.formatCart(updatedCart),
      'Item removed from cart',
    );
  }

  // ─── Clear cart ───────────────────────────────────────────────────────────
  // Removes all items from the active cart (cart record itself is kept).
  async clearCart(
    userId: string,
  ): Promise<CartApiResponseDto<CartResponseDto>> {
    const cart = await this.findOrCreateActiveCart(userId);

    await this.prismaService.cartItem.deleteMany({
      where: { cartId: cart.id },
    });

    const clearedCart = await this.prismaService.cart.findUniqueOrThrow({
      where: { id: cart.id },
      include: CART_INCLUDE,
    });

    return this.response(this.formatCart(clearedCart), 'Cart cleared');
  }

  // ─── Merge guest cart into active cart ───────────────────────────────────
  // Used when an unauthenticated user logs in and their local cart needs
  // to be merged with their server-side cart.
  // Rules:
  //  - If the product is already in the cart → add quantities (capped by stock).
  //  - If not → create a new CartItem (if product is valid and in stock).
  //  - Invalid / inactive / out-of-stock items are silently skipped.
  async mergeGuestCart(
    userId: string,
    mergeCartDto: MergeCartDto,
  ): Promise<CartApiResponseDto<CartResponseDto>> {
    const { items } = mergeCartDto;

    const [cart, productIds] = [
      await this.findOrCreateActiveCart(userId),
      [...new Set(items.map((i) => i.productId))],
    ];

    const products = await this.prismaService.product.findMany({
      where: { id: { in: productIds }, isActive: true },
    });
    const productMap = new Map(products.map((p) => [p.id, p]));

    // Build existing cart items map for fast lookup
    const existingMap = new Map(cart.cartItems.map((i) => [i.productId, i]));

    await this.prismaService.$transaction(async (tx) => {
      for (const item of items) {
        const product = productMap.get(item.productId);
        if (!product || product.stock <= 0) continue;

        const existing = existingMap.get(item.productId);

        if (existing) {
          const merged = Math.min(
            existing.quantity + item.quantity,
            product.stock,
          );
          await tx.cartItem.update({
            where: { id: existing.id },
            data: { quantity: merged },
          });
        } else {
          const qty = Math.min(item.quantity, product.stock);
          await tx.cartItem.create({
            data: {
              cartId: cart.id,
              productId: item.productId,
              quantity: qty,
            },
          });
        }
      }
    });

    const mergedCart = await this.prismaService.cart.findUniqueOrThrow({
      where: { id: cart.id },
      include: CART_INCLUDE,
    });

    return this.response(
      this.formatCart(mergedCart),
      'Guest cart merged successfully',
    );
  }

  // ─── Private: Get or create active (non-checked-out) cart ────────────────
  private async findOrCreateActiveCart(
    userId: string,
  ): Promise<CartWithRelations> {
    const existing = await this.prismaService.cart.findFirst({
      where: { userId, checkedOut: false },
      include: CART_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });

    if (existing) return existing;

    return this.prismaService.cart.create({
      data: { userId },
      include: CART_INCLUDE,
    });
  }

  // ─── Private: Format cart ─────────────────────────────────────────────────
  private formatCart(cart: CartWithRelations): CartResponseDto {
    // Accumulate totalAmount in Decimal to avoid float drift
    const totalAmountDecimal = cart.cartItems.reduce(
      (sum, item) =>
        item.product
          ? sum.add(new Prisma.Decimal(item.product.price).mul(item.quantity))
          : sum,
      new Prisma.Decimal(0),
    );

    const cartItems: CartItemResponseDto[] = cart.cartItems.map((item) => ({
      id: item.id,
      quantity: item.quantity,
      productId: item.productId,
      product: item.product
        ? {
            id: item.product.id,
            name: item.product.name,
            sku: item.product.sku,
            price: Number(item.product.price),
            imageUrl: item.product.imageUrl,
            isActive: item.product.isActive,
          }
        : null,
      // Multiply in Decimal, convert to Number only at the boundary
      subtotal: item.product
        ? Number(new Prisma.Decimal(item.product.price).mul(item.quantity))
        : 0,
    }));

    const totalItems = cartItems.reduce((sum, i) => sum + i.quantity, 0);

    return {
      id: cart.id,
      userId: cart.userId,
      checkedOut: cart.checkedOut,
      cartItems,
      totalAmount: Number(totalAmountDecimal),
      totalItems,
      createdAt: cart.createdAt,
      updatedAt: cart.updatedAt,
    };
  }

  // ─── Private: Wrap in response envelope ──────────────────────────────────
  private response<T>(data: T, message: string): CartApiResponseDto<T> {
    return { success: true, message, data };
  }
}
