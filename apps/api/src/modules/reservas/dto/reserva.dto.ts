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

  @ApiPropertyOptional({
    description:
      '**Obligatorio en una zona comun, opcional en el parqueadero de visitantes.** Se deriva ' +
      'de a que apunta el espacio: una sala se aparta por franja y ahi el fin se sabe; un cupo ' +
      'se ocupa, y nadie sabe a que hora se va su mama. Omitirlo deja la reserva ABIERTA: el ' +
      'cupo sigue ocupado y la cuenta corre hasta que porteria registre la salida.',
    example: '2026-09-13T02:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  fin?: string;

  @ApiPropertyOptional({
    description: 'Para quien es. Solo en el parqueadero: tiene que ser un invitado de esa unidad.',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  invitadoId?: string;

  @ApiPropertyOptional({
    description:
      'El cupo CONCRETO que asigna porteria. La reserva apunta al pool; esto dice cual le toco. ' +
      'Se puede dejar para cuando llegue el carro.',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  parqueaderoId?: string;

  @ApiPropertyOptional({ example: 'ABC123', maxLength: 10 })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  placa?: string;

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

export class RegistrarSalidaDto {
  @ApiPropertyOptional({
    description: 'A que hora salio. Por defecto, ahora.',
    example: '2026-09-12T22:47:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  salidaEn?: string;
}

export class AsignarCupoDto {
  @ApiProperty({ format: 'uuid', description: 'El cupo concreto que se le asigna al llegar.' })
  @IsUUID()
  parqueaderoId!: string;

  @ApiPropertyOptional({ example: 'ABC123', maxLength: 10 })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  placa?: string;
}
