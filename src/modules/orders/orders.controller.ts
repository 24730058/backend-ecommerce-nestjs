import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RoleGuard } from 'src/common/guards/roles.guard';
import { Role } from '@prisma/client';
import { Roles } from 'src/common/decorators/roles.decorator';
import { GetUser } from 'src/common/decorators/get-user.decorator';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { OrderResponseDto } from './dto/order-response.dto';
import { QueryOrderDto } from './dto/query-order.dto';

@ApiTags('Orders')
@Controller('orders')
@UseGuards(JwtAuthGuard) // all routes require authentication
@ApiBearerAuth('JWT-auth')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  // ── Create order (authenticated user) ────────────────────────────────────
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new order' })
  @ApiBody({ type: CreateOrderDto })
  @ApiResponse({
    status: 201,
    description: 'Order created successfully.',
    type: OrderResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Insufficient stock or invalid product.',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Product not found.' })
  async create(
    @GetUser('id') userId: string,
    @Body() createOrderDto: CreateOrderDto,
  ): Promise<OrderResponseDto> {
    return await this.ordersService.create(userId, createOrderDto);
  }

  // ── Get all orders – Admin only ───────────────────────────────────────────
  @Get()
  @UseGuards(RoleGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Get all orders (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of all orders.',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: { $ref: '#/components/schemas/OrderResponseDto' },
        },
        meta: {
          type: 'object',
          properties: {
            total: { type: 'number' },
            page: { type: 'number' },
            limit: { type: 'number' },
            totalPages: { type: 'number' },
          },
        },
      },
    },
  })
  async findAll(@Query() queryDto: QueryOrderDto) {
    return await this.ordersService.findAllAdmin(queryDto);
  }

  // ── Get current user's own orders ────────────────────────────────────────
  @Get('my-orders')
  @ApiOperation({ summary: 'Get orders for the logged-in user' })
  @ApiResponse({
    status: 200,
    description: "Paginated list of the current user's orders.",
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: { $ref: '#/components/schemas/OrderResponseDto' },
        },
        meta: {
          type: 'object',
          properties: {
            total: { type: 'number' },
            page: { type: 'number' },
            limit: { type: 'number' },
            totalPages: { type: 'number' },
          },
        },
      },
    },
  })
  async findMyOrders(
    @GetUser('id') userId: string,
    @Query() queryDto: QueryOrderDto,
  ) {
    return await this.ordersService.findMyOrders(userId, queryDto);
  }

  // ── Find order by ID (owner or admin) ────────────────────────────────────
  @Get(':id')
  @ApiOperation({ summary: 'Get order by ID (owner or admin)' })
  @ApiResponse({
    status: 200,
    description: 'Order details.',
    type: OrderResponseDto,
  })
  @ApiResponse({ status: 403, description: 'Forbidden – not your order.' })
  @ApiResponse({ status: 404, description: 'Order not found.' })
  async findOne(
    @Param('id') id: string,
    @GetUser('id') userId: string,
    @GetUser('role') role: Role,
  ): Promise<OrderResponseDto> {
    return await this.ordersService.findOne(id, userId, role);
  }

  // ── Update order (admin changes status / user changes shippingAddress) ───
  @Patch(':id')
  @ApiOperation({
    summary:
      'Update order status (Admin) or shipping address (User while PENDING)',
  })
  @ApiBody({ type: UpdateOrderDto })
  @ApiResponse({
    status: 200,
    description: 'Order updated successfully.',
    type: OrderResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid update for current order status.',
  })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 404, description: 'Order not found.' })
  async update(
    @Param('id') id: string,
    @GetUser('id') userId: string,
    @GetUser('role') role: Role,
    @Body() updateOrderDto: UpdateOrderDto,
  ): Promise<OrderResponseDto> {
    return await this.ordersService.update(id, updateOrderDto, userId, role);
  }

  // ── Cancel order (owner or admin) ────────────────────────────────────────
  @Patch(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Cancel an order (owner or admin, only PENDING or PROCESSING)',
  })
  @ApiResponse({
    status: 200,
    description: 'Order cancelled and stock restored.',
    type: OrderResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Order cannot be cancelled in its current status.',
  })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 404, description: 'Order not found.' })
  async cancel(
    @Param('id') id: string,
    @GetUser('id') userId: string,
    @GetUser('role') role: Role,
  ): Promise<OrderResponseDto> {
    return await this.ordersService.cancel(id, userId, role);
  }
}
