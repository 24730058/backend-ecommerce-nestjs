import { PassportStrategy } from '@nestjs/passport';
import { Strategy, ExtractJwt } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/prisma/prisma.service';
import { Request } from 'express';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

@Injectable()
export class RefreshTokenStrategy extends PassportStrategy(
  Strategy,
  'jwt-refresh',
) {
  constructor(
    private configService: ConfigService,
    private prismaService: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_REFRESH_SECRET'),
      passReqToCallback: true,
    });
  }

  // Validate the refresh token and return the user information
  async validate(req: Request, payload: { sub: string; email: string }) {
    console.log('RefreshTokenStrategy.validate called with payload');
    console.log('payload', { sub: payload.sub, email: payload.email });

    const authHeader = req.headers.authorization;
    if (!authHeader) {
      console.error('No Authorization header found in request');
      throw new UnauthorizedException('Refresh token not provided');
    }

    const refreshToken = authHeader.replace('Bearer ', '').trim();
    if (!refreshToken) {
      throw new UnauthorizedException(
        'Refresh token is empty after extraction',
      );
    }

    const user = await this.prismaService.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        role: true,
        refreshTokens: true,
      },
    });

    if (!user || !user.refreshTokens) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const refreshTokenMatches = user.refreshTokens.startsWith('$2')
      ? await bcrypt.compare(refreshToken, user.refreshTokens)
      : refreshToken === user.refreshTokens;

    if (!refreshTokenMatches) {
      throw new UnauthorizedException('Invalid refresh DOES NOT MATCH token');
    }

    return { id: user.id, email: user.email, role: user.role };
  }
}
