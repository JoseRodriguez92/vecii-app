import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy, type StrategyOptionsWithoutRequest } from 'passport-jwt';

/** Forma del payload de un JWT emitido por Supabase Auth. */
export interface SupabaseJwtPayload {
  sub: string;
  email?: string;
  phone?: string;
  role?: string;
  aud: string | string[];
  exp: number;
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
}

/** Usuario autenticado que queda disponible en `request.user`. */
export interface AuthUser {
  id: string;
  email?: string;
  phone?: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'supabase') {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('SUPABASE_JWT_SECRET'),
      audience: 'authenticated',
      algorithms: ['HS256'],
    } satisfies StrategyOptionsWithoutRequest);
  }

  validate(payload: SupabaseJwtPayload): AuthUser {
    if (!payload?.sub) {
      throw new UnauthorizedException('Token invalido: falta el sujeto (sub)');
    }
    return { id: payload.sub, email: payload.email, phone: payload.phone };
  }
}
