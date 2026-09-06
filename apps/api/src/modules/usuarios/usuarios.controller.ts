import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { ConjuntoActivo as Ctx } from '../../auth/conjunto-activo.js';
import { ConjuntoActivo } from '../../common/decorators/conjunto-activo.decorator.js';
import { RequierePermiso } from '../../common/decorators/requiere-permiso.decorator.js';
import { PERMISOS } from '../../common/permisos.js';
import { UsuariosService } from './usuarios.service.js';

@ApiTags('usuarios')
@ApiBearerAuth()
@Controller('usuarios')
export class UsuariosController {
  constructor(private readonly usuarios: UsuariosService) {}

  @Get()
  @RequierePermiso(PERMISOS.USUARIOS_LEER)
  @ApiOperation({
    summary: 'Quien esta en el conjunto',
    description:
      'Cada persona con sus roles vigentes y las unidades donde tiene ocupacion. ' +
      'Los roles de propietario y residente no aparecen en la lista de roles: se ' +
      'deducen de las unidades, que van aparte.',
  })
  listar(@ConjuntoActivo() a: Ctx) {
    return this.usuarios.listar(a.conjuntoId);
  }
}
