import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CrearReservaDto {
  @ApiProperty({ format: 'uuid', description: 'Que espacio se aparta.' })
  @IsUUID()
  espacioId!: string;

  @ApiProperty({
    format: 'uuid',
    description:
      'Que unidad responde por la reserva. Es la unidad y no la persona porque los cargos y ' +
      'las sanciones van a la unidad, igual que la deuda.',
  })
  @IsUUID()
  unidadId!: string;

  @ApiProperty({ example: '2026-09-12T20:00:00.000Z' })
  @IsDateString()
  inicio!: string;

  @ApiProperty({ example: '2026-09-13T02:00:00.000Z' })
  @IsDateString()
  fin!: string;

  @ApiPropertyOptional({ maxLength: 500, example: 'Cumpleanos de mi hija' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  observacion?: string;
}

export class RechazarReservaDto {
  @ApiProperty({ maxLength: 500, example: 'El salon esta en mantenimiento ese fin de semana' })
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  motivo!: string;
}

export class CancelarReservaDto {
  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  motivo?: string;
}
