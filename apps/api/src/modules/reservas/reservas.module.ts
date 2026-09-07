import { Module } from '@nestjs/common';
import { CuposService } from './cupos.service.js';
import { EspaciosController } from './espacios.controller.js';
import { EspaciosService } from './espacios.service.js';
import { PoliticasController } from './politicas.controller.js';
import { PoliticasService } from './politicas.service.js';
import { ReservasController } from './reservas.controller.js';
import { ReservasService } from './reservas.service.js';

/**
 * Apartar cosas del conjunto. Cuatro piezas: QUE se puede apartar (espacios),
 * con QUE reglas (politicas), QUIEN aparto (reservas) y CUAL cupo le toco
 * cuando llego (cupos, que es porteria y no el residente).
 *
 * Lo fisico vive en `modules/instalaciones`. De ahi ya estan las zonas comunes
 * con sus horarios; faltan los parqueaderos, que hoy se cargan a mano.
 */
@Module({
  controllers: [EspaciosController, PoliticasController, ReservasController],
  providers: [EspaciosService, PoliticasService, ReservasService, CuposService],
})
export class ReservasModule {}
