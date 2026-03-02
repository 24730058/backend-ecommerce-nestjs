import { ApiProperty } from '@nestjs/swagger';
import { PaymentProvider, PaymentStatus } from '@prisma/client';

export class PaymentApiResponseDto<T> {
  @ApiProperty({ description: 'Indicates if the request was successful' })
  success: boolean;

  @ApiProperty({
    description: 'Message describing the result of the request',
    nullable: true,
    required: false,
  })
  message: string;

  @ApiProperty({ description: 'Returned data', type: Object })
  data: T;

  @ApiProperty({
    description: 'Additional metadata such as pagination info',
    nullable: true,
    required: false,
    type: Object,
  })
  meta?: any;
}

export class PaymentResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id: string;

  @ApiProperty({ example: 150000 })
  amount: number;

  @ApiProperty({ enum: PaymentStatus, example: PaymentStatus.PENDING })
  status: PaymentStatus;

  @ApiProperty({ example: 'VND' })
  currency: string;

  @ApiProperty({ enum: PaymentProvider, example: PaymentProvider.COD })
  provider: PaymentProvider;

  @ApiProperty({ example: 'COD', nullable: true })
  paymentMethod: string | null;

  @ApiProperty({
    example: 'COD-uuid-1709123456789',
    description: 'Internal transaction reference generated on confirmation',
    nullable: true,
  })
  transactionId: string | null;

  @ApiProperty({
    example: 'MOMO-TXN-123456',
    description:
      'External transaction ID from payment gateway (MoMo, VNPAY, etc.)',
    nullable: true,
  })
  externalId: string | null;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  userId: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  orderId: string;

  @ApiProperty({ example: '2024-01-01T12:00:00Z' })
  createdAt: Date;

  @ApiProperty({ example: '2024-01-10T15:30:00Z' })
  updatedAt: Date;
}
