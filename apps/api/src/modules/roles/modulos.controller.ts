import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { ConjuntoActivo as Ctx } from '../../auth/conjunto-activo.js';
import { ConjuntoActivo } from '../../common/decorators/conjunto-activo.decorator.js';
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
      'sin ellos el administrador veria una lista plana de doscientas casillas.\n\n' +
      'Los modulos de PLATAFORMA solo salen si quien pregunta es del equipo de Vecii. Si el ' +
      'administrador de un conjunto los viera, tendria la casilla "Nombrar staff de Vecii" ' +
      'entre las suyas y podria marcarsela a su propio consejo.',
  })
  listar(@ConjuntoActivo() a: Ctx) {
    return this.roles.listarModulos(a);
  }
}
