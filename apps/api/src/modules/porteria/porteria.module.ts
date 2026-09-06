import { Module } from '@nestjs/common';
import { CasillerosController } from './casilleros.controller.js';
import { CasillerosService } from './casilleros.service.js';
import { EntregasController } from './entregas.controller.js';
import { EntregasService } from './entregas.service.js';

/**
 * Porteria. Por ahora casilleros y entregas; falta la minuta de visitantes y la
 * autorizacion de salida de enseres (ver docs/pendientes.md).
 */
@Module({
  controllers: [CasillerosController, EntregasController],
  providers: [CasillerosService, EntregasService],
})
export class PorteriaModule {}
