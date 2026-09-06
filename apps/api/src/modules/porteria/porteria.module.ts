import { Module } from '@nestjs/common';
import { CasillerosController } from './casilleros.controller.js';
import { CasillerosService } from './casilleros.service.js';
import { EncomiendasController } from './encomiendas.controller.js';
import { EncomiendasService } from './encomiendas.service.js';
import { InvitadosController } from './invitados.controller.js';
import { InvitadosService } from './invitados.service.js';

/**
 * Porteria. Casilleros, encomiendas e invitados. Falta el control de ingreso
 * —hora de entrada y salida, cupo asignado— y la autorizacion de salida de
 * enseres (ver docs/pendientes.md).
 */
@Module({
  controllers: [CasillerosController, EncomiendasController, InvitadosController],
  providers: [CasillerosService, EncomiendasService, InvitadosService],
})
export class PorteriaModule {}
