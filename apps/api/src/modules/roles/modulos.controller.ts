import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequierePermiso } from '../../common/decorators/requiere-permiso.decorator.js';
import { PERMISOS } from '../../common/permisos.js';
import { RolesService } from './roles.service.js';

@ApiTags('roles · modulos')
@ApiBearerAuth()
@Controller('modulos')
export class ModulosController {
  constructor(private readonly roles: RolesService) {}

  @Get()
  @RequierePermiso(PERMISOS.ROLES_LEER)
  @ApiOperation({
    summary: 'El catalogo de permisos, agrupado',
    description:
      'Para pintar la pantalla de administracion. Los modulos existen justamente para esto: ' +
      'sin ellos el administrador veria una lista plana de doscientas casillas.',
  })
  listar() {
    return this.roles.listarModulos();
  }
}
