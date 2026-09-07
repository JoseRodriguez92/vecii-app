import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { ConjuntoActivo as Ctx } from '../../auth/conjunto-activo.js';
import { ConjuntoActivo } from '../../common/decorators/conjunto-activo.decorator.js';
import { RequierePermiso } from '../../common/decorators/requiere-permiso.decorator.js';
import { PERMISOS } from '../../common/permisos.js';
import { ActualizarZonaComunDto, CrearZonaComunDto } from './dto/zona-comun.dto.js';
import { ZonasService } from './zonas.service.js';

@ApiTags('inventario · zonas comunes')
@ApiBearerAuth()
@Controller('zonas-comunes')
export class ZonasController {
  constructor(private readonly zonas: ZonasService) {}

  @Get()
  @RequierePermiso(PERMISOS.INVENTARIO_LEER)
  @ApiQuery({ name: 'incluirInactivas', required: false })
  @ApiQuery({ name: 'agrupacionId', required: false })
  @ApiQuery({ name: 'soloReservables', required: false })
  @ApiOperation({
    summary: 'Los bienes comunes del conjunto',
    description:
      'Salon, piscina, gimnasio, BBQ. NO son unidades y por eso viven aparte: un bien comun no ' +
      'tiene coeficiente, no se vende por separado y no paga administracion. Cada uno trae el ' +
      'espacio reservable que lo aparta, si lo tiene.',
  })
  listar(
    @ConjuntoActivo() a: Ctx,
    @Query('incluirInactivas') incluirInactivas?: string,
    @Query('agrupacionId') agrupacionId?: string,
    @Query('soloReservables') soloReservables?: string,
  ) {
    return this.zonas.listar(a.conjuntoId, {
      incluirInactivas: incluirInactivas === 'true',
      agrupacionId,
      soloReservables: soloReservables === 'true',
    });
  }

  @Get(':id')
  @RequierePermiso(PERMISOS.INVENTARIO_LEER)
  @ApiOperation({
    summary: 'Una zona con sus horarios',
    description:
      'Las franjas vienen con la hora en minutos (`apertura`) y tambien escrita (`aperturaHora`, ' +
      '"08:00"). La segunda se deriva de la primera al responder; no se guarda.',
  })
  obtener(@Param('id', ParseUUIDPipe) id: string, @ConjuntoActivo() a: Ctx) {
    return this.zonas.obtener(a.conjuntoId, id);
  }

  @Post()
  @RequierePermiso(PERMISOS.INVENTARIO_GESTIONAR)
  @ApiOperation({
    summary: 'Crea una zona comun',
    description:
      'Marcar `reservable` dice que la zona REQUIERE reserva, no la vuelve apartable: para eso ' +
      'hace falta ademas un espacio reservable que apunte aqui, donde viven la capacidad y las ' +
      'reglas.',
  })
  crear(@Body() dto: CrearZonaComunDto, @ConjuntoActivo() a: Ctx) {
    return this.zonas.crear(a.conjuntoId, dto);
  }

  @Patch(':id')
  @RequierePermiso(PERMISOS.INVENTARIO_GESTIONAR)
  @ApiOperation({
    summary: 'Actualiza una zona comun',
    description:
      'Sin DELETE: las reservas historicas la referencian a traves de su espacio. Se saca de ' +
      'servicio con `activo: false`, y para eso su espacio reservable tiene que estar ya ' +
      'desactivado.',
  })
  actualizar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarZonaComunDto,
    @ConjuntoActivo() a: Ctx,
  ) {
    return this.zonas.actualizar(a.conjuntoId, id, dto);
  }
}
