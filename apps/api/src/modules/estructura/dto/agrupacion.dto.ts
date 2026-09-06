import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { TipoAgrupacion } from '../../../generated/prisma/enums.js';

export class CrearAgrupacionDto {
  @ApiProperty({
    enum: TipoAgrupacion,
    description: 'Que es esta agrupacion. Es lo unico que ve el residente.',
    example: TipoAgrupacion.TORRE,
  })
  @IsEnum(TipoAgrupacion)
  tipo!: TipoAgrupacion;

  @ApiProperty({
    description: 'Como la llama la gente del conjunto.',
    example: 'Torre 1',
    maxLength: 80,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  nombre!: string;

  @ApiPropertyOptional({
    description:
      'Agrupacion contenedora. Se usa en conjuntos por etapas: Etapa 2 -> Torre B. ' +
      'Omitir si cuelga directo del conjunto.',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  padreId?: string;
}

export class ActualizarAgrupacionDto extends PartialType(CrearAgrupacionDto) {}
