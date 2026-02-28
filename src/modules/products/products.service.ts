import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { UpdateProductStockDto } from './dto/update-product-stock.dto';
import { ProductResponseDto } from './dto/product-response.dto';
import { Prisma, Product } from '@prisma/client';
import { QueryProductDto } from './dto/query-product.dto';

@Injectable()
export class ProductsService {
  constructor(private prismaService: PrismaService) {}

  // Create a new product
  async create(
    createProductDto: CreateProductDto,
  ): Promise<ProductResponseDto> {
    const { sku, categoryId, ...rest } = createProductDto;

    const existingProduct = await this.prismaService.product.findUnique({
      where: { sku },
    });

    if (existingProduct) {
      throw new ConflictException(`Product with SKU "${sku}" already exists`);
    }

    const category = await this.prismaService.category.findUnique({
      where: { id: categoryId },
    });

    if (!category) {
      throw new NotFoundException(`Category with ID "${categoryId}" not found`);
    }

    const product = await this.prismaService.product.create({
      data: {
        sku,
        categoryId,
        ...rest,
        price: new Prisma.Decimal(rest.price),
      },
      include: {
        category: {
          select: { id: true, name: true, slug: true },
        },
      },
    });

    return this.formatProduct(product);
  }

  // Get all products with optional filters and pagination
  async findAll(queryDto: QueryProductDto): Promise<{
    data: ProductResponseDto[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    const {
      isActive,
      categoryId,
      search,
      minPrice,
      maxPrice,
      page = 1,
      limit = 10,
    } = queryDto;

    const where: Prisma.ProductWhereInput = {};

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    if (categoryId) {
      where.categoryId = categoryId;
    }

    if (minPrice !== undefined || maxPrice !== undefined) {
      where.price = {};
      if (minPrice !== undefined) {
        where.price.gte = minPrice;
      }
      if (maxPrice !== undefined) {
        where.price.lte = maxPrice;
      }
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
      ];
    }

    const total = await this.prismaService.product.count({ where });

    const products = await this.prismaService.product.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        category: {
          select: { id: true, name: true, slug: true },
        },
      },
    });

    return {
      data: products.map((product) => this.formatProduct(product)),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // Get product by ID
  async findOne(id: string): Promise<ProductResponseDto> {
    const product = await this.prismaService.product.findUnique({
      where: { id },
      include: {
        category: {
          select: { id: true, name: true, slug: true },
        },
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return this.formatProduct(product);
  }

  // Update product
  async update(
    id: string,
    updateProductDto: UpdateProductDto,
  ): Promise<ProductResponseDto> {
    const existingProduct = await this.prismaService.product.findUnique({
      where: { id },
    });

    if (!existingProduct) {
      throw new NotFoundException('Product not found');
    }

    if (updateProductDto.sku && updateProductDto.sku !== existingProduct.sku) {
      const skuTaken = await this.prismaService.product.findUnique({
        where: { sku: updateProductDto.sku },
      });

      if (skuTaken) {
        throw new ConflictException(
          `Product with SKU "${updateProductDto.sku}" already exists`,
        );
      }
    }

    if (
      updateProductDto.categoryId &&
      updateProductDto.categoryId !== existingProduct.categoryId
    ) {
      const category = await this.prismaService.category.findUnique({
        where: { id: updateProductDto.categoryId },
      });

      if (!category) {
        throw new NotFoundException(
          `Category with ID "${updateProductDto.categoryId}" not found`,
        );
      }
    }

    const updatedProduct = await this.prismaService.product.update({
      where: { id },
      data: updateProductDto,
      include: {
        category: {
          select: { id: true, name: true, slug: true },
        },
      },
    });

    return this.formatProduct(updatedProduct);
  }

  // Update product stock
  async updateStock(
    id: string,
    updateProductStockDto: UpdateProductStockDto,
  ): Promise<ProductResponseDto> {
    const existingProduct = await this.prismaService.product.findUnique({
      where: { id },
    });

    if (!existingProduct) {
      throw new NotFoundException('Product not found');
    }

    const updatedProduct = await this.prismaService.product.update({
      where: { id },
      data: { stock: updateProductStockDto.stock },
      include: {
        category: {
          select: { id: true, name: true, slug: true },
        },
      },
    });

    return this.formatProduct(updatedProduct);
  }

  // Remove a product
  async remove(id: string): Promise<{ message: string }> {
    const product = await this.prismaService.product.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            orderItems: true,
            cartItems: true,
          },
        },
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    if (product._count.orderItems > 0) {
      throw new BadRequestException(
        `Cannot delete product that is referenced by ${product._count.orderItems} order item(s)`,
      );
    }

    await this.prismaService.product.delete({
      where: { id },
    });

    return { message: 'Product deleted successfully' };
  }

  private formatProduct(
    product: Product & {
      category?: { id: string; name: string; slug: string | null } | null;
    },
  ): ProductResponseDto {
    return {
      id: product.id,
      name: product.name,
      description: product.description,
      price: Number(product.price),
      stock: product.stock,
      sku: product.sku,
      imageUrl: product.imageUrl,
      isActive: product.isActive,
      categoryId: product.categoryId,
      category: product.category ?? null,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    };
  }
}
