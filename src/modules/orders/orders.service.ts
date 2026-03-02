import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import {
  OrderApiResponseDto,
  OrderResponseDto,
} from './dto/order-response.dto';
import { QueryOrderDto } from './dto/query-order.dto';
import { OrderStatus, Prisma, Role } from '@prisma/client';

// Full order shape returned from Prisma (with relations)
type OrderWithRelations = Prisma.OrderGetPayload<{
  include: {
    user: {
      select: { id: true; email: true; firstName: true; lastName: true };
    };
    orderItems: {
      include: {
        product: {
          select: { id: true; name: true; sku: true; imageUrl: true };
        };
      };
    };
  };
}>;

@Injectable()
export class OrdersService {
  constructor(private prismaService: PrismaService) {}

  // ─── Create order ────────────────────────────────────────────────────────────
  // Flow:
  //  1. Validate each product – must exist, be active and have enough stock.
  //  2. Lock price at current product.price (immutable snapshot).
  //  3. Calculate totalAmount = Σ (price × quantity).
  //  4. Inside a single DB transaction:
  //     a. Create the Order record.
  //     b. Create all OrderItem records.
  //     c. Decrement stock for every product atomically.
  //  5. Return the fully-populated order.
  async create(
    userId: string,
    createOrderDto: CreateOrderDto,
  ): Promise<OrderApiResponseDto<OrderResponseDto>> {
    const { items, shippingAddress, cartId } = createOrderDto;

    // 1 & 2 – fetch products and validate in parallel
    const productIds = [...new Set(items.map((i) => i.productId))];
    const products = await this.prismaService.product.findMany({
      where: { id: { in: productIds } },
    });

    const productMap = new Map(products.map((p) => [p.id, p]));

    for (const item of items) {
      const product = productMap.get(item.productId);

      if (!product) {
        throw new NotFoundException(
          `Product with ID "${item.productId}" not found`,
        );
      }
      if (!product.isActive) {
        throw new BadRequestException(
          `Product "${product.name}" is currently unavailable`,
        );
      }
      if (product.stock < item.quantity) {
        throw new BadRequestException(
          `Insufficient stock for "${product.name}". Available: ${product.stock}, requested: ${item.quantity}`,
        );
      }
    }

    // 3 – calculate total (use Decimal to avoid float drift)
    const totalAmount = items.reduce((sum, item) => {
      const price = productMap.get(item.productId)!.price;
      return sum.add(new Prisma.Decimal(price).mul(item.quantity));
    }, new Prisma.Decimal(0));

    // 4 – atomic transaction
    const order = await this.prismaService.$transaction(async (tx) => {
      // 4a – create order
      const newOrder = await tx.order.create({
        data: {
          status: OrderStatus.PENDING,
          totalAmount,
          userId,
          shippingAddress,
          cartId,
          orderItems: {
            create: items.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              price: productMap.get(item.productId)!.price, // locked price
            })),
          },
        },
        include: {
          user: {
            select: { id: true, email: true, firstName: true, lastName: true },
          },
          orderItems: {
            include: {
              product: {
                select: { id: true, name: true, sku: true, imageUrl: true },
              },
            },
          },
        },
      });

      // 4c – decrement stock for each product
      await Promise.all(
        items.map((item) =>
          tx.product.update({
            where: { id: item.productId },
            data: { stock: { decrement: item.quantity } },
          }),
        ),
      );

