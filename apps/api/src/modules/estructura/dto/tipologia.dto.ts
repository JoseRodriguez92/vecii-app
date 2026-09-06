import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CrearTipologiaDto {
  @ApiProperty({ description: 'Como la nombra el conjunto.', example: 'Tipo A', maxLength: 80 })
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  nombre!: string;

  @ApiProperty({ description: 'Area privada construida, en m2.', example: 65.5 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  @Max(999999)
  areaM2!: number;

  @ApiProperty({ example: 2 })
  @IsInt()
  @Min(0)
  @Max(50)
  habitaciones!: number;

  @ApiProperty({ example: 2 })
  @IsInt()
  @Min(0)
  @Max(50)
  banos!: number;

  @ApiPropertyOptional({
    description: 'Lo que no cabe en campos: balcon, estudio, cuarto util, vista.',
    example: 'Con balcon y cuarto util',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  descripcion?: string;

  @ApiPropertyOptional({ description: 'Imagen de la planta.' })
  @IsOptional()
  @IsUrl()
  planoUrl?: string;
}

export class ActualizarTipologiaDto extends PartialType(CrearTipologiaDto) {}
