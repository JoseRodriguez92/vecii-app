import { Module } from '@nestjs/common';
import { ConceptosController } from './conceptos.controller.js';
import { ConceptosService } from './conceptos.service.js';

/**
 * Que se le cobra a cada unidad y con que plata se cubrio.
 *
 * Por ahora solo el catalogo de conceptos. Lo que sigue —emitir las cuentas del
 * mes, registrar pagos e imputarlos— se apoya en el, porque un cobro sin
 * concepto no se puede leer.
 *
 * La plantilla de los tres conceptos que el sistema genera vive en
 * `conceptos-del-sistema.ts`, y la siembra la dispara `conjuntos/siembra.ts` al
 * crear el conjunto: quien decide CUANDO es el modulo de conjuntos, quien decide
 * QUE es este.
 */
@Module({
  controllers: [ConceptosController],
  providers: [ConceptosService],
})
export class FinanzasModule {}
