import { describe, expect, it } from 'vitest';
import { EstadoConjunto } from '../generated/prisma/enums.js';
import { motivoParaNoEntrar } from './conjunto-operativo.js';

describe('si el conjunto deja entrar a su gente', () => {
  it('un conjunto activo deja entrar', () => {
    expect(motivoParaNoEntrar(EstadoConjunto.ACTIVO)).toBeNull();
  });

  it('uno en implementacion tambien: esta cargando datos, no castigado', () => {
    expect(motivoParaNoEntrar(EstadoConjunto.EN_IMPLEMENTACION)).toBeNull();
  });

  it('uno suspendido no, y dice a quien llamar', () => {
    const motivo = motivoParaNoEntrar(EstadoConjunto.SUSPENDIDO);
    expect(motivo).toContain('suspendido');
    expect(motivo).toContain('administracion');
  });

  it('uno cancelado tampoco', () => {
    expect(motivoParaNoEntrar(EstadoConjunto.CANCELADO)).toBeTruthy();
  });

  it('TODO estado esta decidido: uno nuevo sin decidir dejaria entrar a todos', () => {
    // El riesgo no es que rompa: es que no rompa. Un estado sin fila en el mapa
    // devuelve undefined, que no es null pero tampoco es un motivo, y la gente
    // de un conjunto recien inventado entra o no entra segun como se lea.
    for (const estado of Object.values(EstadoConjunto)) {
      const motivo = motivoParaNoEntrar(estado);
      expect(motivo === null || typeof motivo === 'string').toBe(true);
      expect(motivo).not.toBeUndefined();
    }
  });
});
