import { Module } from '@nestjs/common';
import { ConceptosController } from './conceptos.controller.js';
import { ConceptosService } from './conceptos.service.js';
import { CuentasController } from './cuentas.controller.js';
import { CuentasService } from './cuentas.service.js';
import { FacturacionService } from './facturacion.service.js';

/**
 * Que se le cobra a cada unidad y con que plata se cubrio.
 *
 * Tres piezas y cada una responde algo distinto: `conceptos` que se puede
 * cobrar, `facturacion` que se cobra este mes, y `cuentas` como va la cosa.
 * Falta registrar pagos e imputarlos.
 *
 * La plantilla de los tres conceptos que el sistema genera vive en
 * `conceptos-del-sistema.ts`, y la siembra la dispara `conjuntos/siembra.ts` al
 * crear el conjunto: quien decide CUANDO es el modulo de conjuntos, quien decide
 * QUE es este.
 */
@Module({
  controllers: [ConceptosController, CuentasController],
  providers: [ConceptosService, CuentasService, FacturacionService],
})
export class FinanzasModule {}
