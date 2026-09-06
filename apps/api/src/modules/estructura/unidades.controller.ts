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
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { ConjuntoActivo as Ctx } from '../../auth/conjunto-activo.js';
import { ConjuntoActivo } from '../../common/decorators/conjunto-activo.decorator.js';
import { RequierePermiso } from '../../common/decorators/requiere-permiso.decorator.js';
import { PERMISOS } from '../../common/permisos.js';
import { ActualizarUnidadDto, CrearUnidadDto, ImportarUnidadesDto } from './dto/unidad.dto.js';
import { UnidadesService } from './unidades.service.js';

@ApiTags('estructura · unidades')
@ApiBearerAuth()
@Controller('unidades')
export class UnidadesController {
  constructor(private readonly unidades: UnidadesService) {}

  @Get()
  @RequierePermiso(PERMISOS.ESTRUCTURA_LEER)
  @ApiQuery({ name: 'agrupacionId', required: false, description: 'Filtra por torre o manzana.' })
  @ApiOperation({ summary: 'Lista las unidades del conjunto' })
  listar(@ConjuntoActivo() a: Ctx, @Query('agrupacionId') agrupacionId?: string) {
    return this.unidades.listar(a.conjuntoId, agrupacionId);
  }

  // OJO: esta ruta va ANTES de ':id'. Si no, Express interpreta
  // "salud-coeficientes" como un id y el ParseUUIDPipe responde 400.
  @Get('salud-coeficientes')
  @RequierePermiso(PERMISOS.ESTRUCTURA_LEER)
  @ApiOperation({
    summary: 'Verifica que los coeficientes sumen 100%',
    description:
      'De esa suma dependen las cuotas Y las mayorias calificadas de la asamblea, que se ' +
      'calculan sobre el total del conjunto. Con el denominador mal, ambas salen mal. ' +
      'Tambien avisa si la Ley 675 exige consejo de administracion por el numero de unidades.',
  })
  saludCoeficientes(@ConjuntoActivo() a: Ctx) {
    return this.unidades.saludCoeficientes(a.conjuntoId);
  }

  @Get(':id')
  @RequierePermiso(PERMISOS.ESTRUCTURA_LEER)
  @ApiOperation({ summary: 'Detalle de una unidad, con sus ocupantes vigentes' })
  obtener(@Param('id', ParseUUIDPipe) id: string, @ConjuntoActivo() a: Ctx) {
    return this.unidades.obtener(a.conjuntoId, id);
  }

  @Post()
  @RequierePermiso(PERMISOS.ESTRUCTURA_GESTIONAR)
  @ApiOperation({ summary: 'Crea una unidad' })
  crear(@Body() dto: CrearUnidadDto, @ConjuntoActivo() a: Ctx) {
    return this.unidades.crear(a.conjuntoId, dto);
  }

  @Post('importar')
  @RequierePermiso(PERMISOS.UNIDADES_IMPORTAR)
  @ApiOperation({
    summary: 'Carga masiva de unidades',
    description:
      'Todo o nada: si una fila falla, no entra ninguna. Un conjunto a medio cargar es peor ' +
      'que uno vacio, porque parece completo. Devuelve el chequeo de coeficientes al terminar.',
  })
  importar(@Body() dto: ImportarUnidadesDto, @ConjuntoActivo() a: Ctx) {
    return this.unidades.importar(a.conjuntoId, dto.unidades);
  }

  @Patch(':id')
  @RequierePermiso(PERMISOS.ESTRUCTURA_GESTIONAR)
  @ApiOperation({ summary: 'Actualiza una unidad' })
  actualizar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarUnidadDto,
    @ConjuntoActivo() a: Ctx,
  ) {
    return this.unidades.actualizar(a.conjuntoId, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequierePermiso(PERMISOS.ESTRUCTURA_GESTIONAR)
  @ApiOperation({ summary: 'Elimina una unidad' })
  eliminar(@Param('id', ParseUUIDPipe) id: string, @ConjuntoActivo() a: Ctx) {
    return this.unidades.eliminar(a.conjuntoId, id);
  }
}
