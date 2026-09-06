import { Module } from '@nestjs/common';
import { AgrupacionesController } from './agrupaciones.controller.js';
import { AgrupacionesService } from './agrupaciones.service.js';
import { TipologiasController } from './tipologias.controller.js';
import { TipologiasService } from './tipologias.service.js';
import { UnidadesController } from './unidades.controller.js';
import { UnidadesService } from './unidades.service.js';

/**
 * La estructura fisica del conjunto. Un controlador por recurso —y no uno solo—
 * para que Swagger los muestre en secciones separadas y los archivos no crezcan.
 */
@Module({
  controllers: [AgrupacionesController, TipologiasController, UnidadesController],
  providers: [AgrupacionesService, TipologiasService, UnidadesService],
  exports: [UnidadesService],
})
export class EstructuraModule {}
