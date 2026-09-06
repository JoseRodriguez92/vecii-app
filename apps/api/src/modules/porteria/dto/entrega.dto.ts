import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';
import { EstadoEntrega, TipoEntrega } from '../../../generated/prisma/enums.js';

export class RegistrarEntregaDto {
  @ApiProperty({
    description: 'A que unidad va. Para lo que llega para toda una torre, usar POST /entregas/masiva.',
    format: 'uuid',
  })
  @IsUUID()
  unidadId!: string;

  @ApiProperty({ enum: TipoEntrega, example: TipoEntrega.PAQUETE })
  @IsEnum(TipoEntrega)
  tipo!: TipoEntrega;

  @ApiPropertyOptional({
    description: 'El nombre escrito en el paquete, tal cual. Puede no ser un usuario de la app.',
    example: 'Juan Perez',
    maxLength: 120,
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  destinatario?: string;

  @ApiPropertyOptional({ description: 'Quien lo manda.', example: 'Mercado Libre', maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  remitente?: string;

  @ApiPropertyOptional({
    description:
      'Donde quedo guardada. Omitir si no cupo en la casilla y quedo detras del mostrador. ' +
      'Tiene que ser la casilla de esa misma unidad, o una casilla sin dueno.',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  casilleroId?: string;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  observacion?: string;

  @ApiPropertyOptional({ description: 'Foto de la guia o del paquete.' })
  @IsOptional()
  @IsUrl()
  fotoUrl?: string;
}

export class RegistrarEntregaMasivaDto {
  @ApiPropertyOptional({
    description:
      'A que torre o etapa llego. Omitir si llego para TODO el conjunto. ' +
      'Las unidades de las agrupaciones hijas tambien la ven.',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  agrupacionId?: string;

  @ApiProperty({ enum: TipoEntrega, example: TipoEntrega.CORRESPONDENCIA })
  @IsEnum(TipoEntrega)
  tipo!: TipoEntrega;

  @ApiProperty({ description: 'Quien lo manda.', example: 'Acueducto de Bogota', maxLength: 120 })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  remitente!: string;

  @ApiPropertyOptional({ maxLength: 500, example: 'Recibo del agua, periodo agosto' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  observacion?: string;
}

export class EntregarDto {
  @ApiProperty({
    description: 'Quien se la llevo, tal como lo anota porteria.',
    example: 'Juan Perez',
    maxLength: 120,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  retiradaPorNombre!: string;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  observacion?: string;
}

export class DevolverDto {
  @ApiProperty({
    description: 'Por que se devolvio. Queda como constancia.',
    example: 'Nadie la reclamo en un mes; se devolvio al mensajero',
    maxLength: 500,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  observacion!: string;
}

/** Filtros de la bandeja. Se declara aparte para que Swagger los documente. */
export class FiltroEntregasDto {
  @ApiPropertyOptional({ enum: EstadoEntrega })
  @IsOptional()
  @IsEnum(EstadoEntrega)
  estado?: EstadoEntrega;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  unidadId?: string;
}
