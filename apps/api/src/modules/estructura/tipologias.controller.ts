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
import { ActualizarTipologiaDto, CrearTipologiaDto } from './dto/tipologia.dto.js';
import { TipologiasService } from './tipologias.service.js';

@ApiTags('estructura · tipologias')
@ApiBearerAuth()
@Controller('tipologias')
export class TipologiasController {
  constructor(private readonly tipologias: TipologiasService) {}

  @Get()
  @RequierePermiso(PERMISOS.ESTRUCTURA_LEER)
  @ApiOperation({ summary: 'Lista las tipologias (plantas repetidas) del conjunto' })
  listar(@ConjuntoActivo() a: Ctx) {
    return this.tipologias.listar(a.conjuntoId);
  }

  @Post()
  @RequierePermiso(PERMISOS.ESTRUCTURA_GESTIONAR)
  @ApiOperation({ summary: 'Crea una tipologia' })
  crear(@Body() dto: CrearTipologiaDto, @ConjuntoActivo() a: Ctx) {
    return this.tipologias.crear(a.conjuntoId, dto);
  }

  @Patch(':id')
  @RequierePermiso(PERMISOS.ESTRUCTURA_GESTIONAR)
  @ApiOperation({
    summary: 'Actualiza una tipologia',
    description:
      'El cambio aplica a TODAS las unidades de esa tipologia que no tengan valor propio. ' +
      'Corregir un area mal cargada se hace una sola vez.',
  })
  actualizar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarTipologiaDto,
    @ConjuntoActivo() a: Ctx,
  ) {
    return this.tipologias.actualizar(a.conjuntoId, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequierePermiso(PERMISOS.ESTRUCTURA_GESTIONAR)
  @ApiOperation({ summary: 'Elimina una tipologia que no este en uso' })
  eliminar(@Param('id', ParseUUIDPipe) id: string, @ConjuntoActivo() a: Ctx) {
    return this.tipologias.eliminar(a.conjuntoId, id);
  }
}
