import { Module } from '@nestjs/common';
import { EspaciosController } from './espacios.controller.js';
import { EspaciosService } from './espacios.service.js';
import { PoliticasController } from './politicas.controller.js';
import { PoliticasService } from './politicas.service.js';
import { ReservasController } from './reservas.controller.js';
import { ReservasService } from './reservas.service.js';

/**
 * Apartar cosas del conjunto. Tres piezas: QUE se puede apartar (espacios), con
 * QUE reglas (politicas) y QUIEN aparto (reservas).
 *
 * Falta el inventario fisico —zonas comunes con sus horarios, y parqueaderos—
 * que hoy se carga a mano en la base.
 */
@Module({
  controllers: [EspaciosController, PoliticasController, ReservasController],
  providers: [EspaciosService, PoliticasService, ReservasService],
})
export class ReservasModule {}
