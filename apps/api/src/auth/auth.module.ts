import { Global, Module } from '@nestjs/common';
import { AlcanceService } from './alcance.service.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { PermisosService } from './permisos.service.js';
import { SupabaseAdminService } from './supabase-admin.service.js';
import { SupabaseJwtService } from './supabase-jwt.service.js';

/**
 * Global porque los guards se registran a nivel de aplicacion (ver AppModule) y
 * necesitan inyectar SupabaseJwtService y AlcanceService.
 */
@Global()
@Module({
  controllers: [AuthController],
  providers: [AlcanceService, AuthService, PermisosService, SupabaseAdminService, SupabaseJwtService],
  exports: [AlcanceService, PermisosService, SupabaseAdminService, SupabaseJwtService],
})
export class AuthModule {}
