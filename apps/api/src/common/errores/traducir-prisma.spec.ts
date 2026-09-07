import { describe, expect, it } from 'vitest';
import { traducirPrisma } from './traducir-prisma.js';

/**
 * Los errores de abajo tienen la forma REAL que entrega `@prisma/adapter-pg`,
 * medida contra el codigo del adaptador. No es la forma que aparece en la
 * documentacion: con un driver adapter no existe `meta.target`, y una prueba
 * escrita con esa forma pasaria aqui y fallaria en produccion.
 */
const unico = (indice: string) => ({
  code: 'P2002',
  meta: {
    table: 'lo_que_sea',
    driverAdapterError: {
      cause: {
        kind: 'UniqueConstraintViolation',
        constraint: { index: indice },
        originalCode: '23505',
      },
    },
  },
});

const chequeo = (nombre: string) => ({
  code: 'P2039',
  meta: {
    driverAdapterError: {
      cause: {
        kind: 'postgres',
        originalCode: '23514',
        originalMessage: `new row for relation "encomiendas" violates check constraint "${nombre}"`,
      },
    },
  },
});

describe('unicidad', () => {
  it('traduce el indice a lo que el administrador necesita leer', () => {
    const t = traducirPrisma(unico('conjuntos_nit_key'));
    expect(t.status).toBe(409);
    expect(t.mensaje).toContain('NIT');
    expect(t.campos).toEqual(['nit']);
  });

  it('devuelve los campos en camelCase, como los DTO', () => {
    const t = traducirPrisma(unico('usuarios_tipo_documento_numero_documento_key'));
    expect(t.campos).toEqual(['tipoDocumento', 'numeroDocumento']);
  });

  it('explica los indices parciales que escribimos a mano', () => {
    expect(traducirPrisma(unico('vehiculo_placa_vigente_unica')).mensaje).toContain('placa');
    expect(traducirPrisma(unico('bicicleta_serial_vigente_unico')).mensaje).toContain('serial');
  });

  it('sin nombre de indice usa las columnas que manda Postgres', () => {
    const t = traducirPrisma({
      code: 'P2002',
      meta: { driverAdapterError: { cause: { constraint: { fields: ['numero_documento'] } } } },
    });
    expect(t.status).toBe(409);
    expect(t.campos).toEqual(['numeroDocumento']);
  });

  it('un indice sin mensaje no revienta: responde 409 generico', () => {
    const t = traducirPrisma(unico('indice_que_nadie_tradujo'));
    expect(t.status).toBe(409);
    expect(t.esNuestra).toBeUndefined();
  });
});

describe('los CHECK, que no tienen codigo propio de Prisma', () => {
  it('reconoce el CHECK por su nombre dentro del mensaje de Postgres', () => {
    const t = traducirPrisma(chequeo('encomienda_destino_unico'));
    expect(t.status).toBe(409);
    expect(t.mensaje).toContain('unidad o para una agrupacion');
  });

  it('un CHECK desconocido sigue siendo 409, no un 500', () => {
    const t = traducirPrisma(chequeo('algo_que_no_esta'));
    expect(t.status).toBe(409);
    expect(t.esNuestra).toBeUndefined();
  });
});

describe('el resto de la familia', () => {
  it('lo que no existe es 404, no 500', () => {
    expect(traducirPrisma({ code: 'P2025' }).status).toBe(404);
  });

  it('una llave foranea rota nombra el campo', () => {
    const t = traducirPrisma({
      code: 'P2003',
      meta: { driverAdapterError: { cause: { constraint: { fields: ['unidad_id'] } } } },
    });
    expect(t.status).toBe(409);
    expect(t.campos).toEqual(['unidadId']);
  });

  it('la base caida es 503 y es nuestra, no del usuario', () => {
    const t = traducirPrisma({ code: 'P1001' });
    expect(t.status).toBe(503);
    expect(t.esNuestra).toBe(true);
  });

  it('un codigo desconocido es 500 marcado como nuestro: se registra y no se explica', () => {
    const t = traducirPrisma({ code: 'P9999' });
    expect(t.status).toBe(500);
    expect(t.esNuestra).toBe(true);
    expect(t.mensaje).toBe('Error interno.');
  });

  it('nunca deja pasar el mensaje crudo de Postgres', () => {
    const t = traducirPrisma({
      code: 'P2039',
      meta: {
        driverAdapterError: {
          cause: { originalCode: '42601', originalMessage: 'syntax error at or near "SELECT"' },
        },
      },
    });
    expect(t.mensaje).not.toContain('SELECT');
    expect(t.esNuestra).toBe(true);
  });
});
