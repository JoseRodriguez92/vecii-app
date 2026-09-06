import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class CrearCasilleroDto {
  @ApiProperty({ description: 'Como esta marcada la casilla.', example: 'C-501', maxLength: 40 })
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  identificador!: string;

  @ApiPropertyOptional({
    description:
      'De que unidad es. Omitir para las casillas que no son de nadie: la de la ' +
      'administracion, la del consejo.',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  unidadId?: string;

  @ApiPropertyOptional({
    description: 'A que porteria pertenece. Omitir si el conjunto tiene una sola.',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  agrupacionId?: string;
}

export class ActualizarCasilleroDto extends PartialType(CrearCasilleroDto) {
  @ApiPropertyOptional({
    description: 'Falso = fuera de servicio. No se borra: las entregas viejas la referencian.',
  })
  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

export class ImportarCasillerosDto {
  @ApiProperty({
    type: [CrearCasilleroDto],
    description: 'Todo o nada: si una fila falla, no entra ninguna.',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(1000)
  @ValidateNested({ each: true })
  @Type(() => CrearCasilleroDto)
  casilleros!: CrearCasilleroDto[];
}
