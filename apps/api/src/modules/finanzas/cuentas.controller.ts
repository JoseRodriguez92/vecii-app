import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../../auth/auth-user.js';
import type { ConjuntoActivo as Ctx } from '../../auth/conjunto-activo.js';
import { ConjuntoActivo } from '../../common/decorators/conjunto-activo.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { RequierePermiso } from '../../common/decorators/requiere-permiso.decorator.js';
import { PERMISOS } from '../../common/permisos.js';
import { CuentasService } from './cuentas.service.js';
import { EmitirFacturacionDto, GenerarFacturacionDto } from './dto/facturacion.dto.js';
import { FacturacionService } from './facturacion.service.js';

@ApiTags('finanzas · cuentas cobro')
@ApiBearerAuth()
@Controller('cuentas-cobro')
export class CuentasController {
  constructor(
    private readonly cuentas: CuentasService,
    // Emitir es otro acto y otro servicio: alla se decide QUE se cobra, aca solo
    // se muestra.
    private readonly facturacion: FacturacionService,
  ) {}

  @Post('generar')
  @RequierePermiso(PERMISOS.FINANZAS_GESTIONAR)
  @ApiOperation({
    summary: 'Calcula el mes y lo deja en BORRADOR',
    description:
      'Reparte `valorARepartir` entre las unidades por su coeficiente y crea una cuenta por ' +
      'unidad **principal** — el apto 501 recibe una sola, con una linea por su parqueadero y su ' +
      'deposito.\n\n' +
      'No le avisa a nadie: el borrador no existe para el residente. Se puede correr las veces ' +
      'que haga falta; cada corrida **reemplaza** los cobros de administracion y no toca las ' +
      'multas ni los alquileres que puso una persona.\n\n' +
      'Lo que ya se emitio se omite: ahi afuera hay gente que ya vio esa cuenta.\n\n' +
      'Se **niega a facturar** si alguna unidad no tiene coeficiente o si no suman 100%: ' +
      'repartir asi haria que las demas paguen de mas.',
  })
  generar(@Body() dto: GenerarFacturacionDto, @ConjuntoActivo() a: Ctx) {
    return this.facturacion.generar(a.conjuntoId, dto);
  }

  @Post(':periodo/emitir')
  @RequierePermiso(PERMISOS.FINANZAS_GESTIONAR)
  @ApiOperation({
    summary: 'Muestra el mes y arranca el plazo',
    description:
      'Pone fecha de emision y de vencimiento a los borradores del periodo, y avisa por la ' +
      'campanita. Desde aqui la cuenta existe para el residente y volver a generar ya no la ' +
      'toca.\n\n' +
      'El periodo va en la ruta como `2026-09-01`.',
  })
  emitir(
    @Param('periodo') periodo: string,
    @Body() dto: EmitirFacturacionDto,
    @ConjuntoActivo() a: Ctx,
  ) {
    return this.facturacion.emitir(a.conjuntoId, periodo, dto);
  }

  @Get()
  @RequierePermiso(PERMISOS.FINANZAS_LEER)
  @ApiQuery({ name: 'unidadId', required: false })
  @ApiQuery({ name: 'periodo', required: false, example: '2026-09-01' })
  @ApiQuery({ name: 'soloPendientes', required: false, description: 'Solo las que tienen saldo.' })
  @ApiOperation({
    summary: 'La cartera del conjunto: quien debe y cuanto',
    description:
      '`total`, `pagado`, `saldo` y `vencida` **no estan en la tabla**: se calculan al leer, ' +
      'sumando los cobros y restando lo imputado. Por eso `soloPendientes` filtra despues de ' +
      'calcular.',
  })
  listar(
    @ConjuntoActivo() a: Ctx,
    @Query('unidadId') unidadId?: string,
    @Query('periodo') periodo?: string,
    @Query('soloPendientes') soloPendientes?: string,
  ) {
    return this.cuentas.listar(a.conjuntoId, {
      unidadId,
      periodo: periodo ? new Date(periodo) : undefined,
      soloPendientes: soloPendientes === 'true',
    });
  }

  // OJO: va ANTES de ':id', o Express lee "mias" como un id.
  @Get('mias')
  @RequierePermiso(PERMISOS.FINANZAS_MI_UNIDAD, PERMISOS.FINANZAS_LEER)
  @ApiOperation({
    summary: 'Las cuentas de mis unidades',
    description: 'Solo las emitidas: un borrador todavia lo esta revisando la administracion.',
  })
  mias(@ConjuntoActivo() a: Ctx, @CurrentUser() user: AuthUser) {
    return this.cuentas.mias(a.conjuntoId, user.id);
  }

  @Get(':id')
  @RequierePermiso(PERMISOS.FINANZAS_LEER, PERMISOS.FINANZAS_MI_UNIDAD)
  @ApiOperation({
    summary: 'Una cuenta, con sus lineas',
    description:
      'Es a donde lleva el aviso de la campanita: la notificacion guarda `entidad: "cuenta"` y ' +
      'su id.\n\n' +
      'Quien administra ve cualquiera del conjunto; el residente las de sus unidades, y solo ' +
      'emitidas.\n\n' +
      'Devuelve **404 si no puedes verla**, no 403: un 403 confirmaria que el id existe.',
  })
  obtener(
    @Param('id', ParseUUIDPipe) id: string,
    @ConjuntoActivo() a: Ctx,
    @CurrentUser() user: AuthUser,
  ) {
    return this.cuentas.obtener(a, user.id, id);
  }
}
