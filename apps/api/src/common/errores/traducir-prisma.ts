import { CHEQUEOS, UNICOS } from './mensajes-de-restriccion.js';

/**
 * Traduce una falla de la base a algo que un formulario pueda mostrar.
 *
 * Funcion pura: recibe el error tal como lo entrega Prisma y devuelve un
 * veredicto. Sin base y sin Nest, para poder probarla.
 *
 * ## Donde vive el dato (esto no es obvio)
 *
 * El proyecto usa `@prisma/adapter-pg`. Con un driver adapter, Prisma NO llena
 * `meta.target` —eso es de los motores nativos, y es lo que dice casi todo lo
 * que uno encuentra escrito—. Lo que llega es:
 *
 *     meta.driverAdapterError.cause = {
 *       kind: 'UniqueConstraintViolation',
 *       constraint: { index: 'conjuntos_nit_key' },   // o { fields: [...] }
 *       originalCode: '23505',
 *       originalMessage: '...',
 *     }
 *
 * Y como Postgres siempre reporta el nombre de la restriccion en un 23505, en
 * la practica siempre llega `constraint.index`. De ahi que la traduccion se
 * haga por NOMBRE DE INDICE y no por columna.
 *
 * Otro detalle que solo se ve midiendo: una violacion de CHECK no tiene codigo
 * propio de Prisma. Cae al saco generico y llega como P2039 con
 * `originalCode: '23514'`, y el nombre del CHECK solo esta dentro del mensaje.
 */

export interface FallaDeBase {
  /** El codigo de Prisma: P2002, P2003, P2025... */
  code: string;
  meta?: Record<string, unknown>;
}

export interface Traduccion {
  status: number;
  mensaje: string;
  /** Campos en conflicto, en camelCase, para que la pantalla los resalte. */
  campos?: string[];
  /** true cuando la culpa es nuestra: se registra completo y no se explica afuera. */
  esNuestra?: boolean;
}

interface CausaDelAdaptador {
  kind?: string;
  constraint?: { index?: string; fields?: string[] };
  column?: string;
  originalCode?: string;
  originalMessage?: string;
}

function causaDe(meta: Record<string, unknown>): CausaDelAdaptador {
  const envoltorio = meta.driverAdapterError as { cause?: CausaDelAdaptador } | undefined;
  return envoltorio?.cause ?? {};
}

/** `new row ... violates check constraint "encomienda_destino_unico"` */
function chequeoDelMensaje(mensaje?: string): string | undefined {
  return mensaje?.match(/check constraint "([^"]+)"/)?.[1];
}

/** `numero_documento` -> `numeroDocumento`, para hablarle a la pantalla en sus terminos. */
function aCamel(columna: string): string {
  return columna.replace(/_([a-z])/g, (_, letra: string) => letra.toUpperCase());
}

export function traducirPrisma(falla: FallaDeBase): Traduccion {
  const meta = falla.meta ?? {};
  const causa = causaDe(meta);

  // Un CHECK no tiene codigo propio: llega como error generico de Postgres.
  // Se mira primero porque el codigo de Prisma no alcanza para reconocerlo.
  if (causa.originalCode === '23514') {
    const nombre = chequeoDelMensaje(causa.originalMessage);
    const propio = nombre ? CHEQUEOS[nombre] : undefined;
    if (propio) return { status: 409, mensaje: propio };
    return { status: 409, mensaje: 'Esa combinacion de datos no es valida.' };
  }

  switch (falla.code) {
    // Unicidad: dos veces el mismo NIT, la misma placa, el mismo documento.
    case 'P2002': {
      const indice = causa.constraint?.index;
      const conocido = indice ? UNICOS[indice] : undefined;
      if (conocido) {
        return {
          status: 409,
          mensaje: conocido.mensaje,
          ...(conocido.campos ? { campos: conocido.campos } : {}),
        };
      }

      // Sin nombre de indice, Postgres si manda las columnas.
      const columnas = causa.constraint?.fields;
      if (columnas?.length) {
        return {
          status: 409,
          mensaje: 'Ya existe un registro con esos datos.',
          campos: columnas.map(aCamel),
        };
      }

      // Un indice sin mensaje. `verificar-errores.mjs` existe para que esto no
      // pase, asi que si pasa es que alguien lo agrego sin pasar por el lint.
      return { status: 409, mensaje: 'Ya existe un registro con esos datos.' };
    }

    // Llave foranea, y tambien RESTRICT. En este schema casi todo borra en
    // cascada, asi que cuando salta suele ser un id que no existe.
    case 'P2003': {
      const columna = causa.constraint?.fields?.[0];
      return {
        status: 409,
        mensaje: 'Eso apunta a algo que no existe, o hay informacion que depende de ello.',
        ...(columna ? { campos: [aCamel(columna)] } : {}),
      };
    }

    // Relacion obligatoria que quedaria rota.
    case 'P2014':
      return {
        status: 409,
        mensaje: 'No se puede: hay informacion que depende de esto y quedaria colgando.',
      };

    // update o delete sobre algo que no esta.
    case 'P2025':
      return { status: 404, mensaje: 'No se encontro lo que ibas a modificar.' };

    // Texto mas largo que la columna.
    case 'P2000': {
      const columna = causa.column;
      return {
        status: 400,
        mensaje: columna
          ? `El campo ${aCamel(columna)} es demasiado largo.`
          : 'Uno de los campos es demasiado largo.',
        ...(columna ? { campos: [aCamel(columna)] } : {}),
      };
    }

    // NOT NULL que el DTO no alcanzo a exigir.
    case 'P2011': {
      const columnas = causa.constraint?.fields ?? [];
      return {
        status: 400,
        mensaje: 'Falta un dato obligatorio.',
        ...(columnas.length ? { campos: columnas.map(aCamel) } : {}),
      };
    }

    // Numero fuera del rango de la columna.
    case 'P2020':
      return { status: 400, mensaje: 'Ese valor esta fuera del rango permitido.' };

    // Dos transacciones que se pisaron. Reintentar sirve; es lo unico que sirve.
    case 'P2034':
      return {
        status: 409,
        mensaje: 'Otra operacion se adelanto. Intenta de nuevo.',
      };

    // La base no responde. No es culpa de quien llama, pero tampoco es un bug.
    case 'P1000':
    case 'P1001':
    case 'P1002':
    case 'P1008':
    case 'P1010':
    case 'P1011':
    case 'P1017':
    case 'P2037':
      return {
        status: 503,
        mensaje: 'La base de datos no esta respondiendo. Intenta de nuevo en un momento.',
        esNuestra: true,
      };

    // Tabla o columna que no existe: falta correr una migracion. Es nuestro.
    case 'P2021':
    case 'P2022':
      return { status: 500, mensaje: 'Error interno.', esNuestra: true };

    default:
      return { status: 500, mensaje: 'Error interno.', esNuestra: true };
  }
}
