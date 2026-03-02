import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
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
import { Role } from '@prisma/client';
import { GetUser } from 'src/common/decorators/get-user.decorator';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { ConfirmPaymentDto } from './dto/confirm-payment.dto';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { PaymentResponseDto } from './dto/payment-response.dto';
import { QueryPaymentDto } from './dto/query-payment.dto';
import { PaymentsService } from './payments.service';

@ApiTags('Payments')
@Controller('payments')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  // ── Create payment intent ────────────────────────────────────────────────
  @Post('intent')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary:
      'Create a payment intent for a PENDING order (currency: VND, default provider: COD)',
  })
  @ApiBody({ type: CreatePaymentDto })
  @ApiResponse({
    status: 201,
    description: 'Payment intent created.',
    type: PaymentResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Order not in PENDING state or payment already exists.',
  })
  @ApiResponse({ status: 403, description: 'Forbidden – not your order.' })
  @ApiResponse({ status: 404, description: 'Order not found.' })
  async createIntent(
    @GetUser('id') userId: string,
    @Body() createPaymentDto: CreatePaymentDto,
  ) {
    return this.paymentsService.createIntent(userId, createPaymentDto);
  }

  // ── Confirm payment intent ───────────────────────────────────────────────
  @Post(':id/confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Confirm a PENDING payment (COD: marks cash collected; others: provide externalId)',
  })
  @ApiBody({ type: ConfirmPaymentDto })
  @ApiResponse({
    status: 200,
    description: 'Payment confirmed and order moved to PROCESSING.',
    type: PaymentResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Payment is not in PENDING state.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 404, description: 'Payment not found.' })
  async confirmIntent(
    @Param('id') id: string,
    @GetUser('id') userId: string,
    @GetUser('role') role: Role,
    @Body() confirmPaymentDto: ConfirmPaymentDto,
  ) {
    return this.paymentsService.confirmIntent(
      id,
      userId,
      role,
      confirmPaymentDto,
    );
  }

  // ── Get current user's payments ──────────────────────────────────────────
  @Get('my-payments')
  @ApiOperation({ summary: 'Get all payments for the logged-in user' })
  @ApiResponse({
    status: 200,
    description: "Paginated list of the current user's payments.",
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        data: {
          type: 'array',
          items: { $ref: '#/components/schemas/PaymentResponseDto' },
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
  async findMyPayments(
    @GetUser('id') userId: string,
    @Query() queryDto: QueryPaymentDto,
  ) {
    return this.paymentsService.findMyPayments(userId, queryDto);
  }

  // ── Get payment by Order ID ──────────────────────────────────────────────
  @Get('order/:orderId')
  @ApiOperation({ summary: 'Get payment by Order ID (owner or admin)' })
  @ApiResponse({
    status: 200,
    description: 'Payment details for the given order.',
    type: PaymentResponseDto,
  })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 404, description: 'Payment not found.' })
  async findByOrderId(
    @Param('orderId') orderId: string,
    @GetUser('id') userId: string,
    @GetUser('role') role: Role,
  ) {
    return this.paymentsService.findByOrderId(orderId, userId, role);
  }

  // ── Get payment by ID ────────────────────────────────────────────────────
  @Get(':id')
  @ApiOperation({ summary: 'Get payment by ID (owner or admin)' })
  @ApiResponse({
    status: 200,
    description: 'Payment details.',
    type: PaymentResponseDto,
  })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 404, description: 'Payment not found.' })
  async findOne(
    @Param('id') id: string,
    @GetUser('id') userId: string,
    @GetUser('role') role: Role,
  ) {
    return this.paymentsService.findOne(id, userId, role);
  }
}
