import { Module } from '@nestjs/common';
import { InvitacionesController } from './invitaciones.controller.js';
import { InvitacionesService } from './invitaciones.service.js';
import { UsuariosController } from './usuarios.controller.js';
import { UsuariosService } from './usuarios.service.js';

@Module({
  controllers: [UsuariosController, InvitacionesController],
  providers: [UsuariosService, InvitacionesService],
})
export class UsuariosModule {}
