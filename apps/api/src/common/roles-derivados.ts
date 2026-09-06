import { RelacionUnidad } from '../generated/prisma/enums.js';
import { ROL } from './roles.js';

/**
 * Rol que se deriva de tener una unidad. No se asigna: se es.
 *
 * Un arrendatario y un residente autorizado son ambos RESIDENTE de cara a los
 * permisos —pueden reservar el salon, ver la cartelera—; lo que los distingue
 * (quien firma, quien responde por la unidad) es la `relacion`, no el rol.
 */
const ROL_POR_RELACION: Record<RelacionUnidad, string> = {
  PROPIETARIO: ROL.PROPIETARIO,
  ARRENDATARIO: ROL.RESIDENTE,
  RESIDENTE_AUTORIZADO: ROL.RESIDENTE,
};

export function rolDeRelacion(relacion: RelacionUnidad): string {
  return ROL_POR_RELACION[relacion];
}
