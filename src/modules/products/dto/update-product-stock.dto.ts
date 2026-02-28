import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, Min } from 'class-validator';

export class UpdateProductStockDto {
  @ApiProperty({
    example: 100,
    description: 'The new stock quantity for the product',
    minimum: 0,
  })
  @IsInt()
  @Min(0)
  @IsNotEmpty()
  stock: number;
}
