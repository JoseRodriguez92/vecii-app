import { applyDecorators, SetMetadata } from '@nestjs/common';
import { ApiForbiddenResponse, ApiHeader, ApiUnauthorizedResponse } from '@nestjs/swagger';
import type { CodigoPermiso } from '../permisos.js';

export const PERMISOS_KEY = 'permisos';

/**
 * Declara QUE HACE el endpoint, no quien puede hacerlo.
 *
 * Quien puede es una decision de configuracion —vive en `roles_permisos` y se
 * edita desde la interfaz—, no una decision de codigo.
 *
 * Ademas de registrar el permiso para el guard, documenta en Swagger la
 * cabecera `x-conjunto-id` y que permiso exige. Sin esto, quien prueba desde
 * Swagger recibe "Falta la cabecera x-conjunto-id" sin ninguna pista.
 *
 * Basta con tener UNO de los permisos listados.
 */
export const RequierePermiso = (...permisos: CodigoPermiso[]) =>
  applyDecorators(
    SetMetadata(PERMISOS_KEY, permisos),
    ApiHeader({
      name: 'x-conjunto-id',
      required: true,
      description: 'UUID del conjunto sobre el que se opera.',
    }),
    ApiUnauthorizedResponse({ description: 'Token invalido o expirado.' }),
    ApiForbiddenResponse({
      description: `Requiere el permiso: ${permisos.join(' o ')}`,
    }),
  );
