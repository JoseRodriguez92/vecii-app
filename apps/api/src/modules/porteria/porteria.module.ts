import { Module } from '@nestjs/common';
import { CasillerosController } from './casilleros.controller.js';
import { CasillerosService } from './casilleros.service.js';
import { EncomiendasController } from './encomiendas.controller.js';
import { EncomiendasService } from './encomiendas.service.js';

/**
 * Porteria. Por ahora casilleros y encomiendas; falta la minuta de visitantes y la
 * autorizacion de salida de enseres (ver docs/pendientes.md).
 */
@Module({
  controllers: [CasillerosController, EncomiendasController],
  providers: [CasillerosService, EncomiendasService],
})
export class PorteriaModule {}
