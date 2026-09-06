import { Body, Controller, Get, Param, Patch, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import type { ConjuntoActivo as Ctx } from '../../auth/conjunto-activo.js';
import { ConjuntoActivo } from '../../common/decorators/conjunto-activo.decorator.js';
import { RequierePermiso } from '../../common/decorators/requiere-permiso.decorator.js';
import { ROL, ROLES_DEL_SISTEMA } from '../../common/roles.js';
import { PERMISOS } from '../../common/permisos.js';
import { ActualizarRolDto, ReemplazarPermisosDto } from './dto/rol.dto.js';
import { RolesService } from './roles.service.js';

@ApiTags('roles')
@ApiBearerAuth()
@Controller('roles')
export class RolesController {
  constructor(private readonly roles: RolesService) {}

  @Get()
  @RequierePermiso(PERMISOS.ROLES_LEER)
  @ApiOperation({
    summary: 'Los roles con sus permisos',
    description:
      'El catalogo es global: los cargos son los mismos en toda Colombia. `asignable: false` ' +
      'marca los que NO se otorgan a mano — PROPIETARIO y RESIDENTE se derivan de las ' +
      'ocupaciones, y SUPER_ADMIN es staff de Vecii.',
  })
  listar() {
    return this.roles.listar();
  }

  @Patch(':codigo')
  @RequierePermiso(PERMISOS.ROLES_GESTIONAR)
  @ApiParam({ name: 'codigo', example: 'CONSEJO' })
  @ApiOperation({
    summary: 'Renombra un rol',
    description:
      'Solo `nombre` y `descripcion`, que son lo que ve la gente: un conjunto puede preferir ' +
      '"Junta Directiva" a "Consejo". El `codigo` nunca cambia — de el dependen los permisos.',
  })
  actualizar(@Param('codigo') codigo: string, @Body() dto: ActualizarRolDto) {
    return this.roles.actualizar(codigo, dto);
  }

  @Put(':codigo/permisos')
  @RequierePermiso(PERMISOS.ROLES_GESTIONAR)
  @ApiParam({ name: 'codigo', example: 'CONSEJO' })
  @ApiOperation({
    summary: 'Define que puede hacer un rol',
    description:
      'Reemplaza la lista COMPLETA: lo que no venga se quita. Este es el punto entero de la ' +
      'tabla `roles_permisos` — cambiar quien puede hacer que sin desplegar codigo.\n\n' +
      'Dos cosas que rechaza: editar SUPER_ADMIN (es staff de Vecii, no un cargo del ' +
      'conjunto) y dejar el sistema sin ningun rol que pueda editar esta matriz.\n\n' +
      'El cambio se ve de inmediato: invalida el cache de permisos, que si no tardaria hasta ' +
      'cinco minutos.\n\n' +
      '**Hoy solo lo puede hacer SUPER_ADMIN.** La matriz es global —`roles_permisos` no tiene ' +
      'conjunto— asi que un administrador editandola cambiaria lo que puede hacer el consejo de ' +
      'todos los conjuntos del pais. Se abre cuando los roles sean por conjunto.',
  })
  reemplazarPermisos(
    @Param('codigo') codigo: string,
    @Body() dto: ReemplazarPermisosDto,
    @ConjuntoActivo() a: Ctx,
  ) {
    return this.roles.reemplazarPermisos(a, codigo, dto);
  }
}
