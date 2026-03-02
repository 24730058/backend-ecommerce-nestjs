import { ApiProperty } from '@nestjs/swagger';

export class ProductResponseDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'The unique identifier of the product',
  })
  id: string;

  @ApiProperty({
    example: 'iPhone 15 Pro',
    description: 'The name of the product',
  })
  name: string;

  @ApiProperty({
    example: 'Latest Apple flagship smartphone with A17 Pro chip',
    description: 'A brief description of the product',
    nullable: true,
  })
  description: string | null;

  @ApiProperty({
    example: 150000,
    description: 'Product price in VND',
  })
  price: number;

  @ApiProperty({
    example: 50,
    description: 'The available stock quantity',
  })
  stock: number;

  @ApiProperty({
    example: 'IPHONE-15-PRO-256GB',
    description: 'The unique SKU identifier for the product',
  })
  sku: string;

  @ApiProperty({
    example: 'https://example.com/images/iphone-15-pro.png',
    description: 'URL of the product image',
    nullable: true,
  })
  imageUrl: string | null;

  @ApiProperty({
    example: true,
    description: 'Indicates if the product is active/visible',
  })
  isActive: boolean;

  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'The ID of the category this product belongs to',
  })
  categoryId: string;

  @ApiProperty({
    example: {
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'Electronics',
      slug: 'electronics',
    },
    description: 'The category this product belongs to',
    nullable: true,
  })
  category: { id: string; name: string; slug: string | null } | null;

  @ApiProperty({
    example: '2024-01-01T12:00:00Z',
    description: 'The date and time when the product was created',
  })
  createdAt: Date;

  @ApiProperty({
    example: '2024-01-10T15:30:00Z',
    description: 'The date and time when the product was last updated',
  })
  updatedAt: Date;
}
