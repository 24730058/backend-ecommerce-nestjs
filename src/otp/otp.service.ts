import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { customAlphabet } from 'nanoid';
import Redis from 'ioredis';
import { MailerService } from '@nestjs-modules/mailer';
import type { OtpPurpose } from 'src/common/types/otp-purpose.type';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class OtpService implements OnModuleInit, OnModuleDestroy {
  private redisClient: Redis;

  constructor(
    private readonly mailerService: MailerService,
    private readonly configService: ConfigService,
  ) {
    // 2. Kết nối tới kho tạm Redis
    const redisUrl =
      this.configService.get<string>('REDIS_URL') ?? 'redis://localhost:6379';
    this.redisClient = new Redis(redisUrl);

    this.redisClient.on('error', (err) => {
      console.error('Redis đang gặp sự cố kết nối:', err.message);
    });
  }
  // 2. Chuyển logic AWAIT vào đây (Bất đồng bộ)
  async onModuleInit() {
    try {
      console.log('Đang kiểm tra kết nối Redis...');
      await this.redisClient.set('connection_test', 'ok', 'EX', 10);
      console.log('Kết nối Redis thành công!');
    } catch (error) {
      console.error('Không thể thực hiện lệnh trên Redis:', error.message);
    }
  }

  // Đóng kết nối khi tắt server
  async onModuleDestroy() {
    await this.redisClient.quit();
  }

  async sendOtp(email: string, type: OtpPurpose) {
    // A. TẠO MÃ: Dùng nanoid tạo mã 6 ký tự (chữ và số in hoa)
    const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const nanoid = customAlphabet(alphabet, 6);
    const otp = nanoid();

    // Thiết lập Tiêu đề và Nội dung dựa trên "Type"

    const emailConfig = {
      register: {
        subject: 'Xác thực tài khoản mới',
        title: 'Chào mừng bạn! Đây là mã đăng ký của bạn:',
      },
      'reset-password': {
        subject: 'Khôi phục mật khẩu',
        title: 'Bạn đã yêu cầu đổi mật khẩu. Mã xác thực của bạn là:',
      },
    };

    const currentConfig = emailConfig[type];
    // B. LƯU KHO: Nhét vào Redis, đặt thời gian sống (TTL) là 300 giây (5 phút)
    // Key: otp:abc@gmail.com | Value: XJ3K9L
    const redisKey = `otp:${type}:${email}`;
    await this.redisClient.set(redisKey, otp, 'EX', 300);

    // C. GỬI THƯ: Dùng Mailer để bắn mã tới khách hàng
    await this.mailerService.sendMail({
      to: email,
      subject: currentConfig.subject,
      template: 'otp-template', // Tên file .hbs trong thư mục templates
      context: { otp, messageTitle: currentConfig.title }, // Truyền mã OTP vào file HTML
    });

    return {
      success: true,
      message: `Mã OTP đã được gửi tới ${email}`,
    };
  }

  // Hàm kiểm tra mã (Cần cập nhật key theo type)
  async verifyOtp(email: string, userOtp: string, type: OtpPurpose) {
    const redisKey = `otp:${type}:${email}`;
    const savedOtp = await this.redisClient.get(redisKey);

    if (!savedOtp)
      return { success: false, message: 'Mã đã hết hạn hoặc không tồn tại' };
    if (savedOtp !== userOtp)
      return { success: false, message: 'Mã xác thực không chính xác' };

    // Xóa mã sau khi dùng xong
    await this.redisClient.del(redisKey);
    return { success: true };
  }
}
