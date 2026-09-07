import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { OrigenAsignacion } from '../../../generated/prisma/enums.js';

export class CrearAsignacionDto {
  @ApiProperty({
    description:
      'La unidad que tiene el derecho a usar el cupo. Es la unidad y no la persona porque el ' +
      'derecho va pegado al apartamento: si el arrendatario se va, el cupo sigue siendo del 501.',
    format: 'uuid',
  })
  @IsUUID()
  unidadId!: string;

  @ApiProperty({
    enum: OrigenAsignacion,
    description:
      'De donde sale el derecho. Tiene que casar con la naturaleza del cupo: un `PRIVADO` no se ' +
      'sortea, un `ROTATIVO` no se compra, y un cupo de `VISITANTES` no se asigna en absoluto. ' +
      'Si no casa, la respuesta explica por que.',
    example: OrigenAsignacion.SORTEO,
  })
  @IsEnum(OrigenAsignacion)
  origen!: OrigenAsignacion;

  @ApiPropertyOptional({
    description: 'Desde cuando rige. Omitido = ahora.',
    example: '2026-01-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  desde?: string;

  @ApiPropertyOptional({ example: 'Sorteo anual 2026, acta 14', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  observacion?: string;
}

export class CerrarAsignacionDto {
  @ApiPropertyOptional({
    description:
      'Cuando dejo de regir. Omitido = ahora. No se borra la fila: hace falta cuando alguien ' +
      'reclame que ese cupo era suyo el ano pasado.',
    example: '2026-12-31T23:59:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  hasta?: string;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  observacion?: string;
}
