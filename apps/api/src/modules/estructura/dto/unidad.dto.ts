import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { TipoUnidad } from '../../../generated/prisma/enums.js';

export class CrearUnidadDto {
  @ApiProperty({ description: 'Como esta marcada la puerta.', example: '101', maxLength: 40 })
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  identificador!: string;

  @ApiProperty({ enum: TipoUnidad, example: TipoUnidad.APARTAMENTO })
  @IsEnum(TipoUnidad)
  tipo!: TipoUnidad;

  @ApiPropertyOptional({
    description: 'Agrupacion a la que pertenece. Omitir si cuelga directo del conjunto.',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  agrupacionId?: string;

  @ApiPropertyOptional({ description: 'Planta a la que responde.', format: 'uuid' })
  @IsOptional()
  @IsUUID()
  tipologiaId?: string;

  @ApiPropertyOptional({
    description:
      'Coeficiente de copropiedad, tal como esta en el reglamento. Ej: 0.004521 = 0.4521%. ' +
      'Omitir si todavia no se conoce: null significa "sin cargar", y el sistema NO factura ' +
      'unidades sin coeficiente. Nunca poner 0 para "no se".',
    example: 0.004521,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 6 })
  @Min(0)
  @Max(1)
  coeficiente?: number;

  @ApiPropertyOptional({
    description: 'Solo si esta unidad se salio del molde de su tipologia. Si no, hereda.',
    example: 72.5,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  @Max(999999)
  areaM2?: number;

  @ApiPropertyOptional({
    description:
      'La unidad con la que ESTA se vendio, si es accesoria. Comprar el apto 501 es comprar el ' +
      'apartamento, el parqueadero 34 y el deposito 12: tres unidades con matricula y ' +
      'coeficiente propios que nunca se venden aparte. Se pone en el parqueadero y en el ' +
      'deposito, apuntando al apartamento. Un solo nivel: una accesoria no puede tener ' +
      'accesorias.',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  unidadPrincipalId?: string;
}

export class ActualizarUnidadDto extends PartialType(CrearUnidadDto) {}

export class ImportarUnidadesDto {
  @ApiProperty({
    type: [CrearUnidadDto],
    description:
      'Lote de unidades. Se procesa en una transaccion: o entran todas o no entra ninguna, ' +
      'para que un archivo con un error en la fila 150 no deje el conjunto a medio cargar.',
    maxItems: 1000,
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(1000)
  @ValidateNested({ each: true })
  @Type(() => CrearUnidadDto)
  unidades!: CrearUnidadDto[];
}
