import { Module } from '@nestjs/common';
import { ModulosController } from './modulos.controller.js';
import { RolesController } from './roles.controller.js';
import { RolesService } from './roles.service.js';

/**
 * El catalogo de cargos y que puede hacer cada uno.
 *
 * Otorgarle un cargo a una persona NO vive aqui: eso es de `usuarios`, porque
 * es un hecho sobre esa persona y no sobre el catalogo.
 */
@Module({
  controllers: [RolesController, ModulosController],
  providers: [RolesService],
})
export class RolesModule {}
