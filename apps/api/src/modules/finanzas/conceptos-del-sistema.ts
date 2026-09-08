import { CodigoConcepto, NaturalezaConcepto } from '../../generated/prisma/enums.js';

/**
 * Los conceptos que TODO conjunto necesita, y que el sistema genera solo.
 *
 * Es la misma idea que `ROLES_DEL_SISTEMA` en `common/roles.ts`: una plantilla,
 * no una tabla compartida. Cada conjunto recibe su copia al crearse y de ahi en
 * adelante son suyos — puede renombrarlos, ponerles tarifa, y agregar los que
 * quiera.
 *
 * Estos tres llevan `codigo` porque el codigo los menciona por nombre:
 * la facturacion mensual necesita saber donde poner la cuota, y el calculo de
 * mora donde poner el interes. Los que invente el conjunto —"Alquiler salon",
 * "Multa por ruido"— no llevan codigo, y por eso funcionan sin tocar nada.
 *
 * Ninguno trae tarifa: los tres se CALCULAN. La administracion sale del
 * presupuesto repartido; el interes, del saldo vencido y los dias. Un precio
 * fijo aqui seria mentira.
 */
export interface ConceptoDelSistema {
  codigo: CodigoConcepto;
  nombre: string;
  naturaleza: NaturalezaConcepto;
}

export const CONCEPTOS_DEL_SISTEMA: ConceptoDelSistema[] = [
  {
    codigo: CodigoConcepto.ADMINISTRACION,
    nombre: 'Administracion',
    naturaleza: NaturalezaConcepto.CARGO,
  },
  {
    codigo: CodigoConcepto.INTERES_MORA,
    nombre: 'Interes de mora',
    naturaleza: NaturalezaConcepto.CARGO,
  },
  {
    codigo: CodigoConcepto.CUOTA_EXTRAORDINARIA,
    nombre: 'Cuota extraordinaria',
    naturaleza: NaturalezaConcepto.CARGO,
  },
];
