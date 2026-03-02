import { ApiProperty } from '@nestjs/swagger';

export class CartApiResponseDto<T> {
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
}

export class CartItemResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id: string;

  @ApiProperty({ example: 2 })
  quantity: number;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  productId: string;

  @ApiProperty({
    example: {
      id: '...',
      name: 'iPhone 15 Pro',
      sku: 'IPHONE-15-PRO',
      price: 25000000,
      imageUrl: null,
      isActive: true,
    },
    nullable: true,
  })
  product: {
    id: string;
    name: string;
    sku: string;
    price: number;
    imageUrl: string | null;
    isActive: boolean;
  } | null;

  @ApiProperty({ example: 50000000, description: 'quantity × price' })
  subtotal: number;
}

export class CartResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  userId: string;

  @ApiProperty({ example: false })
  checkedOut: boolean;

  @ApiProperty({ type: [CartItemResponseDto] })
  cartItems: CartItemResponseDto[];

  @ApiProperty({
    example: 50000000,
    description: 'Sum of all cartItem subtotals',
  })
  totalAmount: number;

  @ApiProperty({ example: 2, description: 'Total number of items' })
  totalItems: number;

  @ApiProperty({ example: '2024-01-01T12:00:00Z' })
  createdAt: Date;

  @ApiProperty({ example: '2024-01-10T15:30:00Z' })
  updatedAt: Date;
}
