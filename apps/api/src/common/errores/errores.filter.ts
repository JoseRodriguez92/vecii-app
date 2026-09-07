import { randomUUID } from 'node:crypto';
import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Prisma } from '../../generated/prisma/client.js';
import { traducirPrisma } from './traducir-prisma.js';

/**
 * El unico lugar donde una excepcion se vuelve una respuesta HTTP.
 *
 * Antes de esto, cualquier choque contra la base salia como 500 con el stack
 * adentro. Para la interfaz eso significaba que todo formulario que fallara
 * decia "algo salio mal", sin importar si el NIT estaba repetido o si la
 * unidad no existia. Una API que no explica sus rechazos obliga a adivinar.
 *
 * Tres caminos, y el orden importa:
 *
 * 1. `HttpException` pasa derecho. Los servicios ya lanzan mensajes buenos y en
 *    espanol; este filtro no tiene nada que mejorarles.
 * 2. Un error conocido de Prisma se traduce con `traducirPrisma`.
 * 3. Todo lo demas es un 500 con una **referencia**: al usuario le llega el
 *    codigo corto y nada mas; el error completo queda en el log con esa misma
 *    referencia. Asi se puede rastrear un reporte —"me salio el error 3f2a"—
 *    sin filtrarle a nadie una consulta SQL ni un nombre de tabla.
 */
@Catch()
export class ErroresFilter implements ExceptionFilter {
  private readonly logger = new Logger('Errores');

  catch(excepcion: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();
    const donde = `${req.method} ${req.originalUrl}`;

    // 1. Lo que ya sabe que es.
    if (excepcion instanceof HttpException) {
      return res.status(excepcion.getStatus()).json(cuerpoDe(excepcion));
    }

    // 2. Lo que viene de la base.
    if (excepcion instanceof Prisma.PrismaClientKnownRequestError) {
      const t = traducirPrisma({ code: excepcion.code, meta: excepcion.meta });

      if (t.esNuestra) {
        const referencia = corta();
        this.logger.error(`[${referencia}] ${donde} · Prisma ${excepcion.code}`, excepcion.stack);
        return res.status(t.status).json({
          statusCode: t.status,
          message: t.mensaje,
          error: HttpStatus[t.status] ?? 'Error',
          referencia,
        });
      }

      // Se registra igual, en nivel bajo: un 409 repetido cien veces al dia es
      // una pantalla mal hecha, y sin esta linea no hay como enterarse.
      this.logger.warn(`${donde} · Prisma ${excepcion.code}: ${t.mensaje}`);
      return res.status(t.status).json({
        statusCode: t.status,
        message: t.mensaje,
        error: HttpStatus[t.status] ?? 'Error',
        ...(t.campos ? { campos: t.campos } : {}),
      });
    }

    // Una consulta mal armada es un bug nuestro, no un dato malo del usuario.
    if (excepcion instanceof Prisma.PrismaClientValidationError) {
      const referencia = corta();
      this.logger.error(`[${referencia}] ${donde} · consulta invalida`, excepcion.message);
      return res.status(500).json({
        statusCode: 500,
        message: 'Error interno.',
        error: 'Internal Server Error',
        referencia,
      });
    }

    if (excepcion instanceof Prisma.PrismaClientInitializationError) {
      const referencia = corta();
      this.logger.error(`[${referencia}] ${donde} · no se pudo conectar a la base`, excepcion.message);
      return res.status(503).json({
        statusCode: 503,
        message: 'La base de datos no esta respondiendo. Intenta de nuevo en un momento.',
        error: 'Service Unavailable',
        referencia,
      });
    }

    // 3. Lo que no vimos venir.
    const referencia = corta();
    this.logger.error(
      `[${referencia}] ${donde} · error no manejado`,
      excepcion instanceof Error ? excepcion.stack : String(excepcion),
    );
    return res.status(500).json({
      statusCode: 500,
      message: 'Error interno.',
      error: 'Internal Server Error',
      referencia,
    });
  }
}

/** Ocho caracteres: suficiente para buscar en el log, corto para dictarlo por telefono. */
function corta(): string {
  return randomUUID().slice(0, 8);
}

/**
 * Nest guarda la respuesta de una `HttpException` como cadena o como objeto,
 * segun como se haya lanzado. Se normaliza para que el cliente reciba siempre
 * la misma forma.
 */
function cuerpoDe(e: HttpException) {
  const respuesta = e.getResponse();
  if (typeof respuesta === 'string') {
    return { statusCode: e.getStatus(), message: respuesta, error: e.name };
  }
  return respuesta;
}
