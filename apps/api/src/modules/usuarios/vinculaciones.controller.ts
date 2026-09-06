import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../../auth/auth-user.js';
import type { ConjuntoActivo as Ctx } from '../../auth/conjunto-activo.js';
import { ConjuntoActivo } from '../../common/decorators/conjunto-activo.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { RequierePermiso } from '../../common/decorators/requiere-permiso.decorator.js';
import { PERMISOS } from '../../common/permisos.js';
import { CrearVinculacionDto } from './dto/vinculacion.dto.js';
import { VinculacionesService } from './vinculaciones.service.js';

@ApiTags('usuarios · vinculaciones')
@ApiBearerAuth()
@Controller('vinculaciones')
export class VinculacionesController {
  constructor(private readonly vinculaciones: VinculacionesService) {}

  @Get()
  @RequierePermiso(PERMISOS.USUARIOS_LEER)
  @ApiOperation({ summary: 'Vinculaciones enviadas y su estado' })
  listar(@ConjuntoActivo() a: Ctx) {
    return this.vinculaciones.listar(a.conjuntoId);
  }

  @Post()
  @RequierePermiso(PERMISOS.USUARIOS_VINCULAR, PERMISOS.USUARIOS_VINCULAR_MI_UNIDAD)
  @ApiOperation({
    summary: 'Vincula a alguien a una unidad',
    description:
      'Con `usuarios.vincular` se puede vincular gente a cualquier unidad y otorgar cargos. ' +
      'Con `usuarios.vincular.mi_unidad` —que tiene el propietario— solo a unidades propias ' +
      'y sin otorgar cargos: puede meter a su arrendatario, no nombrar un administrador. ' +
      'Ese alcance lo verifica el servicio, no el guard.\n\n' +
      'La vinculacion se aplica sola cuando la persona inicia sesion. Si ya tenia cuenta, no ' +
      'recibe correo pero queda vinculada al entrar.',
  })
  crear(@Body() dto: CrearVinculacionDto, @ConjuntoActivo() a: Ctx, @CurrentUser() user: AuthUser) {
    return this.vinculaciones.crear(a, user.id, dto);
  }

  @Delete(':id')
  @RequierePermiso(PERMISOS.USUARIOS_GESTIONAR)
  @ApiOperation({ summary: 'Cancela una vinculacion pendiente' })
  cancelar(@Param('id', ParseUUIDPipe) id: string, @ConjuntoActivo() a: Ctx) {
    return this.vinculaciones.cancelar(a.conjuntoId, id);
  }
}
