import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { GetUser } from 'src/common/decorators/get-user.decorator';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { AddCartItemDto } from './dto/add-cart-item.dto';
import { CartResponseDto } from './dto/cart-response.dto';
import { MergeCartDto } from './dto/merge-cart.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';
import { CartsService } from './carts.service';

@ApiTags('Carts')
@Controller('carts')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class CartsController {
  constructor(private readonly cartsService: CartsService) {}

  // ── Get or create active cart ──────────────────────────────────────────────
  @Get('me')
  @ApiOperation({
    summary: "Get or create the current user's active cart",
  })
  @ApiResponse({
    status: 200,
    description: 'Active cart returned.',
    type: CartResponseDto,
  })
  async getMyCart(@GetUser('id') userId: string) {
    return this.cartsService.getOrCreateActiveCart(userId);
  }

  // ── Add item to cart ──────────────────────────────────────────────────────
  @Post('me/items')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Add a product to the active cart' })
  @ApiBody({ type: AddCartItemDto })
  @ApiResponse({
    status: 200,
    description: 'Item added; updated cart returned.',
    type: CartResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Insufficient stock or inactive product.',
  })
  @ApiResponse({ status: 404, description: 'Product not found.' })
  async addItem(
    @GetUser('id') userId: string,
    @Body() addCartItemDto: AddCartItemDto,
  ) {
    return this.cartsService.addItem(userId, addCartItemDto);
  }

  // ── Update cart item quantity ─────────────────────────────────────────────
  @Patch('me/items/:itemId')
  @ApiOperation({ summary: 'Update the quantity of a cart item' })
  @ApiBody({ type: UpdateCartItemDto })
  @ApiResponse({
    status: 200,
    description: 'Item updated; updated cart returned.',
    type: CartResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Insufficient stock or cart checked out.',
  })
  @ApiResponse({ status: 404, description: 'Cart item not found.' })
  async updateItem(
    @GetUser('id') userId: string,
    @Param('itemId') itemId: string,
    @Body() updateCartItemDto: UpdateCartItemDto,
  ) {
    return this.cartsService.updateItem(userId, itemId, updateCartItemDto);
  }

  // ── Remove item from cart ───────────────────────────────────────────────
  @Delete('me/items/:itemId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove a single item from the cart' })
  @ApiResponse({
    status: 200,
    description: 'Item removed; updated cart returned.',
    type: CartResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Cart item not found.' })
  async removeItem(
    @GetUser('id') userId: string,
    @Param('itemId') itemId: string,
  ) {
    return this.cartsService.removeItem(userId, itemId);
  }

  // ── Clear cart ──────────────────────────────────────────────────────────
  @Delete('me')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove all items from the active cart' })
  @ApiResponse({
    status: 200,
    description: 'Cart cleared; empty cart returned.',
    type: CartResponseDto,
  })
  async clearCart(@GetUser('id') userId: string) {
    return this.cartsService.clearCart(userId);
  }

  // ── Merge guest cart ────────────────────────────────────────────────────
  @Post('me/merge')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Merge a guest (local) cart into the active server-side cart after login',
  })
  @ApiBody({ type: MergeCartDto })
  @ApiResponse({
    status: 200,
    description: 'Guest cart merged; updated cart returned.',
    type: CartResponseDto,
  })
  async mergeGuestCart(
    @GetUser('id') userId: string,
    @Body() mergeCartDto: MergeCartDto,
  ) {
    return this.cartsService.mergeGuestCart(userId, mergeCartDto);
  }
}
