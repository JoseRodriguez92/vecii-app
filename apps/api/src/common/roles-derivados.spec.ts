import { describe, expect, it } from 'vitest';
import { RelacionUnidad } from '../generated/prisma/enums.js';
import { rolDeRelacion } from './roles-derivados.js';
import { ROL } from './roles.js';

describe('el rol que se deriva de tener una unidad', () => {
  it('el dueno es PROPIETARIO', () => {
    expect(rolDeRelacion(RelacionUnidad.PROPIETARIO)).toBe(ROL.PROPIETARIO);
  });

  it('quien arrienda y quien vive autorizado son ambos RESIDENTE', () => {
    // Lo que los distingue —quien firma, quien responde por la unidad— es la
    // relacion, no el rol: los dos reservan el salon igual.
    expect(rolDeRelacion(RelacionUnidad.ARRENDATARIO)).toBe(ROL.RESIDENTE);
    expect(rolDeRelacion(RelacionUnidad.RESIDENTE_AUTORIZADO)).toBe(ROL.RESIDENTE);
  });

  it('TODA relacion tiene rol: una nueva sin mapear dejaria a esa gente sin permisos', () => {
    // Esta es la que importa. Agregar un valor al enum y olvidar el mapa no
    // rompe la compilacion en tiempo de ejecucion: simplemente esas personas
    // entran sin poder hacer nada, y nadie sabe por que.
    for (const relacion of Object.values(RelacionUnidad)) {
      expect(rolDeRelacion(relacion)).toBeTruthy();
    }
  });
});
