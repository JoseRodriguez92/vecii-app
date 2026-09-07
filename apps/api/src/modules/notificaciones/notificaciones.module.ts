import { Global, Module } from '@nestjs/common';
import { DestinatariosService } from './destinatarios.service.js';
import { NotificacionesController } from './notificaciones.controller.js';
import { NotificacionesService } from './notificaciones.service.js';

/**
 * La campanita, y el servicio que la llena.
 *
 * Dos piezas: `NotificacionesService` decide QUE se guarda y como se ve, y
 * `DestinatariosService` decide QUIEN debe enterarse.
 *
 * Es `@Global` porque lo van a llamar casi todos los modulos —porteria,
 * reservas, y manana finanzas y asambleas— y hacer que cada uno lo importe seria
 * ruido sin ninguna ganancia.
 *
 * Aqui vive solo el aviso DENTRO de la app. Que el celular suene con la app
 * cerrada (push) y que el numero suba solo con la app abierta (SSE) son otras
 * dos cosas, van encima de esta tabla, y ninguna la cambia.
 */
@Global()
@Module({
  controllers: [NotificacionesController],
  providers: [NotificacionesService, DestinatariosService],
  exports: [NotificacionesService],
})
export class NotificacionesModule {}
