import { Body, Controller, Delete, Get, Param, Patch, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import type { ConjuntoActivo as Ctx } from '../../auth/conjunto-activo.js';
import { ConjuntoActivo } from '../../common/decorators/conjunto-activo.decorator.js';
import { RequierePermiso } from '../../common/decorators/requiere-permiso.decorator.js';
import { ROL, ROLES_DEL_SISTEMA } from '../../common/roles.js';
import { PERMISOS } from '../../common/permisos.js';
import { ActualizarRolDto, CrearRolDto, ReemplazarPermisosDto } from './dto/rol.dto.js';
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
      'marca los que NO se otorgan a mano: PROPIETARIO y RESIDENTE se derivan de las ' +
      'ocupaciones.\n\n' +
      'Los roles de PLATAFORMA solo aparecen si quien pregunta es del equipo de Vecii. Un ' +
      'administrador de conjunto no los ve, porque no los puede otorgar ni editar y verlos en ' +
      'el desplegable solo invita a intentarlo.',
  })
  listar(@ConjuntoActivo() a: Ctx) {
    return this.roles.listar(a);
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
  actualizar(
    @Param('codigo') codigo: string,
    @Body() dto: ActualizarRolDto,
    @ConjuntoActivo() a: Ctx,
  ) {
    return this.roles.actualizar(a, codigo, dto);
  }

  @Post()
  @RequierePermiso(PERMISOS.ROLES_GESTIONAR)
  @ApiOperation({
    summary: 'Crea un cargo propio del conjunto',
    description:
      'Para lo que no cubren los cargos estandar: un "Comite de Deportes", un "Encargado de ' +
      'Mascotas". Nace SIN permisos; se le marcan con PUT /roles/:codigo/permisos.\n\n' +
      'El cargo existe **solo en este conjunto** y nadie mas lo ve. No necesita ninguna regla ' +
      'de aislamiento: el rol ya nace con el conjunto adentro.\n\n' +
      'Y funciona de inmediato sin que nosotros toquemos codigo, porque el sistema pregunta ' +
      'por PERMISOS, no por roles.',
  })
  crear(@Body() dto: CrearRolDto, @ConjuntoActivo() a: Ctx) {
    return this.roles.crear(a, dto);
  }

  @Delete(':codigo')
  @RequierePermiso(PERMISOS.ROLES_GESTIONAR)
  @ApiOperation({
    summary: 'Da de baja un cargo propio',
    description:
      'No borra la fila: cierra los cargos vigentes con `hasta` y le quita los permisos. Las ' +
      'asignaciones historicas la apuntan, y "quien era del comite cuando se aprobo eso" se ' +
      'sigue preguntando. Solo cargos propios.',
  })
  desactivar(@Param('codigo') codigo: string, @ConjuntoActivo() a: Ctx) {
    return this.roles.desactivar(a, codigo);
  }

  @Put(':codigo/permisos')
  @RequierePermiso(PERMISOS.ROLES_GESTIONAR)
  @ApiParam({ name: 'codigo', example: 'CONSEJO' })
  @ApiOperation({
    summary: 'Define que puede hacer un rol',
    description:
      'Reemplaza la lista COMPLETA: lo que no venga se quita. Este es el punto entero de la ' +
      'tabla `roles_permisos` — cambiar quien puede hacer que sin desplegar codigo.\n\n' +
      'Un conjunto edita **sus propios cargos**, no los estandar. Los estandar salen de la Ley ' +
      '675 y los comparten los 400 conjuntos: si necesitas un consejo distinto, crea el tuyo. ' +
      'El equipo de Vecii si puede editar los estandar.\n\n' +
      'Rechaza ademas: los permisos de modulos de PLATAFORMA —esconderlos en la pantalla no ' +
      'seria protegerlos—, editar STAFF_VECII, y dejar el sistema sin ningun rol que pueda ' +
      'editar esta matriz.\n\n' +
      'El cambio se ve de inmediato: invalida el cache de permisos, que si no tardaria hasta ' +
      'cinco minutos.',
  })
  reemplazarPermisos(
    @Param('codigo') codigo: string,
    @Body() dto: ReemplazarPermisosDto,
    @ConjuntoActivo() a: Ctx,
  ) {
    return this.roles.reemplazarPermisos(a, codigo, dto);
  }
}
