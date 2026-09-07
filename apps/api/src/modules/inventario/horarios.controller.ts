import { Body, Controller, Get, Param, ParseUUIDPipe, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { ConjuntoActivo as Ctx } from '../../auth/conjunto-activo.js';
import { ConjuntoActivo } from '../../common/decorators/conjunto-activo.decorator.js';
import { RequierePermiso } from '../../common/decorators/requiere-permiso.decorator.js';
import { PERMISOS } from '../../common/permisos.js';
import { ReemplazarHorariosDto } from './dto/horario.dto.js';
import { HorariosService } from './horarios.service.js';

@ApiTags('inventario · horarios zona comun')
@ApiBearerAuth()
@Controller('zonas-comunes/:zonaId/horarios')
export class HorariosController {
  constructor(private readonly horarios: HorariosService) {}

  @Get()
  @RequierePermiso(PERMISOS.INVENTARIO_LEER)
  @ApiOperation({
    summary: 'A que horas abre',
    description:
      'Una fila por franja. Un dia SIN filas esta cerrado, y varias filas del mismo dia son un ' +
      'horario partido. Cada franja trae la hora en minutos desde medianoche y tambien escrita.',
  })
  listar(@Param('zonaId', ParseUUIDPipe) zonaId: string, @ConjuntoActivo() a: Ctx) {
    return this.horarios.listar(a.conjuntoId, zonaId);
  }

  @Put()
  @RequierePermiso(PERMISOS.INVENTARIO_GESTIONAR)
  @ApiOperation({
    summary: 'Reemplaza la semana entera',
    description:
      'No hay POST ni DELETE de una franja suelta: la pantalla que edita esto es un horario ' +
      'semanal completo, y guardarlo en pedazos deja medias semanas si el usuario se va. ' +
      'Mandar `franjas: []` deja la zona cerrada todos los dias.',
  })
  reemplazar(
    @Param('zonaId', ParseUUIDPipe) zonaId: string,
    @Body() dto: ReemplazarHorariosDto,
    @ConjuntoActivo() a: Ctx,
  ) {
    return this.horarios.reemplazar(a.conjuntoId, zonaId, dto.franjas);
  }
}
