import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { JwtService } from '@nestjs/jwt';
import { LoginDto } from './dto/login.dto';
import { ConfigService } from '@nestjs/config';
import { OtpService } from 'src/otp/otp.service';
import type { OtpPurpose } from 'src/common/types/otp-purpose.type';

@Injectable()
export class AuthService {
  private readonly SALT_ROUNDS = 12;
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private otpService: OtpService,
  ) {}

  // verify OTP for registration or password reset
  async requestOtp(
    email: string,
    type: OtpPurpose,
  ): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({
      where: { email: email },
    });
    if (type === 'register' && user) {
      throw new ConflictException('User with this email already exists');
    }
    if (type === 'reset-password' && !user) {
      throw new NotFoundException('User with this email does not exist');
    }

    return await this.otpService.sendOtp(email, type);
  }

  //   Register a new user
  async register(registerDto: RegisterDto): Promise<AuthResponseDto> {
    const { email, password, firstName, lastName, otp } = registerDto;

    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Verify the OTP
    const isOtpValid = await this.otpService.verifyOtp(email, otp, 'register');
    if (!isOtpValid.success) {
      throw new UnauthorizedException('Invalid or expired OTP');
    }

    try {
      const hashedPassword = await bcrypt.hash(password, this.SALT_ROUNDS);
      const user = await this.prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          firstName,
          lastName,
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          password: false,
        },
      });

      const tokens = await this.generateTokens(user.id, user.email);

      await this.updateRefreshToken(user.id, tokens.refreshToken);

      return {
        ...tokens,
        user,
      };
    } catch (error) {
      console.error('Error during user registration:', error);
      throw new InternalServerErrorException(
        'An error occurred during registration',
      );
    }
  }

  // Generate access and refresh tokens
  private async generateTokens(
    userId: string,
    email: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const payload = { sub: userId, email };
    const refreshId = randomBytes(16).toString('hex');
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        expiresIn: '15m',
        secret: this.configService.get<string>('JWT_SECRET'),
      }),
      this.jwtService.signAsync(
        { ...payload, refreshId },
        {
          expiresIn: '7d',
          secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        },
      ),
    ]);

    return { accessToken, refreshToken };
  }

  // Update refresh token in the database
  async updateRefreshToken(
    userId: string,
    refreshToken: string,
  ): Promise<void> {
    const hashedRefreshToken = await bcrypt.hash(
      refreshToken,
      this.SALT_ROUNDS,
    );

    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshTokens: hashedRefreshToken },
    });
  }

  // Refresh access token
  async refreshTokens(userId: string): Promise<AuthResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const tokens = await this.generateTokens(user.id, user.email);
    await this.updateRefreshToken(user.id, tokens.refreshToken);

    return {
      ...tokens,
      user,
    };
  }

  // Log out
  async logout(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshTokens: null },
    });
  }

  // Login
  async login(loginDto: LoginDto): Promise<AuthResponseDto> {
    const { email, password } = loginDto;

    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const tokens = await this.generateTokens(user.id, user.email);
    await this.updateRefreshToken(user.id, tokens.refreshToken);

    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
    };
  }

  // verify OTP for password reset

  async verifyResetOtp(email: string, otp: string) {
    // 1. Gọi OtpService để kiểm tra mã
    const otpResult = await this.otpService.verifyOtp(
      email,
      otp,
      'reset-password',
    );

    // 2. Nếu sai hoặc hết hạn, quăng lỗi ngay để NestJS tự trả về 400
    if (!otpResult.success) {
      throw new BadRequestException(otpResult.message);
    }

    // 3. Nếu ĐÚNG: Tạo một Token JWT ngắn hạn (ví dụ 15 phút)
    // Token này chứng minh rằng: "Email này đã nhập đúng OTP"
    const resetToken = await this.jwtService.signAsync(
      {
        email,
        type: 'reset-password-grant', // Nhãn để phân biệt với Access Token thông thường
      },
      {
        expiresIn: '15m',
        secret: this.configService.get('JWT_RESET_PASSWORD_SECRET'),
      },
    );

    return {
      message: 'Xác thực mã thành công',
      resetToken, // Trả về cho FE giữ
    };
  }

  // reset password
  async resetPassword(resetToken: string, newPassword: string) {
    try {
      // 1. Giải mã cái "Giấy thông hành"
      const payload = await this.jwtService.verifyAsync(resetToken, {
        secret: this.configService.get('JWT_RESET_PASSWORD_SECRET'),
      });

      // 2. Kiểm tra xem Token này có đúng loại dùng để đổi pass không
      if (payload.type !== 'reset-password-grant') {
        throw new UnauthorizedException('Token không hợp lệ');
      }

      // 3. Băm mật khẩu mới
      const hashedPassword = await bcrypt.hash(newPassword, this.SALT_ROUNDS);

      // 4. Cập nhật vào Database
      await this.prisma.user.update({
        where: { email: payload.email },
        data: { password: hashedPassword },
      });

      return { message: 'Đổi mật khẩu thành công. Vui lòng đăng nhập lại.' };
    } catch (error) {
      console.error(error);
      // Nếu token hết hạn hoặc giả mạo, verifyAsync sẽ báo lỗi
      throw new UnauthorizedException('Yêu cầu đổi mật khẩu đã hết hạn');
    }
  }
}
