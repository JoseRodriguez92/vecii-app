import {
  BadRequestException,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../../auth/auth-user.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { NotificacionesService } from './notificaciones.service.js';

/**
 * La campanita.
 *
 * Estos endpoints NO llevan `@RequierePermiso`, y es a proposito: las
 * notificaciones de alguien son suyas. Un permiso implicaria que la
 * administracion puede quitarle a un residente el derecho a ver sus propios
 * avisos, y eso no significa nada.
 *
 * Lo que si hace falta es identidad, y de eso ya se encarga el guard de
 * autenticacion. El conjunto se lee de la cabecera; el filtro va por `usuarioId`
 * antes que por nada mas, asi que una cabecera ajena no muestra nada de nadie.
 */
@ApiTags('notificaciones')
@ApiBearerAuth()
@ApiHeader({ name: 'x-conjunto-id', required: true })
@Controller('notificaciones')
export class NotificacionesController {
  constructor(private readonly notificaciones: NotificacionesService) {}

  @Get()
  @ApiQuery({ name: 'soloSinLeer', required: false })
  @ApiQuery({ name: 'limite', required: false, description: 'Maximo 100. Por defecto 50.' })
  @ApiQuery({
    name: 'todosLosConjuntos',
    required: false,
    description:
      'Mezcla los avisos de todos los conjuntos donde esta la persona, cada uno con el nombre ' +
      'del suyo. Para quien tiene apartamento en dos.',
  })
  @ApiOperation({
    summary: 'Mis avisos, con el contador',
    description:
      'Devuelve `sinLeer` —el numerito rojo del conjunto activo—, `sinLeerEnOtros` y la lista, ' +
      'de lo mas reciente a lo mas viejo.\n\n' +
      '`sinLeerEnOtros` existe porque una misma persona puede tener apartamento en dos ' +
      'conjuntos que usan Vecii. Sin ese numero, un paquete que llega al otro no se ve por ' +
      'ningun lado hasta que se cambie de conjunto — y un aviso que no llega no es un aviso.\n\n' +
      'Solo aparecen los que YA se ven. Un recordatorio de reserva se crea al reservar pero ' +
      'queda programado: existe en la base desde ese momento y entra a la lista solo cuando ' +
      'llega su hora. Por eso la campanita no necesita ninguna tarea programada detras.',
  })
  listar(
    @CurrentUser() user: AuthUser,
    @Headers('x-conjunto-id') conjuntoId: string,
    @Query('soloSinLeer') soloSinLeer?: string,
    @Query('limite') limite?: string,
    @Query('todosLosConjuntos') todosLosConjuntos?: string,
  ) {
    return this.notificaciones.listar(user.id, this.exigirConjunto(conjuntoId), {
      soloSinLeer: soloSinLeer === 'true',
      limite: limite ? Number(limite) : undefined,
      todosLosConjuntos: todosLosConjuntos === 'true',
    });
  }

  @Patch(':id/leida')
  @ApiOperation({
    summary: 'Marca un aviso como leido',
    description: 'Solo los propios. Marcar uno ya leido no cambia la fecha: se leyo cuando se leyo.',
  })
  marcarLeida(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.notificaciones.marcarLeida(user.id, id);
  }

  @Post('leidas')
  @ApiOperation({
    summary: 'Marca todas como leidas',
    description: 'El boton de "limpiar" de la campanita. Solo las que ya se veian.',
  })
  marcarTodas(@CurrentUser() user: AuthUser, @Headers('x-conjunto-id') conjuntoId: string) {
    return this.notificaciones.marcarTodasLeidas(user.id, this.exigirConjunto(conjuntoId));
  }

  private exigirConjunto(conjuntoId?: string): string {
    if (!conjuntoId) throw new BadRequestException('Falta la cabecera x-conjunto-id');
    return conjuntoId;
  }
}
