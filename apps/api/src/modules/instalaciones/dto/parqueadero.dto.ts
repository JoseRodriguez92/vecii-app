import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { NaturalezaParqueadero } from '../../../generated/prisma/enums.js';

export class CrearParqueaderoDto {
  @ApiProperty({
    enum: NaturalezaParqueadero,
    description:
      'La naturaleza JURIDICA del cupo, y no es cosmetica: define si tiene coeficiente, si paga ' +
      'administracion, si se puede vender, y que origenes admite una asignacion. ' +
      '`PRIVADO` es tuyo (tiene matricula y existe ademas como unidad). `USO_EXCLUSIVO` es un ' +
      'bien comun asignado en exclusiva. `ROTATIVO` se reparte por periodo. `VISITANTES` no se ' +
      'asigna a nadie: se usa por turnos via reservas.',
    example: NaturalezaParqueadero.VISITANTES,
  })
  @IsEnum(NaturalezaParqueadero)
  naturaleza!: NaturalezaParqueadero;

  @ApiProperty({
    description: 'Como esta marcado en el piso.',
    example: 'V-04',
    maxLength: 20,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  identificador!: string;

  @ApiPropertyOptional({
    description: 'A que torre o etapa pertenece. Omitido = del conjunto entero.',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  agrupacionId?: string;

  @ApiPropertyOptional({
    description:
      'Solo para `PRIVADO`: la unidad que ESTE CUPO ES, la que tiene su matricula y su ' +
      'coeficiente. OJO, no es el apartamento al que sirve — eso es una asignacion. Un cupo ' +
      'PRIVADO sin esto queda a medio crear; uno que no es PRIVADO no puede tenerlo.',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  unidadId?: string;

  @ApiPropertyOptional({
    description:
      'Que cabe. Un cupo no es "de carro" o "de moto": en muchos conjuntos en el mismo espacio ' +
      'se guarda el carro Y la moto.',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  admiteCarro?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  admiteMoto?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  cubierto?: boolean;

  @ApiPropertyOptional({ example: 'Sotano 1', maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  ubicacion?: string;
}

export class ActualizarParqueaderoDto extends PartialType(CrearParqueaderoDto) {
  @ApiPropertyOptional({
    description:
      'Falso = fuera de servicio (se inundo, esta en obra). No se borra: las asignaciones y ' +
      'reservas historicas lo referencian.',
  })
  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
