import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from 'class-validator';
import { NaturalezaParqueadero } from '../../../generated/prisma/enums.js';

export class CrearEspacioDto {
  @ApiProperty({ example: 'Parqueadero de visitantes', maxLength: 80 })
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  nombre!: string;

  @ApiProperty({
    description:
      'Cuantas reservas simultaneas admite. **1 = exclusivo** (el salon comunal). ' +
      '50 = el pool de visitantes. Un gimnasio con aforo 15 encaja igual.',
    example: 50,
    minimum: 1,
  })
  @IsInt()
  @Min(1)
  @Max(1000)
  capacidad!: number;

  @ApiPropertyOptional({
    description: 'Si el espacio ES una zona comun concreta. Excluyente con `naturalezaParqueadero`.',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  zonaComunId?: string;

  @ApiPropertyOptional({
    enum: NaturalezaParqueadero,
    description:
      'Si el espacio es un POOL de parqueaderos. Normalmente `VISITANTES`. ' +
      'Excluyente con `zonaComunId`.',
  })
  @IsOptional()
  @IsEnum(NaturalezaParqueadero)
  naturalezaParqueadero?: NaturalezaParqueadero;

  @ApiPropertyOptional({
    description:
      'Acota el pool a una parte del conjunto: la Etapa 1 tiene sus 20 cupos y la Etapa 2 ' +
      'otros 30, y no son intercambiables.',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  agrupacionId?: string;
}

export class ActualizarEspacioDto extends PartialType(CrearEspacioDto) {
  @ApiPropertyOptional({ description: 'Falso = fuera de servicio. No se borra.' })
  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
