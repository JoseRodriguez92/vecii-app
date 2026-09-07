import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../../auth/auth-user.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { RequierePermiso } from '../../common/decorators/requiere-permiso.decorator.js';
import { PERMISOS } from '../../common/permisos.js';
import { NombrarStaffDto, RetirarStaffDto } from './dto/plataforma.dto.js';
import { PlataformaService } from './plataforma.service.js';

@ApiTags('plataforma · usuarios')
@ApiBearerAuth()
@Controller('usuarios-plataforma')
export class PlataformaController {
  constructor(private readonly plataforma: PlataformaService) {}

  @Get()
  @RequierePermiso(PERMISOS.PLATAFORMA_STAFF_GESTIONAR)
  @ApiQuery({ name: 'incluirRetirados', required: false })
  @ApiOperation({
    summary: 'El equipo de Vecii',
    description:
      'Un rol de plataforma no cuelga de ningun conjunto: da acceso a TODOS. Por eso no vive ' +
      'en `usuario_conjunto_roles` — ahi un SUPER_ADMIN solo era super admin en el conjunto ' +
      'donde se lo dieron.',
  })
  listar(@Query('incluirRetirados') incluirRetirados?: string) {
    return this.plataforma.listar(incluirRetirados === 'true');
  }

  @Post()
  @RequierePermiso(PERMISOS.PLATAFORMA_STAFF_GESTIONAR)
  @ApiOperation({
    summary: 'Nombra a alguien del equipo',
    description:
      'Solo roles de plataforma, y solo un rol sin conjunto. No interfiere con lo que esa ' +
      'persona sea en su propio conjunto: quien trabaja en Vecii tambien vive en algun lado, y ' +
      'alla sigue siendo propietario del 501.',
  })
  nombrar(@Body() dto: NombrarStaffDto, @CurrentUser() user: AuthUser) {
    return this.plataforma.nombrar(user.id, dto);
  }

  @Delete(':usuarioId/:codigo')
  @RequierePermiso(PERMISOS.PLATAFORMA_STAFF_GESTIONAR)
  @ApiOperation({
    summary: 'Saca a alguien del equipo',
    description:
      'Cierra con `hasta`, no borra: hace falta saber quien tenia acceso a todos los conjuntos ' +
      'cuando paso algo. Rechaza retirar al ultimo, porque no quedaria nadie que pueda nombrar.',
  })
  retirar(
    @Param('usuarioId', ParseUUIDPipe) usuarioId: string,
    @Param('codigo') codigo: string,
    @Body() dto: RetirarStaffDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.plataforma.retirar(user.id, usuarioId, codigo, dto);
  }
}
