import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { AuthModule } from './auth/auth.module.js';
import { PermisosGuard } from './auth/permisos.guard.js';
import { SupabaseAuthGuard } from './auth/supabase-auth.guard.js';
import { validateEnv } from './config/env.validation.js';
import { HealthController } from './health/health.controller.js';
import { ConjuntosModule } from './modules/conjuntos/conjuntos.module.js';
import { EstructuraModule } from './modules/estructura/estructura.module.js';
import { FinanzasModule } from './modules/finanzas/finanzas.module.js';
import { InstalacionesModule } from './modules/instalaciones/instalaciones.module.js';
import { NotificacionesModule } from './modules/notificaciones/notificaciones.module.js';
import { PlataformaModule } from './modules/plataforma/plataforma.module.js';
import { PorteriaModule } from './modules/porteria/porteria.module.js';
import { ReservasModule } from './modules/reservas/reservas.module.js';
import { RolesModule } from './modules/roles/roles.module.js';
import { UsuariosModule } from './modules/usuarios/usuarios.module.js';
import { PrismaModule } from './prisma/prisma.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
      envFilePath: ['.env.local', '.env'],
    }),
    PrismaModule,
    AuthModule,
    ConjuntosModule,
    EstructuraModule,
    FinanzasModule,
    InstalacionesModule,
    NotificacionesModule,
    UsuariosModule,
    PlataformaModule,
    PorteriaModule,
    ReservasModule,
    RolesModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: SupabaseAuthGuard },
    { provide: APP_GUARD, useClass: PermisosGuard },
  ],
})
export class AppModule {}
