import { Module } from '@nestjs/common';
import { VinculacionesController } from './vinculaciones.controller.js';
import { VinculacionesService } from './vinculaciones.service.js';
import { UsuariosController } from './usuarios.controller.js';
import { UsuariosService } from './usuarios.service.js';

@Module({
  controllers: [UsuariosController, VinculacionesController],
  providers: [UsuariosService, VinculacionesService],
})
export class UsuariosModule {}
