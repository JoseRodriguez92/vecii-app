import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../../auth/auth-user.js';
import type { ConjuntoActivo as Ctx } from '../../auth/conjunto-activo.js';
import { ConjuntoActivo } from '../../common/decorators/conjunto-activo.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { RequierePermiso } from '../../common/decorators/requiere-permiso.decorator.js';
import { PERMISOS } from '../../common/permisos.js';
import { BicicletasService } from './bicicletas.service.js';
import { ActualizarBicicletaDto, RegistrarBicicletaDto } from './dto/bicicleta.dto.js';

@ApiTags('porteria · bicicletas')
@ApiBearerAuth()
@Controller('bicicletas')
export class BicicletasController {
  constructor(private readonly bicicletas: BicicletasService) {}

  @Get()
  @RequierePermiso(PERMISOS.PORTERIA_LEER)
  @ApiQuery({ name: 'serial', required: false, description: 'Coincidencia parcial.' })
  @ApiQuery({ name: 'unidadId', required: false })
  @ApiQuery({ name: 'incluirRetiradas', required: false })
  @ApiOperation({
    summary: 'Las bicicletas registradas',
    description:
      'Van aparte de los vehiculos porque se identifican distinto: una placa es unica, publica ' +
      'y la puso el Estado; el serial de una bicicleta lo sabe el dueno si tiene suerte. Meter ' +
      'las dos en una tabla habria obligado a que la placa fuera opcional, y entonces dejaria ' +
      'de servir para lo unico que sirve.\n\n' +
      'El bicicletero, por su parte, es una zona comun y no un parqueadero: no es un cupo ' +
      'individual que se le asigne a nadie.',
  })
  listar(
    @ConjuntoActivo() a: Ctx,
    @Query('serial') serial?: string,
    @Query('unidadId') unidadId?: string,
    @Query('incluirRetiradas') incluirRetiradas?: string,
  ) {
    return this.bicicletas.listar(a.conjuntoId, {
      serial,
      unidadId,
      incluirRetiradas: incluirRetiradas === 'true',
    });
  }

  @Get('mias')
  @RequierePermiso(PERMISOS.PORTERIA_VEHICULOS_MI_UNIDAD, PERMISOS.PORTERIA_VEHICULOS_GESTIONAR)
  @ApiQuery({ name: 'incluirRetiradas', required: false })
  @ApiOperation({ summary: 'Las bicicletas de mis unidades' })
  mias(
    @ConjuntoActivo() a: Ctx,
    @CurrentUser() user: AuthUser,
    @Query('incluirRetiradas') incluirRetiradas?: string,
  ) {
    return this.bicicletas.mias(a.conjuntoId, user.id, incluirRetiradas === 'true');
  }

  @Post()
  @RequierePermiso(PERMISOS.PORTERIA_VEHICULOS_GESTIONAR, PERMISOS.PORTERIA_VEHICULOS_MI_UNIDAD)
  @ApiOperation({
    summary: 'Registra una bicicleta',
    description:
      'Existe por una razon muy concreta: se las roban. Un registro con serial y color es lo ' +
      'que permite reclamar.\n\n' +
      'El `serial` es opcional a proposito —esta grabado en el marco y mucha gente no lo tiene ' +
      'a mano, y exigirlo dejaria media bicicleteria sin registrar— pero es lo UNICO que sirve ' +
      'para reclamar una robada. Vale la pena insistirle al residente.',
  })
  registrar(
    @Body() dto: RegistrarBicicletaDto,
    @ConjuntoActivo() a: Ctx,
    @CurrentUser() user: AuthUser,
  ) {
    return this.bicicletas.registrar(a, user.id, dto);
  }

  @Patch(':id')
  @RequierePermiso(PERMISOS.PORTERIA_VEHICULOS_GESTIONAR, PERMISOS.PORTERIA_VEHICULOS_MI_UNIDAD)
  @ApiOperation({ summary: 'Corrige los datos de una bicicleta' })
  actualizar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarBicicletaDto,
    @ConjuntoActivo() a: Ctx,
    @CurrentUser() user: AuthUser,
  ) {
    return this.bicicletas.actualizar(a, user.id, id, dto);
  }

  @Delete(':id')
  @RequierePermiso(PERMISOS.PORTERIA_VEHICULOS_GESTIONAR, PERMISOS.PORTERIA_VEHICULOS_MI_UNIDAD)
  @ApiOperation({
    summary: 'Da de baja una bicicleta',
    description:
      'Se la robaron, la vendieron, se mudaron. **No borra la fila**: le pone `hasta`. Si se la ' +
      'robaron, ese registro es justo el que hay que poder mostrar despues.',
  })
  darDeBaja(
    @Param('id', ParseUUIDPipe) id: string,
    @ConjuntoActivo() a: Ctx,
    @CurrentUser() user: AuthUser,
  ) {
    return this.bicicletas.darDeBaja(a, user.id, id);
  }
}
