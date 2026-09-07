import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../../auth/auth-user.js';
import type { ConjuntoActivo as Ctx } from '../../auth/conjunto-activo.js';
import { ConjuntoActivo } from '../../common/decorators/conjunto-activo.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { RequierePermiso } from '../../common/decorators/requiere-permiso.decorator.js';
import { PERMISOS } from '../../common/permisos.js';
import { OtorgarRolDto, TerminarRolDto } from '../roles/dto/rol.dto.js';
import { CerrarVinculoDto, DarAccesoDto, RegistrarUsuarioDto } from './dto/usuario.dto.js';
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
      'Registra a la PERSONA y, en la misma operacion, el vinculo con el conjunto, la ' +
      'ocupacion de la unidad y los cargos. **Queda registrada de una vez**: no hay tramite ' +
      'pendiente ni correo que aceptar, porque ser propietario del 501 es un hecho de la ' +
      'escritura y no depende de un clic.\n\n' +
      'Se identifica por **correo o por documento**, y basta uno de los dos. Con correo se le ' +
      'crea ademas la cuenta y podra entrar. Solo con documento queda registrada **sin ' +
      'acceso**, que es el caso del copropietario que no gestiona, del dueno que vive afuera y ' +
      'de la empresa que compro el local — gente que la Ley 675 obliga a tener en el registro ' +
      'de propietarios y residentes, y que no va a abrir la app nunca. Si despues entrega un ' +
      'correo, se le da acceso con `POST /usuarios/:id/acceso`.\n\n' +
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

  @Post(':id/acceso')
  @RequierePermiso(PERMISOS.USUARIOS_GESTIONAR)
  @ApiOperation({
    summary: 'Le da acceso a la app a alguien ya registrado',
    description:
      'La otra mitad de poder registrar sin correo. La administracion carga el padron un lunes ' +
      'con puros documentos, y la gente va entregando su correo con los meses; esto le engancha ' +
      'la cuenta a la persona que YA existe, en vez de crear una nueva que la duplicaria.\n\n' +
      'Falla si esa persona ya tiene acceso, o si el correo ya es el acceso de otra.',
  })
  darAcceso(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DarAccesoDto,
    @ConjuntoActivo() a: Ctx,
  ) {
    return this.usuarios.darAcceso(a.conjuntoId, id, dto.email);
  }

  @Post(':id/roles')
  @RequierePermiso(PERMISOS.USUARIOS_GESTIONAR)
  @ApiOperation({
    summary: 'Otorga un cargo',
    description:
      'Nombrar al consejo, al revisor fiscal, al comite, a un portero. `desde` acepta una ' +
      'fecha pasada porque es la del PERIODO, no la del clic: la eleccion se registra despues ' +
      'de que paso.\n\n' +
      'Solo los roles `asignable`. PROPIETARIO y RESIDENTE se rechazan: se derivan de las ' +
      'ocupaciones, y otorgarlos a mano dejaria votando en asamblea a quien ya vendio.',
  })
  otorgarRol(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: OtorgarRolDto,
    @ConjuntoActivo() a: Ctx,
    @CurrentUser() user: AuthUser,
  ) {
    return this.usuarios.otorgarRol(a.conjuntoId, id, user.id, dto);
  }

  @Delete(':id/roles/:codigo')
  @RequierePermiso(PERMISOS.USUARIOS_GESTIONAR)
  @ApiOperation({
    summary: 'Termina un cargo',
    description:
      'Cierra con `hasta`, no borra. Para eso existe la vigencia: "quien era consejero cuando ' +
      'se aprobo eso" es una pregunta que se hace en cada asamblea.',
  })
  terminarRol(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('codigo') codigo: string,
    @Body() dto: TerminarRolDto,
    @ConjuntoActivo() a: Ctx,
  ) {
    return this.usuarios.terminarRol(a.conjuntoId, id, codigo, dto);
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
