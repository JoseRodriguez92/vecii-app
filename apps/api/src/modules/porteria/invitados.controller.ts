import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../../auth/auth-user.js';
import type { ConjuntoActivo as Ctx } from '../../auth/conjunto-activo.js';
import { ConjuntoActivo } from '../../common/decorators/conjunto-activo.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { RequierePermiso } from '../../common/decorators/requiere-permiso.decorator.js';
import { PERMISOS } from '../../common/permisos.js';
import { ActualizarInvitadoDto, AutorizarInvitadoDto } from './dto/invitado.dto.js';
import { InvitadosService } from './invitados.service.js';

@ApiTags('porteria · invitados')
@ApiBearerAuth()
@Controller('invitados')
export class InvitadosController {
  constructor(private readonly invitados: InvitadosService) {}

  @Get()
  @RequierePermiso(PERMISOS.PORTERIA_LEER)
  @ApiQuery({ name: 'unidadId', required: false })
  @ApiQuery({ name: 'incluirVencidos', required: false, description: 'Por defecto solo vigentes.' })
  @ApiOperation({
    summary: 'Quien puede entrar al conjunto',
    description:
      'La lista de porteria. Por defecto solo los vigentes: los que ya empezaron y no han ' +
      'terminado. Los permanentes —la empleada— no tienen `hasta` y salen siempre.',
  })
  listar(
    @ConjuntoActivo() a: Ctx,
    @Query('unidadId') unidadId?: string,
    @Query('incluirVencidos') incluirVencidos?: string,
  ) {
    return this.invitados.listar(a.conjuntoId, {
      unidadId,
      incluirVencidos: incluirVencidos === 'true',
    });
  }

  // OJO: va ANTES de ':id', o Express lee "mios" como un id.
  @Get('mios')
  @RequierePermiso(PERMISOS.PORTERIA_INVITADOS_MI_UNIDAD, PERMISOS.PORTERIA_LEER)
  @ApiQuery({ name: 'incluirVencidos', required: false })
  @ApiOperation({ summary: 'Los invitados de mis unidades' })
  mios(
    @ConjuntoActivo() a: Ctx,
    @CurrentUser() user: AuthUser,
    @Query('incluirVencidos') incluirVencidos?: string,
  ) {
    return this.invitados.mios(a.conjuntoId, user.id, incluirVencidos === 'true');
  }

  // Va DESPUES de 'mios': ':id' se tragaria "mios" si se declarara antes.
  @Get(':id')
  @RequierePermiso(PERMISOS.PORTERIA_LEER, PERMISOS.PORTERIA_INVITADOS_MI_UNIDAD)
  @ApiOperation({
    summary: 'Un invitado',
    description:
      'Es a donde lleva un aviso de la campanita: la notificacion guarda ' +
      '`entidad: "invitado"` y su id, y esta es la ruta que lo resuelve.\n\n' +
      'Porteria ve cualquiera del conjunto; el residente solo los de sus unidades — la misma ' +
      'regla que `GET /invitados/mios`.\n\n' +
      'Devuelve **404 si no puedes verlo**, no 403: un 403 confirmaria que el id existe.',
  })
  obtener(
    @Param('id', ParseUUIDPipe) id: string,
    @ConjuntoActivo() a: Ctx,
    @CurrentUser() user: AuthUser,
  ) {
    return this.invitados.obtener(a, user.id, id);
  }

  @Post()
  @RequierePermiso(PERMISOS.PORTERIA_INVITADOS_GESTIONAR, PERMISOS.PORTERIA_INVITADOS_MI_UNIDAD)
  @ApiOperation({
    summary: 'Autoriza a alguien a entrar',
    description:
      '**Omitir `hasta` para una autorizacion permanente** —la empleada, el profesor de la ' +
      'nina—; con fecha es puntual. Es el mismo desde/hasta de `usuarios_unidades`: quien vive ' +
      'ahi y quien puede entrar se modelan igual.\n\n' +
      'Con `porteria.invitados.gestionar` se autoriza en cualquier unidad. Con ' +
      '`porteria.invitados.mi_unidad` solo en las propias, y basta con **vivir** ahi: un ' +
      'arrendatario invita a su mama igual que un dueno.\n\n' +
      'No lleva hora de entrada ni de salida: todavia no hay control de ingreso en porteria.',
  })
  autorizar(
    @Body() dto: AutorizarInvitadoDto,
    @ConjuntoActivo() a: Ctx,
    @CurrentUser() user: AuthUser,
  ) {
    return this.invitados.autorizar(a, user.id, dto);
  }

  @Patch(':id')
  @RequierePermiso(PERMISOS.PORTERIA_INVITADOS_GESTIONAR, PERMISOS.PORTERIA_INVITADOS_MI_UNIDAD)
  @ApiOperation({
    summary: 'Corrige los datos o la vigencia',
    description: 'La unidad no se cambia: si se equivocaron de unidad, se revoca y se crea otra.',
  })
  actualizar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarInvitadoDto,
    @ConjuntoActivo() a: Ctx,
    @CurrentUser() user: AuthUser,
  ) {
    return this.invitados.actualizar(a, user.id, id, dto);
  }

  @Delete(':id')
  @RequierePermiso(PERMISOS.PORTERIA_INVITADOS_GESTIONAR, PERMISOS.PORTERIA_INVITADOS_MI_UNIDAD)
  @ApiOperation({
    summary: 'Revoca la autorizacion',
    description:
      'NO borra la fila: le pone `hasta`. Hace falta poder responder "quien tenia permitido ' +
      'entrar en marzo", que es lo que se pregunta cuando algo pasa.',
  })
  revocar(
    @Param('id', ParseUUIDPipe) id: string,
    @ConjuntoActivo() a: Ctx,
    @CurrentUser() user: AuthUser,
  ) {
    return this.invitados.revocar(a, user.id, id);
  }
}
