import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { ConjuntoActivo as Ctx } from '../../auth/conjunto-activo.js';
import { ConjuntoActivo } from '../../common/decorators/conjunto-activo.decorator.js';
import { RequierePermiso } from '../../common/decorators/requiere-permiso.decorator.js';
import { PERMISOS } from '../../common/permisos.js';
import { CasillerosService } from './casilleros.service.js';
import {
  ActualizarCasilleroDto,
  CrearCasilleroDto,
  ImportarCasillerosDto,
} from './dto/casillero.dto.js';

@ApiTags('porteria · casilleros')
@ApiBearerAuth()
@Controller('casilleros')
export class CasillerosController {
  constructor(private readonly casilleros: CasillerosService) {}

  @Get()
  @RequierePermiso(PERMISOS.PORTERIA_LEER)
  @ApiQuery({ name: 'agrupacionId', required: false, description: 'Filtra por torre o etapa.' })
  @ApiQuery({
    name: 'sinUnidad',
    required: false,
    description: 'Solo las casillas que no son de ninguna unidad.',
  })
  @ApiOperation({ summary: 'Lista los casilleros del conjunto' })
  listar(
    @ConjuntoActivo() a: Ctx,
    @Query('agrupacionId') agrupacionId?: string,
    @Query('sinUnidad') sinUnidad?: string,
  ) {
    return this.casilleros.listar(a.conjuntoId, { agrupacionId, sinUnidad: sinUnidad === 'true' });
  }

  @Post()
  @RequierePermiso(PERMISOS.PORTERIA_GESTIONAR)
  @ApiOperation({ summary: 'Crea un casillero' })
  crear(@Body() dto: CrearCasilleroDto, @ConjuntoActivo() a: Ctx) {
    return this.casilleros.crear(a.conjuntoId, dto);
  }

  @Post('importar')
  @RequierePermiso(PERMISOS.PORTERIA_GESTIONAR)
  @ApiOperation({
    summary: 'Carga masiva de casilleros',
    description:
      'Nadie va a crear 120 casillas de a una. Todo o nada: si una fila falla, no entra ninguna.',
  })
  importar(@Body() dto: ImportarCasillerosDto, @ConjuntoActivo() a: Ctx) {
    return this.casilleros.importar(a.conjuntoId, dto.casilleros);
  }

  @Patch(':id')
  @RequierePermiso(PERMISOS.PORTERIA_GESTIONAR)
  @ApiOperation({
    summary: 'Actualiza un casillero',
    description:
      'No hay DELETE a proposito: las entregas viejas apuntan a la casilla y tienen que seguir ' +
      'teniendo sentido. Para sacarla de servicio, `activo: false`.',
  })
  actualizar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarCasilleroDto,
    @ConjuntoActivo() a: Ctx,
  ) {
    return this.casilleros.actualizar(a.conjuntoId, id, dto);
  }
}
