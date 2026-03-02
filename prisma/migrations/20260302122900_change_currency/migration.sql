/*
  Warnings:

  - You are about to alter the column `price` on the `order_items` table. The data in that column could be lost. The data in that column will be cast from `Decimal(10,2)` to `Decimal(12,0)`.
  - You are about to alter the column `totalAmount` on the `orders` table. The data in that column could be lost. The data in that column will be cast from `Decimal(10,2)` to `Decimal(12,0)`.
  - You are about to alter the column `amount` on the `payments` table. The data in that column could be lost. The data in that column will be cast from `Decimal(10,2)` to `Decimal(12,0)`.
  - You are about to alter the column `price` on the `products` table. The data in that column could be lost. The data in that column will be cast from `Decimal(10,2)` to `Decimal(12,0)`.
  - You are about to drop the column `refreshToken` on the `users` table. All the data in the column will be lost.
  - Added the required column `provider` to the `payments` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM ('COD', 'BANK_TRANSFER', 'MOMO', 'ZALOPAY', 'VNPAY', 'STRIPE');

-- AlterTable
ALTER TABLE "order_items" ALTER COLUMN "price" SET DATA TYPE DECIMAL(12,0);

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "paymentProvider" "PaymentProvider" NOT NULL DEFAULT 'COD',
ALTER COLUMN "totalAmount" SET DATA TYPE DECIMAL(12,0);

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "externalId" TEXT,
ADD COLUMN     "provider" "PaymentProvider" NOT NULL,
ALTER COLUMN "amount" SET DATA TYPE DECIMAL(12,0),
ALTER COLUMN "currency" SET DEFAULT 'VND';

-- AlterTable
ALTER TABLE "products" ALTER COLUMN "price" SET DATA TYPE DECIMAL(12,0);

-- AlterTable
ALTER TABLE "users" DROP COLUMN "refreshToken",
ADD COLUMN     "refreshTokens" TEXT;
