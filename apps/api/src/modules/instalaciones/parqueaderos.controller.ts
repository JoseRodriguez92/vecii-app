import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { ConjuntoActivo as Ctx } from '../../auth/conjunto-activo.js';
import { ConjuntoActivo } from '../../common/decorators/conjunto-activo.decorator.js';
import { RequierePermiso } from '../../common/decorators/requiere-permiso.decorator.js';
import { PERMISOS } from '../../common/permisos.js';
import { NaturalezaParqueadero } from '../../generated/prisma/enums.js';
import { ActualizarParqueaderoDto, CrearParqueaderoDto } from './dto/parqueadero.dto.js';
import { ParqueaderosService } from './parqueaderos.service.js';

@ApiTags('instalaciones · parqueaderos')
@ApiBearerAuth()
@Controller('parqueaderos')
export class ParqueaderosController {
  constructor(private readonly parqueaderos: ParqueaderosService) {}

  @Get()
  @RequierePermiso(PERMISOS.INSTALACIONES_LEER)
  @ApiQuery({ name: 'naturaleza', required: false, enum: NaturalezaParqueadero })
  @ApiQuery({ name: 'agrupacionId', required: false })
  @ApiQuery({ name: 'incluirInactivos', required: false })
  @ApiQuery({
    name: 'soloLibres',
    required: false,
    description: 'Solo los que no tienen ninguna asignacion vigente.',
  })
  @ApiOperation({
    summary: 'Los cupos del conjunto',
    description:
      'Cada uno trae su asignacion vigente, si la tiene. "Libre" no es un campo: es no tener ' +
      'ninguna asignacion abierta. Un campo `ocupado` habria que mantenerlo de acuerdo con las ' +
      'asignaciones, y algun dia mentiria.',
  })
  listar(
    @ConjuntoActivo() a: Ctx,
    @Query('naturaleza') naturaleza?: NaturalezaParqueadero,
    @Query('agrupacionId') agrupacionId?: string,
    @Query('incluirInactivos') incluirInactivos?: string,
    @Query('soloLibres') soloLibres?: string,
  ) {
    return this.parqueaderos.listar(a.conjuntoId, {
      naturaleza,
      agrupacionId,
      incluirInactivos: incluirInactivos === 'true',
      soloLibres: soloLibres === 'true',
    });
  }

  @Get(':id')
  @RequierePermiso(PERMISOS.INSTALACIONES_LEER)
  @ApiOperation({
    summary: 'Un cupo con todo su historial',
    description: 'Las asignaciones vienen completas, de la mas reciente a la mas vieja.',
  })
  obtener(@Param('id', ParseUUIDPipe) id: string, @ConjuntoActivo() a: Ctx) {
    return this.parqueaderos.obtener(a.conjuntoId, id);
  }

  @Post()
  @RequierePermiso(PERMISOS.INSTALACIONES_GESTIONAR)
  @ApiOperation({
    summary: 'Crea un cupo',
    description:
      'La `naturaleza` es la decision que importa: define si el cupo tiene coeficiente, si se ' +
      'puede vender y que asignaciones va a admitir despues. Un `PRIVADO` exige `unidadId` ' +
      '—la unidad que ese cupo ES, con su matricula—; los demas no pueden tenerlo.',
  })
  crear(@Body() dto: CrearParqueaderoDto, @ConjuntoActivo() a: Ctx) {
    return this.parqueaderos.crear(a.conjuntoId, dto);
  }

  @Patch(':id')
  @RequierePermiso(PERMISOS.INSTALACIONES_GESTIONAR)
  @ApiOperation({
    summary: 'Actualiza un cupo',
    description:
      'Sin DELETE: las asignaciones y reservas historicas lo referencian. Se saca con ' +
      '`activo: false`. Cambiar la `naturaleza` exige que no haya asignaciones vigentes, ' +
      'porque quedarian con un origen que hoy seria invalido.',
  })
  actualizar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarParqueaderoDto,
    @ConjuntoActivo() a: Ctx,
  ) {
    return this.parqueaderos.actualizar(a.conjuntoId, id, dto);
  }
}
