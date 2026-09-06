import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { ConjuntoActivo as Ctx } from '../../auth/conjunto-activo.js';
import { ConjuntoActivo } from '../../common/decorators/conjunto-activo.decorator.js';
import { RequierePermiso } from '../../common/decorators/requiere-permiso.decorator.js';
import { PERMISOS } from '../../common/permisos.js';
import { AgrupacionesService } from './agrupaciones.service.js';
import { ActualizarAgrupacionDto, CrearAgrupacionDto } from './dto/agrupacion.dto.js';

@ApiTags('estructura · agrupaciones')
@ApiBearerAuth()
@Controller('agrupaciones')
export class AgrupacionesController {
  constructor(private readonly agrupaciones: AgrupacionesService) {}

  @Get()
  @RequierePermiso(PERMISOS.ESTRUCTURA_LEER)
  @ApiOperation({ summary: 'Lista las agrupaciones del conjunto (torres, manzanas, etapas)' })
  listar(@ConjuntoActivo() a: Ctx) {
    return this.agrupaciones.listar(a.conjuntoId);
  }

  @Get(':id')
  @RequierePermiso(PERMISOS.ESTRUCTURA_LEER)
  @ApiOperation({ summary: 'Detalle de una agrupacion, con su padre y sus hijas' })
  obtener(@Param('id', ParseUUIDPipe) id: string, @ConjuntoActivo() a: Ctx) {
    return this.agrupaciones.obtener(a.conjuntoId, id);
  }

  @Post()
  @RequierePermiso(PERMISOS.ESTRUCTURA_GESTIONAR)
  @ApiOperation({
    summary: 'Crea una agrupacion',
    description:
      'Si se indica `padreId`, se valida que exista en este conjunto, que no forme un ciclo ' +
      'y que el arbol no pase de tres niveles.',
  })
  crear(@Body() dto: CrearAgrupacionDto, @ConjuntoActivo() a: Ctx) {
    return this.agrupaciones.crear(a.conjuntoId, dto);
  }

  @Patch(':id')
  @RequierePermiso(PERMISOS.ESTRUCTURA_GESTIONAR)
  @ApiOperation({ summary: 'Actualiza una agrupacion' })
  actualizar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarAgrupacionDto,
    @ConjuntoActivo() a: Ctx,
  ) {
    return this.agrupaciones.actualizar(a.conjuntoId, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequierePermiso(PERMISOS.ESTRUCTURA_GESTIONAR)
  @ApiOperation({
    summary: 'Elimina una agrupacion vacia',
    description: 'Falla si tiene unidades o agrupaciones hijas. Muevelas primero.',
  })
  eliminar(@Param('id', ParseUUIDPipe) id: string, @ConjuntoActivo() a: Ctx) {
    return this.agrupaciones.eliminar(a.conjuntoId, id);
  }
}
