import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../../auth/auth-user.js';
import type { ConjuntoActivo as Ctx } from '../../auth/conjunto-activo.js';
import { ConjuntoActivo } from '../../common/decorators/conjunto-activo.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { RequierePermiso } from '../../common/decorators/requiere-permiso.decorator.js';
import { PERMISOS } from '../../common/permisos.js';
import { EstadoEncomienda } from '../../generated/prisma/enums.js';
import {
  DevolverDto,
  EntregarDto,
  RegistrarEncomiendaDto,
  RegistrarEncomiendaMasivaDto,
} from './dto/encomienda.dto.js';
import { EncomiendasService } from './encomiendas.service.js';

@ApiTags('porteria · encomiendas')
@ApiBearerAuth()
@Controller('encomiendas')
export class EncomiendasController {
  constructor(private readonly encomiendas: EncomiendasService) {}

  @Get()
  @RequierePermiso(PERMISOS.PORTERIA_LEER)
  @ApiQuery({ name: 'estado', required: false, enum: EstadoEncomienda })
  @ApiQuery({ name: 'unidadId', required: false })
  @ApiQuery({ name: 'casilleroId', required: false })
  @ApiOperation({
    summary: 'La bandeja de porteria',
    description:
      'Todo lo del conjunto. Lo que sigue en custodia es `estado=RECIBIDA` o `NOTIFICADA`; ' +
      'un paquete viejo sin retirar sale de cruzar `recibidaEn` con esos dos estados — no hay ' +
      'un estado "vencida" porque eso se deriva.',
  })
  listar(
    @ConjuntoActivo() a: Ctx,
    @Query('estado') estado?: EstadoEncomienda,
    @Query('unidadId') unidadId?: string,
    @Query('casilleroId') casilleroId?: string,
  ) {
    return this.encomiendas.listar(a.conjuntoId, { estado, unidadId, casilleroId });
  }

  // OJO: va ANTES de cualquier ruta con ':id', o Express lee "mias" como un id.
  @Get('mias')
  @RequierePermiso(PERMISOS.PORTERIA_ENCOMIENDAS_MI_UNIDAD, PERMISOS.PORTERIA_LEER)
  @ApiOperation({
    summary: 'Lo que le ha llegado al residente',
    description:
      'Tres cosas: las encomiendas de sus unidades, las que llegaron para su torre o etapa ' +
      '(subiendo por las agrupaciones padre) y las que llegaron para todo el conjunto.',
  })
  mias(@ConjuntoActivo() a: Ctx, @CurrentUser() user: AuthUser) {
    return this.encomiendas.misEntregas(a.conjuntoId, user.id);
  }

  @Post()
  @RequierePermiso(PERMISOS.PORTERIA_ENCOMIENDAS_REGISTRAR)
  @ApiOperation({
    summary: 'Registra algo que llego para una unidad',
    description:
      'Nace `NOTIFICADA` si la unidad tiene usuarios registrados, y `RECIBIDA` si no hay a ' +
      'quien avisarle todavia. Esa diferencia importa: un paquete sin avisar y uno avisado ' +
      'que nadie recoge son problemas distintos.',
  })
  registrar(
    @Body() dto: RegistrarEncomiendaDto,
    @ConjuntoActivo() a: Ctx,
    @CurrentUser() user: AuthUser,
  ) {
    return this.encomiendas.registrar(a.conjuntoId, user.id, dto);
  }

  @Post('masiva')
  @RequierePermiso(PERMISOS.PORTERIA_ENCOMIENDAS_REGISTRAR)
  @ApiOperation({
    summary: 'Registra un reparto masivo',
    description:
      'Llego lo mismo para toda una torre o para todo el conjunto: los recibos del agua, la ' +
      'circular de la administracion. Es UNA fila, no una por unidad — el hecho es "llego para ' +
      'la Torre 1". Nace `NOTIFICADA` porque no hay nada que entregar en mano.',
  })
  registrarMasiva(
    @Body() dto: RegistrarEncomiendaMasivaDto,
    @ConjuntoActivo() a: Ctx,
    @CurrentUser() user: AuthUser,
  ) {
    return this.encomiendas.registrarMasiva(a.conjuntoId, user.id, dto);
  }

  @Post(':id/notificar')
  @RequierePermiso(PERMISOS.PORTERIA_ENCOMIENDAS_REGISTRAR)
  @ApiOperation({
    summary: 'Avisa (o vuelve a avisar) al residente',
    description:
      'Para la encomienda que nacio sin destinatarios y ya tiene a quien avisarle, y para ' +
      'insistir cuando lleva semanas sin que nadie baje.',
  })
  notificar(@Param('id', ParseUUIDPipe) id: string, @ConjuntoActivo() a: Ctx) {
    return this.encomiendas.notificar(a.conjuntoId, id);
  }

  @Post(':id/entregar')
  @RequierePermiso(PERMISOS.PORTERIA_ENCOMIENDAS_REGISTRAR)
  @ApiOperation({
    summary: 'Anota quien la retiro',
    description: 'Este es el dato que zanja el "yo nunca recibi nada".',
  })
  entregar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: EntregarDto,
    @ConjuntoActivo() a: Ctx,
    @CurrentUser() user: AuthUser,
  ) {
    return this.encomiendas.entregar(a.conjuntoId, user.id, id, dto);
  }

  @Post(':id/devolver')
  @RequierePermiso(PERMISOS.PORTERIA_ENCOMIENDAS_REGISTRAR)
  @ApiOperation({ summary: 'Se devolvio al mensajero o al remitente' })
  devolver(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DevolverDto,
    @ConjuntoActivo() a: Ctx,
    @CurrentUser() user: AuthUser,
  ) {
    return this.encomiendas.devolver(a.conjuntoId, user.id, id, dto);
  }
}