      return newOrder;
    });

    return this.response(this.formatOrder(order), 'Order created successfully');
  }

  // ─── Get all orders (Admin) ───────────────────────────────────────────────
  // Admin can filter by status, userId or search by orderNumber with pagination.
  async findAllAdmin(
    queryDto: QueryOrderDto,
  ): Promise<OrderApiResponseDto<OrderResponseDto[]>> {
    const { status, userId, search, page = 1, limit = 10 } = queryDto;

    const where: Prisma.OrderWhereInput = {};

    if (status) where.status = status;
    if (userId) where.userId = userId;
    if (search) where.orderNumber = { contains: search, mode: 'insensitive' };

    const [total, orders] = await Promise.all([
      this.prismaService.order.count({ where }),
      this.prismaService.order.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: { id: true, email: true, firstName: true, lastName: true },
          },
          orderItems: {
            include: {
              product: {
                select: { id: true, name: true, sku: true, imageUrl: true },
              },
            },
          },
        },
      }),
    ]);

    return this.response(
      orders.map((o) => this.formatOrder(o)),
      'Orders retrieved successfully',
      { total, page, limit, totalPages: Math.ceil(total / limit) },
    );
  }

  // ─── Get current user's orders ───────────────────────────────────────────
  // Scoped to the authenticated user. Optional status filter + pagination.
  async findMyOrders(
    userId: string,
    queryDto: QueryOrderDto,
  ): Promise<OrderApiResponseDto<OrderResponseDto[]>> {
    const { status, search, page = 1, limit = 10 } = queryDto;

    const where: Prisma.OrderWhereInput = { userId };

    if (status) where.status = status;
    if (search) where.orderNumber = { contains: search, mode: 'insensitive' };

    const [total, orders] = await Promise.all([
      this.prismaService.order.count({ where }),
      this.prismaService.order.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: { id: true, email: true, firstName: true, lastName: true },
          },
          orderItems: {
            include: {
              product: {
                select: { id: true, name: true, sku: true, imageUrl: true },
              },
            },
          },
        },
      }),
    ]);

    return this.response(
      orders.map((o) => this.formatOrder(o)),
      'Orders retrieved successfully',
      { total, page, limit, totalPages: Math.ceil(total / limit) },
    );
  }

  // ─── Find order by ID ─────────────────────────────────────────────────────
  // Admin sees any order; a regular user can only see their own.
  async findOne(
    id: string,
    userId: string,
    role: Role,
  ): Promise<OrderApiResponseDto<OrderResponseDto>> {
    const order = await this.prismaService.order.findUnique({
      where: { id },
      include: {
        user: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
        orderItems: {
          include: {
            product: {
              select: { id: true, name: true, sku: true, imageUrl: true },
            },
          },
        },
      },
    });

    if (!order) throw new NotFoundException('Order not found');

    if (role !== Role.ADMIN && order.userId !== userId) {
      throw new ForbiddenException('You do not have access to this order');
    }

    return this.response(
      this.formatOrder(order),
      'Order retrieved successfully',
    );
  }

  // ─── Update order ─────────────────────────────────────────────────────────
  // Rules:
  //  • Admin  → can change status freely (any transition).
  //  • User   → can only update shippingAddress while status is PENDING.
  //  • No one can edit a CANCELLED or DELIVERED order.
  async update(
    id: string,
    updateOrderDto: UpdateOrderDto,
    userId: string,
    role: Role,
  ): Promise<OrderApiResponseDto<OrderResponseDto>> {
    const order = await this.prismaService.order.findUnique({ where: { id } });

    if (!order) throw new NotFoundException('Order not found');

    if (role !== Role.ADMIN && order.userId !== userId) {
      throw new ForbiddenException('You do not have access to this order');
    }

    // Immutable terminal states
    if (
      order.status === OrderStatus.CANCELLED ||
      order.status === OrderStatus.DELIVERED
    ) {
      throw new BadRequestException(
        `Cannot modify an order with status "${order.status}"`,
      );
    }

    if (role !== Role.ADMIN) {
      // Regular user – only shippingAddress allowed, and only while PENDING
      if (updateOrderDto.status) {
        throw new ForbiddenException('Only admins can change order status');
      }
      if (order.status !== OrderStatus.PENDING) {
        throw new BadRequestException(
          "You can only update a PENDING order's shipping address",
        );
      }
    }

    const updatedOrder = await this.prismaService.order.update({
      where: { id },
      data: updateOrderDto,
      include: {
        user: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
        orderItems: {
          include: {
            product: {
              select: { id: true, name: true, sku: true, imageUrl: true },
            },
          },
        },
      },
    });

    return this.response(
      this.formatOrder(updatedOrder),
      'Order updated successfully',
    );
  }

  // ─── Cancel order ─────────────────────────────────────────────────────────
  // Flow:
  //  1. Only orders in PENDING or PROCESSING can be cancelled.
  //  2. Admin can cancel any user's order; user can only cancel their own.
  //  3. Inside a transaction:
  //     a. Set status to CANCELLED.
  //     b. Restore stock for every order item (compensating write).
  async cancel(
    id: string,
    userId: string,
    role: Role,
  ): Promise<OrderApiResponseDto<OrderResponseDto>> {
    const order = await this.prismaService.order.findUnique({
      where: { id },
      include: { orderItems: true },
    });

    if (!order) throw new NotFoundException('Order not found');

    if (role !== Role.ADMIN && order.userId !== userId) {
      throw new ForbiddenException('You do not have access to this order');
    }

    const cancellableStatuses: OrderStatus[] = [
      OrderStatus.PENDING,
      OrderStatus.PROCESSING,
    ];

    if (!cancellableStatuses.includes(order.status)) {
      throw new BadRequestException(
        `Cannot cancel an order with status "${order.status}"`,
      );
    }

    const cancelledOrder = await this.prismaService.$transaction(async (tx) => {
      // a – mark as cancelled
      const updated = await tx.order.update({
        where: { id },
        data: { status: OrderStatus.CANCELLED },
        include: {
          user: {
            select: { id: true, email: true, firstName: true, lastName: true },
          },
          orderItems: {
            include: {
              product: {
                select: { id: true, name: true, sku: true, imageUrl: true },
              },
            },
          },
        },
      });

      // b – restore stock
      await Promise.all(
        order.orderItems.map((item) =>
          tx.product.update({
            where: { id: item.productId },
            data: { stock: { increment: item.quantity } },
          }),
        ),
      );

      return updated;
    });

    return this.response(
      this.formatOrder(cancelledOrder),
      'Order cancelled successfully',
    );
  }

  //wrap

  private response<T>(
    data: T,
    message: string,
    meta?: Record<string, unknown>,
  ): OrderApiResponseDto<T> {
    return { success: true, message, data, ...(meta && { meta }) };
  }

  // ─── Private helper ───────────────────────────────────────────────────────
  private formatOrder(order: OrderWithRelations): OrderResponseDto {
    return {
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      totalAmount: Number(order.totalAmount),
      userId: order.userId,
      user: order.user ?? null,
      shippingAddress: order.shippingAddress,
      orderItems: order.orderItems.map((item) => ({
        id: item.id,
        quantity: item.quantity,
        price: Number(item.price),
        productId: item.productId,
        product: item.product ?? null,
        subtotal: Number(new Prisma.Decimal(item.price).mul(item.quantity)),
      })),
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    };
  }
}
