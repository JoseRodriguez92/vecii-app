import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class RegistrarBicicletaDto {
  @ApiProperty({ description: 'La unidad a la que pertenece.', format: 'uuid' })
  @IsUUID()
  unidadId!: string;

  @ApiProperty({
    description: 'Como se reconoce a simple vista, que es lo que sirve en el bicicletero.',
    example: 'Trek negra rin 29',
    maxLength: 120,
  })
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  descripcion!: string;

  @ApiPropertyOptional({
    description:
      'El serial del marco. Opcional a proposito: esta grabado abajo y mucha gente no lo tiene ' +
      'a mano; exigirlo dejaria media bicicleteria sin registrar. Pero es lo UNICO que sirve ' +
      'para reclamar una robada, asi que vale la pena insistir.',
    example: 'WTU123K4567',
    maxLength: 40,
  })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  serial?: string;

  @ApiPropertyOptional({ example: 'Trek', maxLength: 40 })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  marca?: string;

  @ApiPropertyOptional({ example: 'Negra', maxLength: 30 })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  color?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  propietarioId?: string;

  @ApiPropertyOptional({ description: 'Desde cuando. Omitido = ahora.' })
  @IsOptional()
  @IsDateString()
  desde?: string;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  observacion?: string;
}

export class ActualizarBicicletaDto extends PartialType(RegistrarBicicletaDto) {}
