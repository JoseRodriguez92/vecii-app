import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { ConjuntoActivo } from '../../common/decorators/conjunto-activo.decorator.js';
import { RequierePermiso } from '../../common/decorators/requiere-permiso.decorator.js';
import { PERMISOS } from '../../common/permisos.js';
import type { ConjuntoActivo as Ctx } from '../../auth/conjunto-activo.js';
import type { AuthUser } from '../../auth/auth-user.js';
import { ConjuntosService } from './conjuntos.service.js';
import { CreateConjuntoDto } from './dto/create-conjunto.dto.js';
import { UpdateConjuntoDto } from './dto/update-conjunto.dto.js';

@ApiTags('conjuntos')
@ApiBearerAuth()
@Controller('conjuntos')
export class ConjuntosController {
  constructor(private readonly conjuntos: ConjuntosService) {}

  @Get()
  @ApiOperation({ summary: 'Lista los conjuntos del usuario autenticado' })
  findMine(@CurrentUser() user: AuthUser) {
    return this.conjuntos.findMine(user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de un conjunto' })
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.conjuntos.findOne(id, user);
  }

  @Post()
  @ApiOperation({ summary: 'Crea un conjunto (el creador queda como administrador)' })
  create(@Body() dto: CreateConjuntoDto, @CurrentUser() user: AuthUser) {
    return this.conjuntos.create(dto, user);
  }

  @Patch(':id')
  @RequierePermiso(PERMISOS.CONJUNTOS_EDITAR)
  @ApiOperation({ summary: 'Actualiza un conjunto' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateConjuntoDto,
    @ConjuntoActivo() activo: Ctx,
  ) {
    return this.conjuntos.update(id, dto, activo);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequierePermiso(PERMISOS.CONJUNTOS_ELIMINAR)
  @ApiOperation({ summary: 'Elimina un conjunto' })
  remove(@Param('id', ParseUUIDPipe) id: string, @ConjuntoActivo() activo: Ctx) {
    return this.conjuntos.remove(id, activo);
  }
}
