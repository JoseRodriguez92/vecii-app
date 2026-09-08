import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../../auth/auth-user.js';
import type { ConjuntoActivo as Ctx } from '../../auth/conjunto-activo.js';
import { ConjuntoActivo } from '../../common/decorators/conjunto-activo.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { RequierePermiso } from '../../common/decorators/requiere-permiso.decorator.js';
import { PERMISOS } from '../../common/permisos.js';
import { AnularPagoDto, RegistrarPagoDto } from './dto/pago.dto.js';
import { PagosService } from './pagos.service.js';

@ApiTags('finanzas · pagos')
@ApiBearerAuth()
@Controller('pagos')
export class PagosController {
  constructor(private readonly pagos: PagosService) {}

  @Get()
  @RequierePermiso(PERMISOS.FINANZAS_LEER)
  @ApiQuery({ name: 'unidadId', required: false })
  @ApiQuery({ name: 'incluirAnulados', required: false })
  @ApiOperation({ summary: 'La plata que ha entrado' })
  listar(
    @ConjuntoActivo() a: Ctx,
    @Query('unidadId') unidadId?: string,
    @Query('incluirAnulados') incluirAnulados?: string,
  ) {
    return this.pagos.listar(a.conjuntoId, { unidadId, incluirAnulados: incluirAnulados === 'true' });
  }

  @Post()
  @RequierePermiso(PERMISOS.FINANZAS_GESTIONAR)
  @ApiOperation({
    summary: 'Registra un pago y lo aplica a las cuentas pendientes',
    description:
      'Vecii **registra, no recauda**: la plata va a la cuenta del conjunto y aqui se anota. El ' +
      'administrador la ve en el extracto y la digita.\n\n' +
      'Se aplica solo, **de la cuenta mas vieja a la mas nueva**. Si sobra —pago de mas— queda ' +
      'sin imputar, y eso es un saldo a favor que cubre la cuenta del mes siguiente.\n\n' +
      'La `referencia` es lo que impide que el mismo pago entre dos veces. Va con un unico por ' +
      '(conjunto, medio, referencia).',
  })
  registrar(@Body() dto: RegistrarPagoDto, @ConjuntoActivo() a: Ctx, @CurrentUser() user: AuthUser) {
    return this.pagos.registrar(a.conjuntoId, user.id, dto);
  }

  @Post(':id/anular')
  @RequierePermiso(PERMISOS.FINANZAS_GESTIONAR)
  @ApiOperation({
    summary: 'Anula un pago que reboto o se digito mal',
    description:
      'No lo borra: el pago existio y quedar sin rastro de el es peor. Sus imputaciones tampoco ' +
      'se borran — dejan de contar solas, porque el saldo solo mira las de pagos vigentes.\n\n' +
      'El motivo es obligatorio: sin el, dentro de un ano nadie sabe por que se cayo.',
  })
  anular(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AnularPagoDto, @ConjuntoActivo() a: Ctx) {
    return this.pagos.anular(a.conjuntoId, id, dto);
  }

  @Get(':id')
  @RequierePermiso(PERMISOS.FINANZAS_LEER, PERMISOS.FINANZAS_MI_UNIDAD)
  @ApiOperation({
    summary: 'Un pago, con las cuentas que cubrio',
    description:
      'Es a donde lleva el aviso de la campanita. Devuelve **404 si no puedes verlo**, no 403.',
  })
  obtener(
    @Param('id', ParseUUIDPipe) id: string,
    @ConjuntoActivo() a: Ctx,
    @CurrentUser() user: AuthUser,
  ) {
    return this.pagos.obtener(a, user.id, id);
  }
}
