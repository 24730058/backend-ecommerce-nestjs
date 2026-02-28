import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateProductDto {
  @ApiProperty({
    example: 'iPhone 15 Pro',
    description: 'The name of the product',
    maxLength: 200,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  @ApiProperty({
    example: 'Latest Apple flagship smartphone with A17 Pro chip',
    description: 'A brief description of the product',
    required: false,
    maxLength: 1000,
  })
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  description?: string;

  @ApiProperty({
    example: 999.99,
    description: 'The price of the product',
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Type(() => Number)
  price: number;

  @ApiProperty({
    example: 50,
    description: 'The available stock quantity',
    default: 0,
    required: false,
  })
  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  stock?: number;

  @ApiProperty({
    example: 'IPHONE-15-PRO-256GB',
    description: 'The unique SKU identifier for the product',
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  sku: string;

  @ApiProperty({
    example: 'https://example.com/images/iphone-15-pro.png',
    description: 'URL of the product image',
    required: false,
  })
  @IsString()
  @IsOptional()
  imageUrl?: string;

  @ApiProperty({
    example: true,
    description: 'Indicates if the product is active/visible',
    required: false,
    default: true,
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'The ID of the category this product belongs to',
  })
  @IsUUID()
  @IsNotEmpty()
  categoryId: string;
}
