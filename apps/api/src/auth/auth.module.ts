import { Global, Module } from '@nestjs/common';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { SupabaseJwtService } from './supabase-jwt.service.js';

/**
 * Global porque el guard de autenticacion se registra a nivel de aplicacion
 * (ver AppModule) y necesita inyectar SupabaseJwtService.
 */
@Global()
@Module({
  controllers: [AuthController],
  providers: [AuthService, SupabaseJwtService],
  exports: [SupabaseJwtService],
})
export class AuthModule {}
