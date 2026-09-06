import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../../auth/auth-user.js';
import type { ConjuntoActivo as Ctx } from '../../auth/conjunto-activo.js';
import { ConjuntoActivo } from '../../common/decorators/conjunto-activo.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { RequierePermiso } from '../../common/decorators/requiere-permiso.decorator.js';
import { PERMISOS } from '../../common/permisos.js';
import { CerrarVinculoDto, RegistrarUsuarioDto } from './dto/usuario.dto.js';
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

  @Post()
  @RequierePermiso(PERMISOS.USUARIOS_CREAR, PERMISOS.USUARIOS_CREAR_MI_UNIDAD)
  @ApiOperation({
    summary: 'Registra a alguien en el conjunto',
    description:
      'Crea la cuenta en Supabase y, en la misma operacion, el vinculo con el conjunto, ' +
      'la ocupacion de la unidad y los cargos. **La persona queda registrada de una vez**: ' +
      'no hay tramite pendiente ni correo que aceptar, porque ser propietario del 501 es un ' +
      'hecho de la escritura y no depende de un clic.\n\n' +
      'Con `usuarios.crear` se registra en cualquier unidad y se otorgan cargos. Con ' +
      '`usuarios.crear.mi_unidad` —que tiene el propietario— solo en unidades propias y sin ' +
      'cargos: puede meter a su arrendatario, no nombrar un administrador.\n\n' +
      'Registrar solo AGREGA: nunca cierra un vinculo anterior, porque un propietario con ' +
      'parqueadero privado tiene dos unidades y las dos son correctas. Si la persona ya ' +
      'estaba vigente en otra unidad, la respuesta lo dice en `yaVigenteEn` para que decidas ' +
      'si era una mudanza; para cerrarla, PATCH /usuarios/:id/unidades/:unidadId.\n\n' +
      'El correo de acceso todavia NO se envia: falta el SMTP propio. La persona entra con ' +
      '"olvide mi contrasena", que funciona porque la cuenta ya existe.',
  })
  registrar(
    @Body() dto: RegistrarUsuarioDto,
    @ConjuntoActivo() a: Ctx,
    @CurrentUser() user: AuthUser,
  ) {
    return this.usuarios.registrar(a, user.id, dto);
  }

  @Patch(':id/unidades/:unidadId')
  @RequierePermiso(PERMISOS.USUARIOS_GESTIONAR)
  @ApiOperation({
    summary: 'Termina el vinculo de alguien con una unidad',
    description:
      'Se mudo, vendio, se acabo el contrato. Cierra con `hasta`, no borra: hace falta saber ' +
      'quien vivia ahi cuando se genero una cuota vieja.',
  })
  cerrarVinculo(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('unidadId', ParseUUIDPipe) unidadId: string,
    @Body() dto: CerrarVinculoDto,
    @ConjuntoActivo() a: Ctx,
  ) {
    return this.usuarios.cerrarVinculo(a.conjuntoId, id, unidadId, dto);
  }
}
