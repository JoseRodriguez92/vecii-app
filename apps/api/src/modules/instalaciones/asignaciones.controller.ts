import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { ConjuntoActivo as Ctx } from '../../auth/conjunto-activo.js';
import { ConjuntoActivo } from '../../common/decorators/conjunto-activo.decorator.js';
import { RequierePermiso } from '../../common/decorators/requiere-permiso.decorator.js';
import { PERMISOS } from '../../common/permisos.js';
import { AsignacionesService } from './asignaciones.service.js';
import { CerrarAsignacionDto, CrearAsignacionDto } from './dto/asignacion.dto.js';

@ApiTags('instalaciones · asignaciones parqueadero')
@ApiBearerAuth()
@Controller('parqueaderos/:parqueaderoId/asignaciones')
export class AsignacionesController {
  constructor(private readonly asignaciones: AsignacionesService) {}

  @Get()
  @RequierePermiso(PERMISOS.INSTALACIONES_LEER)
  @ApiQuery({ name: 'soloVigentes', required: false })
  @ApiOperation({
    summary: 'Quien ha tenido este cupo',
    description:
      'Historial completo por defecto, de lo mas reciente a lo mas viejo. La pregunta que llega ' +
      'de verdad es "de quien era este puesto el ano pasado", y por eso cerrar no borra.',
  })
  listar(
    @Param('parqueaderoId', ParseUUIDPipe) parqueaderoId: string,
    @ConjuntoActivo() a: Ctx,
    @Query('soloVigentes') soloVigentes?: string,
  ) {
    return this.asignaciones.listar(a.conjuntoId, parqueaderoId, soloVigentes === 'true');
  }

  @Post()
  @RequierePermiso(PERMISOS.INSTALACIONES_GESTIONAR)
  @ApiOperation({
    summary: 'Le da el cupo a una unidad',
    description:
      'El `origen` tiene que casar con la naturaleza del cupo: un `PRIVADO` no se sortea, un ' +
      '`ROTATIVO` no se compra, y un cupo de `VISITANTES` no se asigna en absoluto —se usa por ' +
      'turnos via reservas—. Si no casa, la respuesta dice por que en terminos del dominio. ' +
      'Un cupo admite una sola asignacion vigente: para pasarlo a otra unidad, primero se cierra.',
  })
  asignar(
    @Param('parqueaderoId', ParseUUIDPipe) parqueaderoId: string,
    @Body() dto: CrearAsignacionDto,
    @ConjuntoActivo() a: Ctx,
  ) {
    return this.asignaciones.asignar(a.conjuntoId, parqueaderoId, dto);
  }

  @Patch(':id')
  @RequierePermiso(PERMISOS.INSTALACIONES_GESTIONAR)
  @ApiOperation({
    summary: 'Cierra una asignacion',
    description:
      'Le pone `hasta` y la deja en el historial. No hay DELETE: cuando alguien reclame que ese ' +
      'cupo era suyo, esta fila es la respuesta.',
  })
  cerrar(
    @Param('parqueaderoId', ParseUUIDPipe) parqueaderoId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CerrarAsignacionDto,
    @ConjuntoActivo() a: Ctx,
  ) {
    return this.asignaciones.cerrar(a.conjuntoId, parqueaderoId, id, dto);
  }
}
