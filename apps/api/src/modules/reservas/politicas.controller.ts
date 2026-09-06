import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { ConjuntoActivo as Ctx } from '../../auth/conjunto-activo.js';
import { ConjuntoActivo } from '../../common/decorators/conjunto-activo.decorator.js';
import { RequierePermiso } from '../../common/decorators/requiere-permiso.decorator.js';
import { PERMISOS } from '../../common/permisos.js';
import { GuardarPoliticaDto } from './dto/politica.dto.js';
import { PoliticasService } from './politicas.service.js';

@ApiTags('reservas · politicas')
@ApiBearerAuth()
@Controller('politicas-reserva')
export class PoliticasController {
  constructor(private readonly politicas: PoliticasService) {}

  @Get(':espacioId')
  @RequierePermiso(PERMISOS.RESERVAS_LEER)
  @ApiOperation({ summary: 'Las reglas de un espacio' })
  obtener(@Param('espacioId', ParseUUIDPipe) espacioId: string, @ConjuntoActivo() a: Ctx) {
    return this.politicas.obtener(a.conjuntoId, espacioId);
  }

  @Put(':espacioId')
  @RequierePermiso(PERMISOS.RESERVAS_GESTIONAR)
  @ApiOperation({
    summary: 'Define o reemplaza las reglas de un espacio',
    description:
      'Una politica por espacio: es PUT y no POST porque no se acumulan. Cuelga del ESPACIO y ' +
      'no del objeto fisico, asi que una sola politica cubre los 50 cupos de visitantes.\n\n' +
      'Todos los campos son opcionales: un espacio sin politica se reserva sin mas restriccion ' +
      'que la capacidad.\n\n' +
      'No lleva tarifas ni depositos — eso termina en el estado de cuenta y es de finanzas. ' +
      'Aqui solo vive lo que se puede validar sin saber de plata.',
  })
  guardar(
    @Param('espacioId', ParseUUIDPipe) espacioId: string,
    @Body() dto: GuardarPoliticaDto,
    @ConjuntoActivo() a: Ctx,
  ) {
    return this.politicas.guardar(a.conjuntoId, espacioId, dto);
  }

  @Delete(':espacioId')
  @RequierePermiso(PERMISOS.RESERVAS_GESTIONAR)
  @ApiOperation({
    summary: 'Quita las reglas',
    description: 'El espacio queda sin restricciones mas alla de su capacidad.',
  })
  eliminar(@Param('espacioId', ParseUUIDPipe) espacioId: string, @ConjuntoActivo() a: Ctx) {
    return this.politicas.eliminar(a.conjuntoId, espacioId);
  }
}
