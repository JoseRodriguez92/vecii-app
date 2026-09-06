import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../../auth/auth-user.js';
import type { ConjuntoActivo as Ctx } from '../../auth/conjunto-activo.js';
import { ConjuntoActivo } from '../../common/decorators/conjunto-activo.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { RequierePermiso } from '../../common/decorators/requiere-permiso.decorator.js';
import { PERMISOS } from '../../common/permisos.js';
import { EstadoReserva } from '../../generated/prisma/enums.js';
import { CancelarReservaDto, CrearReservaDto, RechazarReservaDto } from './dto/reserva.dto.js';
import { ReservasService } from './reservas.service.js';

@ApiTags('reservas')
@ApiBearerAuth()
@Controller('reservas')
export class ReservasController {
  constructor(private readonly reservas: ReservasService) {}

  @Get()
  @RequierePermiso(PERMISOS.RESERVAS_LEER)
  @ApiQuery({ name: 'espacioId', required: false })
  @ApiQuery({ name: 'unidadId', required: false })
  @ApiQuery({ name: 'estado', required: false, enum: EstadoReserva })
  @ApiQuery({ name: 'desde', required: false, example: '2026-09-01T00:00:00.000Z' })
  @ApiQuery({ name: 'hasta', required: false, example: '2026-10-01T00:00:00.000Z' })
  @ApiOperation({ summary: 'El calendario del conjunto' })
  listar(
    @ConjuntoActivo() a: Ctx,
    @Query('espacioId') espacioId?: string,
    @Query('unidadId') unidadId?: string,
    @Query('estado') estado?: EstadoReserva,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
  ) {
    return this.reservas.listar(a.conjuntoId, {
      espacioId,
      unidadId,
      estado,
      desde: desde ? new Date(desde) : undefined,
      hasta: hasta ? new Date(hasta) : undefined,
    });
  }

  // OJO: va ANTES de ':id', o Express lee "mias" como un id.
  @Get('mias')
  @RequierePermiso(PERMISOS.RESERVAS_CREAR, PERMISOS.RESERVAS_LEER)
  @ApiOperation({ summary: 'Las reservas de mis unidades' })
  mias(@ConjuntoActivo() a: Ctx, @CurrentUser() user: AuthUser) {
    return this.reservas.mias(a.conjuntoId, user.id);
  }

  @Post()
  @RequierePermiso(PERMISOS.RESERVAS_CREAR, PERMISOS.RESERVAS_ADMINISTRAR)
  @ApiOperation({
    summary: 'Aparta un espacio',
    description:
      'La reserva responde a la UNIDAD, no a la persona: los cargos y las sanciones van a la ' +
      'unidad, igual que la deuda. Un invitado no reserva —no tiene cuenta—; reserva el ' +
      'residente para su unidad.\n\n' +
      'Nace `CONFIRMADA`, o `SOLICITADA` si la politica pide aprobacion.\n\n' +
      'Valida, en este orden: que la unidad sea tuya, `soloPropietarios`, la anticipacion y la ' +
      'duracion, el horario de la zona comun, tus cupos por unidad, y por ultimo la capacidad. ' +
      'Esa ultima va dentro de un candado por espacio, para que dos residentes que aparten el ' +
      'ultimo cupo en el mismo segundo no lo consigan los dos.',
  })
  crear(@Body() dto: CrearReservaDto, @ConjuntoActivo() a: Ctx, @CurrentUser() user: AuthUser) {
    return this.reservas.crear(a, user.id, dto);
  }

  @Post(':id/aprobar')
  @RequierePermiso(PERMISOS.RESERVAS_ADMINISTRAR)
  @ApiOperation({ summary: 'Aprueba una reserva que esperaba visto bueno' })
  aprobar(
    @Param('id', ParseUUIDPipe) id: string,
    @ConjuntoActivo() a: Ctx,
    @CurrentUser() user: AuthUser,
  ) {
    return this.reservas.aprobar(a.conjuntoId, user.id, id);
  }

  @Post(':id/rechazar')
  @RequierePermiso(PERMISOS.RESERVAS_ADMINISTRAR)
  @ApiOperation({ summary: 'Rechaza una solicitud', description: 'El motivo queda guardado.' })
  rechazar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RechazarReservaDto,
    @ConjuntoActivo() a: Ctx,
    @CurrentUser() user: AuthUser,
  ) {
    return this.reservas.rechazar(a.conjuntoId, user.id, id, dto);
  }

  @Post(':id/cancelar')
  @RequierePermiso(PERMISOS.RESERVAS_CREAR, PERMISOS.RESERVAS_ADMINISTRAR)
  @ApiOperation({
    summary: 'Cancela una reserva',
    description:
      'Quien no administra solo cancela las de sus unidades, y respetando la antelacion ' +
      'minima del reglamento. Pasado ese plazo tiene que pedirselo a la administracion.',
  })
  cancelar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelarReservaDto,
    @ConjuntoActivo() a: Ctx,
    @CurrentUser() user: AuthUser,
  ) {
    return this.reservas.cancelar(a, user.id, id, dto);
  }

  @Post(':id/no-asistio')
  @RequierePermiso(PERMISOS.RESERVAS_ADMINISTRAR)
  @ApiOperation({
    summary: 'Reservo y no aparecio',
    description:
      'Se guarda porque muchos reglamentos sancionan la inasistencia reiterada, y sin el dato ' +
      'no hay como aplicarlo. Solo despues de que la franja termino.',
  })
  noAsistio(@Param('id', ParseUUIDPipe) id: string, @ConjuntoActivo() a: Ctx) {
    return this.reservas.marcarNoAsistio(a.conjuntoId, id);
  }
}
