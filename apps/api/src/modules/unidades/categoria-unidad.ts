import { TipoUnidad } from '../../generated/prisma/enums.js';

/**
 * Agrupacion funcional de los tipos de unidad.
 *
 * La categoria NO se guarda en la base: se deriva. Es informacion redundante
 * —un APARTAMENTO siempre sera VIVIENDA— y guardar datos derivados es la forma
 * mas comun de terminar con dos verdades distintas.
 */
export const CategoriaUnidad = {
  VIVIENDA: 'VIVIENDA',
  COMERCIAL: 'COMERCIAL',
  ACCESORIA: 'ACCESORIA',
} as const;

export type CategoriaUnidad = (typeof CategoriaUnidad)[keyof typeof CategoriaUnidad];

const CATEGORIA_POR_TIPO: Record<TipoUnidad, CategoriaUnidad> = {
  APARTAMENTO: 'VIVIENDA',
  APARTAESTUDIO: 'VIVIENDA',
  CASA: 'VIVIENDA',
  DUPLEX: 'VIVIENDA',
  TRIPLEX: 'VIVIENDA',
  PENTHOUSE: 'VIVIENDA',

  LOCAL: 'COMERCIAL',
  OFICINA: 'COMERCIAL',
  CONSULTORIO: 'COMERCIAL',
  BODEGA: 'COMERCIAL',

  PARQUEADERO: 'ACCESORIA',
  DEPOSITO: 'ACCESORIA',
};

export function categoriaDe(tipo: TipoUnidad): CategoriaUnidad {
  return CATEGORIA_POR_TIPO[tipo];
}

/** Tipos de una categoria. Sirve para filtrar: `where: { tipo: { in: tiposDe('VIVIENDA') } }`. */
export function tiposDe(categoria: CategoriaUnidad): TipoUnidad[] {
  return Object.entries(CATEGORIA_POR_TIPO)
    .filter(([, c]) => c === categoria)
    .map(([t]) => t as TipoUnidad);
}
