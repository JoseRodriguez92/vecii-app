import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { ConjuntoActivo as Ctx } from '../../auth/conjunto-activo.js';
import { ConjuntoActivo } from '../../common/decorators/conjunto-activo.decorator.js';
import { RequierePermiso } from '../../common/decorators/requiere-permiso.decorator.js';
import { PERMISOS } from '../../common/permisos.js';
import { ConceptosService } from './conceptos.service.js';
import { ActualizarConceptoDto, CrearConceptoDto } from './dto/concepto.dto.js';

@ApiTags('finanzas · conceptos cobro')
@ApiBearerAuth()
@Controller('conceptos-cobro')
export class ConceptosController {
  constructor(private readonly conceptos: ConceptosService) {}

  @Get()
  @RequierePermiso(PERMISOS.FINANZAS_LEER)
  @ApiQuery({ name: 'incluirInactivos', required: false })
  @ApiOperation({
    summary: 'Que se le puede cobrar a una unidad en este conjunto',
    description:
      'El catalogo. Tres vienen sembrados y los genera el sistema —se reconocen por `codigo`—; ' +
      'el resto los invento el conjunto y no llevan codigo.\n\n' +
      'Los que se calculan (administracion, interes) no traen `tarifa`: su valor no existe hasta ' +
      'calcularlo para una unidad concreta.',
  })
  listar(@ConjuntoActivo() a: Ctx, @Query('incluirInactivos') incluirInactivos?: string) {
    return this.conceptos.listar(a.conjuntoId, incluirInactivos === 'true');
  }

  @Post()
  @RequierePermiso(PERMISOS.FINANZAS_GESTIONAR)
  @ApiOperation({
    summary: 'Crea un concepto propio del conjunto',
    description:
      'Para lo que este conjunto cobra y otro no: alquiler del salon, cancha de squash, multa ' +
      'por ruido. No lleva `codigo` — el sistema no lo menciona por nombre, y por eso funciona ' +
      'sin desplegar nada.',
  })
  crear(@Body() dto: CrearConceptoDto, @ConjuntoActivo() a: Ctx) {
    return this.conceptos.crear(a.conjuntoId, dto);
  }

  @Patch(':id')
  @RequierePermiso(PERMISOS.FINANZAS_GESTIONAR)
  @ApiOperation({
    summary: 'Cambia el nombre, la tarifa o lo desactiva',
    description:
      'Desactivar NO borra: los cobros de meses anteriores siguen nombrandolo y tienen que ' +
      'seguir teniendo sentido.\n\n' +
      'Los tres conceptos del sistema se pueden renombrar y tarifar, pero **no desactivar**: sin ' +
      'ellos la facturacion mensual no tendria donde poner la cuota.',
  })
  actualizar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarConceptoDto,
    @ConjuntoActivo() a: Ctx,
  ) {
    return this.conceptos.actualizar(a.conjuntoId, id, dto);
  }
}
