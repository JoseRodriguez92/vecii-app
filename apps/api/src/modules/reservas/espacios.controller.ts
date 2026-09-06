import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { ConjuntoActivo as Ctx } from '../../auth/conjunto-activo.js';
import { ConjuntoActivo } from '../../common/decorators/conjunto-activo.decorator.js';
import { RequierePermiso } from '../../common/decorators/requiere-permiso.decorator.js';
import { PERMISOS } from '../../common/permisos.js';
import { ActualizarEspacioDto, CrearEspacioDto } from './dto/espacio.dto.js';
import { EspaciosService } from './espacios.service.js';

@ApiTags('reservas · espacios')
@ApiBearerAuth()
@Controller('espacios-reservables')
export class EspaciosController {
  constructor(private readonly espacios: EspaciosService) {}

  @Get()
  @RequierePermiso(PERMISOS.RESERVAS_LEER)
  @ApiQuery({ name: 'incluirInactivos', required: false })
  @ApiOperation({
    summary: 'Que se puede apartar',
    description:
      'Un espacio es la COSA que se aparta, y puede ser unica o un conjunto de cosas ' +
      'intercambiables. El salon comunal es capacidad 1: reservarlo lo bloquea. Los 50 cupos ' +
      'de visitantes son capacidad 50: nadie aparta el V-04, aparta "un espacio", y porteria ' +
      'asigna cual al llegar. Con eso la regla de choque es una sola para los dos.',
  })
  listar(@ConjuntoActivo() a: Ctx, @Query('incluirInactivos') incluirInactivos?: string) {
    return this.espacios.listar(a.conjuntoId, incluirInactivos === 'true');
  }

  @Get(':id/disponibilidad')
  @RequierePermiso(PERMISOS.RESERVAS_LEER)
  @ApiQuery({ name: 'desde', required: true, example: '2026-09-12T20:00:00.000Z' })
  @ApiQuery({ name: 'hasta', required: true, example: '2026-09-13T02:00:00.000Z' })
  @ApiOperation({
    summary: 'Cuantos cupos quedan en una franja',
    description:
      'Cuenta RESERVAS, no ocupacion real. Sin control de ingreso en porteria, un carro que ' +
      'entro sin reservar es invisible aqui.',
  })
  disponibilidad(
    @Param('id', ParseUUIDPipe) id: string,
    @ConjuntoActivo() a: Ctx,
    @Query('desde') desde: string,
    @Query('hasta') hasta: string,
  ) {
    return this.espacios.disponibilidad(a.conjuntoId, id, new Date(desde), new Date(hasta));
  }

  @Post()
  @RequierePermiso(PERMISOS.RESERVAS_GESTIONAR)
  @ApiOperation({
    summary: 'Crea un espacio reservable',
    description:
      'Apunta a UNA de dos cosas: una zona comun concreta (`zonaComunId`) o el pool de ' +
      'parqueaderos de cierta naturaleza (`naturalezaParqueadero`, normalmente VISITANTES). ' +
      'Ni las dos ni ninguna.',
  })
  crear(@Body() dto: CrearEspacioDto, @ConjuntoActivo() a: Ctx) {
    return this.espacios.crear(a.conjuntoId, dto);
  }

  @Patch(':id')
  @RequierePermiso(PERMISOS.RESERVAS_GESTIONAR)
  @ApiOperation({
    summary: 'Actualiza un espacio',
    description: 'Sin DELETE: las reservas historicas lo referencian. Se saca con `activo: false`.',
  })
  actualizar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarEspacioDto,
    @ConjuntoActivo() a: Ctx,
  ) {
    return this.espacios.actualizar(a.conjuntoId, id, dto);
  }
}
