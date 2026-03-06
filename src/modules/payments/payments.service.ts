import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  OrderStatus,
  Payment,
  PaymentProvider,
  PaymentStatus,
  Prisma,
  Role,
} from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { ConfirmPaymentDto } from './dto/confirm-payment.dto';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { QueryPaymentDto } from './dto/query-payment.dto';
import {
  PaymentApiResponseDto,
  PaymentResponseDto,
} from './dto/payment-response.dto';

// Full payment shape returned from Prisma
type PaymentWithRelations = Payment;

@Injectable()
export class PaymentsService {
  constructor(private readonly prismaService: PrismaService) { }

  // ─── Create payment intent ────────────────────────────────────────────────
  // Flow:
  //  1. Verify order exists, belongs to user, and is PENDING.
  //  2. Ensure no active (non-FAILED) payment already exists for the order.
  //  3. Create a PENDING payment record in VND with the order's totalAmount.
  async createIntent(
    userId: string,
    createPaymentDto: CreatePaymentDto,
  ): Promise<PaymentApiResponseDto<PaymentResponseDto>> {
    const { orderId, provider = PaymentProvider.COD } = createPaymentDto;
    const CURRENCY = 'VND';

    // 1 – validate order
    const order = await this.prismaService.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID "${orderId}" not found`);
    }

    if (order.userId !== userId) {
      throw new ForbiddenException('You do not have access to this order');
    }

    if (order.status !== OrderStatus.PENDING) {
      throw new BadRequestException(
        `Cannot create a payment intent for an order with status "${order.status}"`,
      );
    }

    // 2 – check for existing active payment
    const existingPayment = await this.prismaService.payment.findUnique({
      where: { orderId },
    });

    if (existingPayment && existingPayment.status !== PaymentStatus.FAILED) {
      throw new BadRequestException(
        'An active payment already exists for this order',
      );
    }

    // 3 – create payment intent (upsert to replace a previous FAILED one)
    //     Wrapped in a transaction so the order sync is atomic.
    const payment = await this.prismaService.$transaction(async (tx) => {
      const upserted = await tx.payment.upsert({
        where: { orderId },
        update: {
          amount: order.totalAmount,
          status: PaymentStatus.PENDING,
          currency: CURRENCY,
          provider,
          paymentMethod: provider.toString(),
          transactionId: null,
          externalId: null,
        },
        create: {
          amount: order.totalAmount,
          status: PaymentStatus.PENDING,
          currency: CURRENCY,
          provider,
          paymentMethod: provider.toString(),
          userId,
          orderId,
        },
      });

      // Sync paymentProvider on the order
      await tx.order.update({
        where: { id: orderId },
        data: { paymentProvider: provider },
      });

      return upserted;
    });

    return this.response(
      this.mapToPaymentResponse(payment),
      'Payment intent created successfully',
    );
  }

  // ─── Confirm payment intent ───────────────────────────────────────────────
  // Flow:
  //  1. Find payment and validate ownership.
  //  2. Must be in PENDING status.
  //  3. Atomically: set payment → COMPLETED, order → PROCESSING.
  //     COD: auto-generate transactionId. Others: save externalId from gateway.
  async confirmIntent(
    id: string,
    userId: string,
    role: Role,
    confirmPaymentDto: ConfirmPaymentDto,
  ): Promise<PaymentApiResponseDto<PaymentResponseDto>> {
    const payment = await this.prismaService.payment.findUnique({
      where: { id },
    });

    if (!payment) throw new NotFoundException('Payment not found');

    if (role !== Role.ADMIN && payment.userId !== userId) {
      throw new ForbiddenException('You do not have access to this payment');
    }

    if (payment.status !== PaymentStatus.PENDING) {
      throw new BadRequestException(
        `Cannot confirm a payment with status "${payment.status}"`,
      );
    }

    const confirmed = await this.prismaService.$transaction(async (tx) => {
      // COD: auto-generate internal ref. Others: use externalId from gateway.
      const isCod = payment.provider === PaymentProvider.COD;
      const transactionId = isCod
        ? `COD-${payment.orderId}-${Date.now()}`
        : (confirmPaymentDto.externalId ?? `${payment.provider}-${Date.now()}`);

      const updated = await tx.payment.update({
        where: { id },
        data: {
          status: PaymentStatus.COMPLETED,
          transactionId,
          externalId: confirmPaymentDto.externalId ?? null,
        },
      });

      const order = await tx.order.update({
        where: { id: payment.orderId },
        data: { status: OrderStatus.PROCESSING },
        select: { cartId: true },
      });

      if (order.cartId) {
        await tx.cart.update({
          where: { id: order.cartId },
          data: { checkedOut: true },
        });
      }

      return updated;
    });

    return this.response(
      this.mapToPaymentResponse(confirmed),
      'Payment confirmed successfully',
    );
  }

  // ─── Get all payments for current user ───────────────────────────────────
  async findMyPayments(
    userId: string,
    queryDto: QueryPaymentDto,
  ): Promise<PaymentApiResponseDto<PaymentResponseDto[]>> {
    const { status, page = 1, limit = 10 } = queryDto;

    const where: Prisma.PaymentWhereInput = { userId };
    if (status) where.status = status;

    const [total, payments] = await Promise.all([
      this.prismaService.payment.count({ where }),
      this.prismaService.payment.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return this.response(
      payments.map((p) => this.mapToPaymentResponse(p)),
      'Payments retrieved successfully',
      { total, page, limit, totalPages: Math.ceil(total / limit) },
    );
  }

  // ─── Get payment by ID ────────────────────────────────────────────────────
  // Owner sees their own; Admin sees any.
  async findOne(
    id: string,
    userId: string,
    role: Role,
  ): Promise<PaymentApiResponseDto<PaymentResponseDto>> {
    const payment = await this.prismaService.payment.findUnique({
      where: { id },
    });

    if (!payment) throw new NotFoundException('Payment not found');

    if (role !== Role.ADMIN && payment.userId !== userId) {
      throw new ForbiddenException('You do not have access to this payment');
    }

    return this.response(
      this.mapToPaymentResponse(payment),
      'Payment retrieved successfully',
    );
  }

  // ─── Get payment by Order ID ──────────────────────────────────────────────
  async findByOrderId(
    orderId: string,
    userId: string,
    role: Role,
  ): Promise<PaymentApiResponseDto<PaymentResponseDto>> {
    const payment = await this.prismaService.payment.findUnique({
      where: { orderId },
    });

    if (!payment)
      throw new NotFoundException('Payment not found for this order');

    if (role !== Role.ADMIN && payment.userId !== userId) {
      throw new ForbiddenException('You do not have access to this payment');
    }

    return this.response(
      this.mapToPaymentResponse(payment),
      'Payment retrieved successfully',
    );
  }

  // ─── Private helpers ─────────────────────────────────────────────────────

  private mapToPaymentResponse(
    payment: PaymentWithRelations,
  ): PaymentResponseDto {
    return {
      id: payment.id,
      amount: Number(payment.amount),
      status: payment.status,
      currency: payment.currency,
      provider: payment.provider,
      paymentMethod: payment.paymentMethod,
      transactionId: payment.transactionId,
      externalId: payment.externalId,
      userId: payment.userId,
      orderId: payment.orderId,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
    };
  }

  private response<T>(
    data: T,
    message: string,
    meta?: Record<string, unknown>,
  ): PaymentApiResponseDto<T> {
    return { success: true, message, data, ...(meta && { meta }) };
  }
}
