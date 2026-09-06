import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../../auth/auth-user.js';
import type { ConjuntoActivo as Ctx } from '../../auth/conjunto-activo.js';
import { ConjuntoActivo } from '../../common/decorators/conjunto-activo.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { RequierePermiso } from '../../common/decorators/requiere-permiso.decorator.js';
import { PERMISOS } from '../../common/permisos.js';
import { CrearInvitacionDto } from './dto/invitacion.dto.js';
import { InvitacionesService } from './invitaciones.service.js';

@ApiTags('usuarios · invitaciones')
@ApiBearerAuth()
@Controller('invitaciones')
export class InvitacionesController {
  constructor(private readonly invitaciones: InvitacionesService) {}

  @Get()
  @RequierePermiso(PERMISOS.USUARIOS_LEER)
  @ApiOperation({ summary: 'Invitaciones enviadas y su estado' })
  listar(@ConjuntoActivo() a: Ctx) {
    return this.invitaciones.listar(a.conjuntoId);
  }

  @Post()
  @RequierePermiso(PERMISOS.USUARIOS_INVITAR, PERMISOS.USUARIOS_INVITAR_MI_UNIDAD)
  @ApiOperation({
    summary: 'Invita a alguien por correo',
    description:
      'Con `usuarios.invitar` se puede invitar a cualquier unidad y otorgar cargos. ' +
      'Con `usuarios.invitar.mi_unidad` —que tiene el propietario— solo a unidades propias ' +
      'y sin otorgar cargos: puede meter a su arrendatario, no nombrar un administrador. ' +
      'Ese alcance lo verifica el servicio, no el guard.\n\n' +
      'La invitacion se aplica sola cuando la persona inicia sesion. Si ya tenia cuenta, no ' +
      'recibe correo pero queda vinculada al entrar.',
  })
  crear(@Body() dto: CrearInvitacionDto, @ConjuntoActivo() a: Ctx, @CurrentUser() user: AuthUser) {
    return this.invitaciones.crear(a, user.id, dto);
  }

  @Delete(':id')
  @RequierePermiso(PERMISOS.USUARIOS_GESTIONAR)
  @ApiOperation({ summary: 'Cancela una invitacion pendiente' })
  cancelar(@Param('id', ParseUUIDPipe) id: string, @ConjuntoActivo() a: Ctx) {
    return this.invitaciones.cancelar(a.conjuntoId, id);
  }
}
