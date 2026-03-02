import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class ConfirmPaymentDto {
  @ApiProperty({
    example: 'MOMO-TXN-123456',
    description:
      'External transaction ID from payment gateway (MoMo, VNPAY, ZaloPay, etc.). Not required for COD.',
    required: false,
    nullable: true,
  })
  @IsString()
  @IsOptional()
  externalId?: string;
}
