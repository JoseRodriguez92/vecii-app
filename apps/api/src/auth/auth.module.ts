import { Global, Module } from '@nestjs/common';
import { PermisosDelUsuarioService } from './permisos-del-usuario.service.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { PermisosDelRolService } from './permisos-del-rol.service.js';
import { SupabaseAdminService } from './supabase-admin.service.js';
import { SupabaseJwtService } from './supabase-jwt.service.js';

/**
 * Global porque los guards se registran a nivel de aplicacion (ver AppModule) y
 * necesitan inyectar SupabaseJwtService y PermisosDelUsuarioService.
 */
@Global()
@Module({
  controllers: [AuthController],
  providers: [PermisosDelUsuarioService, AuthService, PermisosDelRolService, SupabaseAdminService, SupabaseJwtService],
  exports: [PermisosDelUsuarioService, PermisosDelRolService, SupabaseAdminService, SupabaseJwtService],
})
export class AuthModule {}
