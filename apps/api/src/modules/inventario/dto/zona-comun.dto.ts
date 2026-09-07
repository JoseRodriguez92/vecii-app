import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { TipoZonaComun } from '../../../generated/prisma/enums.js';

export class CrearZonaComunDto {
  @ApiProperty({ enum: TipoZonaComun, example: TipoZonaComun.SALON_COMUNAL })
  @IsEnum(TipoZonaComun)
  tipo!: TipoZonaComun;

  @ApiProperty({
    description: 'Como la llama el conjunto, no como la llama la ley: "Salon Social", "BBQ Terraza Norte".',
    example: 'Salon Social',
    maxLength: 80,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  nombre!: string;

  @ApiPropertyOptional({
    description:
      'A que parte del conjunto pertenece. Omitido = es de todo el conjunto. La piscina de la ' +
      'Etapa 1 la usan —y la pagan— solo sus unidades.',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  agrupacionId?: string;

  @ApiPropertyOptional({
    description:
      'Si requiere reserva. Un gimnasio suele ser de entrada libre; un salon comunal no. ' +
      'OJO: marcarlo no crea nada. Para que se pueda apartar de verdad hace falta ademas un ' +
      'espacio reservable que apunte aqui (`POST /espacios-reservables`), que es donde viven ' +
      'la capacidad y las reglas.',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  reservable?: boolean;

  @ApiPropertyOptional({
    description: 'Capacidad maxima de personas. Omitido = sin limite declarado.',
    example: 60,
    minimum: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100_000)
  aforo?: number;

  @ApiPropertyOptional({
    description: 'Reglas de uso en texto libre, tal como las redacto el conjunto.',
    maxLength: 4000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  reglasUso?: string;
}

export class ActualizarZonaComunDto extends PartialType(CrearZonaComunDto) {
  @ApiPropertyOptional({
    description:
      'Falso = fuera de servicio (en mantenimiento). No se borra: las reservas historicas que ' +
      'apuntan a ella tienen que seguir teniendo sentido.',
  })
  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
