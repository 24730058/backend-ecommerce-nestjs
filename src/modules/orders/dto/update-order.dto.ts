import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { OrderStatus } from '@prisma/client';

export class UpdateOrderDto {
  @ApiPropertyOptional({
    enum: OrderStatus,
    example: OrderStatus.PROCESSING,
    description: 'New order status (Admin only)',
  })
  @IsEnum(OrderStatus)
  @IsOptional()
  status?: OrderStatus;

  @ApiPropertyOptional({
    example: '456 Elm St, Los Angeles, CA 90001',
    description: 'Updated shipping address (only when order is PENDING)',
    maxLength: 500,
  })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  shippingAddress?: string;
}
