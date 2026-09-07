import { Module } from '@nestjs/common';
import { BicicletasController } from './bicicletas.controller.js';
import { BicicletasService } from './bicicletas.service.js';
import { CasillerosController } from './casilleros.controller.js';
import { CasillerosService } from './casilleros.service.js';
import { EncomiendasController } from './encomiendas.controller.js';
import { EncomiendasService } from './encomiendas.service.js';
import { InvitadosController } from './invitados.controller.js';
import { InvitadosService } from './invitados.service.js';
import { VehiculosController } from './vehiculos.controller.js';
import { VehiculosService } from './vehiculos.service.js';

/**
 * Porteria: lo que pasa por la puerta.
 *
 * Casilleros y encomiendas (lo que llega), invitados (quien puede entrar), y
 * vehiculos y bicicletas (que rueda y de quien es).
 *
 * Los vehiculos estan aqui y no en `instalaciones` porque el carro de un
 * residente NO es un bien del conjunto: es suyo. Lo que hace el conjunto con el
 * es dejarlo entrar, y eso es la puerta.
 *
 * Falta el control de ingreso —hora de entrada y salida, cupo asignado— y la
 * autorizacion de salida de enseres (ver docs/pendientes.md).
 */
@Module({
  controllers: [
    CasillerosController,
    EncomiendasController,
    InvitadosController,
    VehiculosController,
    BicicletasController,
  ],
  providers: [
    CasillerosService,
    EncomiendasService,
    InvitadosService,
    VehiculosService,
    BicicletasService,
  ],
})
export class PorteriaModule {}
