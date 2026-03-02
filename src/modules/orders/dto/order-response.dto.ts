import { ApiProperty } from '@nestjs/swagger';
import { OrderStatus } from '@prisma/client';

export class OrderApiResponseDto<T> {
  @ApiProperty({ description: 'Indicates if the request was successful' })
  success: boolean;

  @ApiProperty({
    description:
      'message describing the result of the request, can be used for errors or info',
    nullable: true,
    required: false,
  })
  message: string;

  @ApiProperty({ description: 'Returned data', type: Object })
  data: T;

  @ApiProperty({
    description:
      'Additional metadata about the response, such as pagination info for lists',
    nullable: true,
    required: false,
    type: Object,
  })
  meta?: any;
}

export class OrderItemResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id: string;

  @ApiProperty({ example: 2 })
  quantity: number;

  @ApiProperty({
    example: 150000,
    description: 'Price locked at time of order in VND',
  })
  price: number;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  productId: string;

  @ApiProperty({
    example: {
      id: '...',
      name: 'iPhone 15 Pro',
      sku: 'IPHONE-15-PRO',
      imageUrl: null,
    },
    nullable: true,
  })
  product: {
    id: string;
    name: string;
    sku: string;
    imageUrl: string | null;
  } | null;
}

export class OrderResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id: string;

  @ApiProperty({ example: 'ckq9z3z3z0000z3z3z3z3z3z3' })
  orderNumber: string;

  @ApiProperty({ enum: OrderStatus, example: OrderStatus.PENDING })
  status: OrderStatus;

  @ApiProperty({ example: 150000, description: 'Total amount in VND' })
  totalAmount: number;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  userId: string;

  @ApiProperty({
    example: {
      id: '...',
      email: 'user@example.com',
      firstName: 'John',
      lastName: 'Doe',
    },
    nullable: true,
  })
  user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  } | null;

  @ApiProperty({ example: '123 Main St, New York, NY 10001', nullable: true })
  shippingAddress: string | null;

  @ApiProperty({ type: [OrderItemResponseDto] })
  orderItems: OrderItemResponseDto[];

  @ApiProperty({ example: '2024-01-01T12:00:00Z' })
  createdAt: Date;

  @ApiProperty({ example: '2024-01-10T15:30:00Z' })
  updatedAt: Date;
}
