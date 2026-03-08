import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { ConfigModule } from '@nestjs/config';
import { UsersModule } from './modules/users/users.module';
import { CategoryModule } from './modules/category/category.module';
import { ProductsModule } from './modules/products/products.module';
import { OrdersModule } from './modules/orders/orders.module';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { PaymentsModule } from './modules/payments/payments.module';
import { CartsModule } from './modules/carts/carts.module';
import { CloudinaryModule } from './cloudinary/cloudinary.module';
import { MailerModule } from '@nestjs-modules/mailer';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/dist/adapters/handlebars.adapter';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // seconds
        limit: 10, // max 10 requests per ttl
      },
    ]),
    MailerModule.forRoot({
      transport: {
        host: 'smtp.gmail.com',
        auth: {
          user: 'focuslearning31@gmail.com', // your email
          pass: 'huet jngm ptvc vgsc', // your email password or app password
        },
      },
      defaults: {
        from: '"No Reply" <focuslearning31@gmail.com>', // default sender address
      },
      template: {
        dir: process.cwd() + '/templates', // path to email templates
        adapter: new HandlebarsAdapter(), // use Handlebars for templating
        options: { strict: true },
      },
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    CategoryModule,
    ProductsModule,
    OrdersModule,
    PaymentsModule,
    CartsModule,
    CloudinaryModule,
  ],
  controllers: [AppController],
  providers: [AppService, ThrottlerGuard],
})
export class AppModule {}
