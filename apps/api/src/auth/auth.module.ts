import { Global, Module } from '@nestjs/common';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { PermisosService } from './permisos.service.js';
import { SupabaseAdminService } from './supabase-admin.service.js';
import { SupabaseJwtService } from './supabase-jwt.service.js';

/**
 * Global porque los guards se registran a nivel de aplicacion (ver AppModule) y
 * necesitan inyectar SupabaseJwtService y PermisosService.
 */
@Global()
@Module({
  controllers: [AuthController],
  providers: [AuthService, PermisosService, SupabaseAdminService, SupabaseJwtService],
  exports: [PermisosService, SupabaseAdminService, SupabaseJwtService],
})
export class AuthModule {}
