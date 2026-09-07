import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';
import type { SesionSupabase, SupabaseJwtPayload } from './auth-user.js';

/**
 * Verifica los access tokens que emite Supabase Auth.
 *
 * Supabase migro a "JWT Signing Keys" asimetricas (ES256 / RS256 / EdDSA): los
 * tokens ya NO se firman con el secreto compartido HS256. La verificacion va
 * contra el JWKS publico del proyecto.
 *
 * `createRemoteJWKSet` cachea las llaves y las vuelve a pedir cuando aparece un
 * `kid` desconocido, de modo que la rotacion de llaves se resuelve sola.
 * Ver: https://supabase.com/docs/guides/auth/jwts
 */
@Injectable()
export class SupabaseJwtService {
  private readonly logger = new Logger(SupabaseJwtService.name);
  private readonly jwks: JWTVerifyGetKey;

  constructor(private readonly config: ConfigService) {
    const supabaseUrl = this.config.getOrThrow<string>('SUPABASE_URL');
    this.jwks = createRemoteJWKSet(new URL(`${supabaseUrl}/auth/v1/.well-known/jwks.json`), {
      // No cachear mas alla de esto: alarga la ventana en que una llave
      // revocada seguiria siendo aceptada.
      cacheMaxAge: 10 * 60 * 1000,
      cooldownDuration: 30 * 1000,
    });
  }

  async verify(token: string): Promise<SesionSupabase> {
    let payload: SupabaseJwtPayload;

    try {
      const result = await jwtVerify(token, this.jwks, {
        audience: 'authenticated',
        algorithms: ['ES256', 'RS256', 'EdDSA'],
      });
      payload = result.payload as unknown as SupabaseJwtPayload;
    } catch (error) {
      // El detalle solo al log: al cliente nunca se le explica por que fallo.
      this.logger.debug(`Token rechazado: ${error instanceof Error ? error.message : error}`);
      throw new UnauthorizedException('Token invalido o expirado');
    }

    if (!payload.sub) {
      throw new UnauthorizedException('Token invalido: falta el sujeto (sub)');
    }

    return { cuentaId: payload.sub, email: payload.email, phone: payload.phone };
  }
}
