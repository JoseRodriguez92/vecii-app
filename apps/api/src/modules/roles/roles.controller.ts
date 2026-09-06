import { Body, Controller, Get, Param, Patch, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { RequierePermiso } from '../../common/decorators/requiere-permiso.decorator.js';
import { PERMISOS } from '../../common/permisos.js';
import { CodigoRol } from '../../generated/prisma/enums.js';
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
  @ApiParam({ name: 'codigo', enum: CodigoRol })
  @ApiOperation({
    summary: 'Renombra un rol',
    description:
      'Solo `nombre` y `descripcion`, que son lo que ve la gente: un conjunto puede preferir ' +
      '"Junta Directiva" a "Consejo". El `codigo` nunca cambia — de el dependen los permisos.',
  })
  actualizar(@Param('codigo') codigo: CodigoRol, @Body() dto: ActualizarRolDto) {
    return this.roles.actualizar(codigo, dto);
  }

  @Put(':codigo/permisos')
  @RequierePermiso(PERMISOS.ROLES_GESTIONAR)
  @ApiParam({ name: 'codigo', enum: CodigoRol })
  @ApiOperation({
    summary: 'Define que puede hacer un rol',
    description:
      'Reemplaza la lista COMPLETA: lo que no venga se quita. Este es el punto entero de la ' +
      'tabla `roles_permisos` — cambiar quien puede hacer que sin desplegar codigo.\n\n' +
      'Dos cosas que rechaza: editar SUPER_ADMIN (es staff de Vecii, no un cargo del ' +
      'conjunto) y dejar el sistema sin ningun rol que pueda editar esta matriz.\n\n' +
      'El cambio se ve de inmediato: invalida el cache de permisos, que si no tardaria hasta ' +
      'cinco minutos.',
  })
  reemplazarPermisos(@Param('codigo') codigo: CodigoRol, @Body() dto: ReemplazarPermisosDto) {
    return this.roles.reemplazarPermisos(codigo, dto);
  }
}
