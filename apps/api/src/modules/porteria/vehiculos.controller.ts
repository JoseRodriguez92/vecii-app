import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../../auth/auth-user.js';
import type { ConjuntoActivo as Ctx } from '../../auth/conjunto-activo.js';
import { ConjuntoActivo } from '../../common/decorators/conjunto-activo.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { RequierePermiso } from '../../common/decorators/requiere-permiso.decorator.js';
import { PERMISOS } from '../../common/permisos.js';
import { ActualizarVehiculoDto, RegistrarVehiculoDto } from './dto/vehiculo.dto.js';
import { VehiculosService } from './vehiculos.service.js';

@ApiTags('porteria · vehiculos')
@ApiBearerAuth()
@Controller('vehiculos')
export class VehiculosController {
  constructor(private readonly vehiculos: VehiculosService) {}

  @Get()
  @RequierePermiso(PERMISOS.PORTERIA_LEER)
  @ApiQuery({ name: 'placa', required: false, description: 'Coincidencia parcial. "ABC" encuentra ABC123.' })
  @ApiQuery({ name: 'unidadId', required: false })
  @ApiQuery({ name: 'incluirRetirados', required: false })
  @ApiOperation({
    summary: 'Los carros y motos del conjunto',
    description:
      'La consulta de la puerta: se teclea la placa y sale de que unidad es. Busca por ' +
      'coincidencia parcial porque en la reja se alcanzan a leer tres letras, no siempre las ' +
      'seis, y no importa como se escriba: las placas se guardan en mayusculas y sin ' +
      'separadores.\n\n' +
      'OJO: esto son los vehiculos REGISTRADOS por las unidades. La placa de alguien que vino ' +
      'una vez vive en `/invitados`.',
  })
  listar(
    @ConjuntoActivo() a: Ctx,
    @Query('placa') placa?: string,
    @Query('unidadId') unidadId?: string,
    @Query('incluirRetirados') incluirRetirados?: string,
  ) {
    return this.vehiculos.listar(a.conjuntoId, {
      placa,
      unidadId,
      incluirRetirados: incluirRetirados === 'true',
    });
  }

  @Get('mios')
  @RequierePermiso(PERMISOS.PORTERIA_VEHICULOS_MI_UNIDAD, PERMISOS.PORTERIA_VEHICULOS_GESTIONAR)
  @ApiQuery({ name: 'incluirRetirados', required: false })
  @ApiOperation({ summary: 'Los vehiculos de mis unidades' })
  mios(
    @ConjuntoActivo() a: Ctx,
    @CurrentUser() user: AuthUser,
    @Query('incluirRetirados') incluirRetirados?: string,
  ) {
    return this.vehiculos.mios(a.conjuntoId, user.id, incluirRetirados === 'true');
  }

  @Post()
  @RequierePermiso(PERMISOS.PORTERIA_VEHICULOS_GESTIONAR, PERMISOS.PORTERIA_VEHICULOS_MI_UNIDAD)
  @ApiOperation({
    summary: 'Registra un vehiculo',
    description:
      'Cuelga de la UNIDAD y no de la persona, igual que el parqueadero: si el arrendatario se ' +
      'va, el cupo sigue siendo del 501. El `propietarioId` es opcional porque muchas veces el ' +
      'carro es de la empresa o del papa, y exigirlo llevaria a inventar el dato.\n\n' +
      'Una placa vigente por conjunto. Si el 501 le vende el carro al 302, primero se da de ' +
      'baja alla.',
  })
  registrar(
    @Body() dto: RegistrarVehiculoDto,
    @ConjuntoActivo() a: Ctx,
    @CurrentUser() user: AuthUser,
  ) {
    return this.vehiculos.registrar(a, user.id, dto);
  }

  @Patch(':id')
  @RequierePermiso(PERMISOS.PORTERIA_VEHICULOS_GESTIONAR, PERMISOS.PORTERIA_VEHICULOS_MI_UNIDAD)
  @ApiOperation({ summary: 'Corrige los datos de un vehiculo' })
  actualizar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarVehiculoDto,
    @ConjuntoActivo() a: Ctx,
    @CurrentUser() user: AuthUser,
  ) {
    return this.vehiculos.actualizar(a, user.id, id, dto);
  }

  @Delete(':id')
  @RequierePermiso(PERMISOS.PORTERIA_VEHICULOS_GESTIONAR, PERMISOS.PORTERIA_VEHICULOS_MI_UNIDAD)
  @ApiOperation({
    summary: 'Da de baja un vehiculo',
    description:
      'Se vendio, se mudaron. **No borra la fila**: le pone `hasta`. La pregunta que llega es ' +
      '"de quien era la ABC123 en marzo", y se hace justo cuando algo paso en el parqueadero.',
  })
  darDeBaja(
    @Param('id', ParseUUIDPipe) id: string,
    @ConjuntoActivo() a: Ctx,
    @CurrentUser() user: AuthUser,
  ) {
    return this.vehiculos.darDeBaja(a, user.id, id);
  }
}
