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
import type { AuthUser } from '../../auth/jwt.strategy.js';
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
  @ApiOperation({ summary: 'Actualiza un conjunto' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateConjuntoDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.conjuntos.update(id, dto, user);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Elimina un conjunto' })
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.conjuntos.remove(id, user);
  }
}
