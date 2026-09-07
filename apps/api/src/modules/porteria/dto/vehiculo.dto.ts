import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { TipoVehiculo } from '../../../generated/prisma/enums.js';

export class RegistrarVehiculoDto {
  @ApiProperty({ description: 'La unidad a la que pertenece el vehiculo.', format: 'uuid' })
  @IsUUID()
  unidadId!: string;

  @ApiProperty({ enum: TipoVehiculo, example: TipoVehiculo.CARRO })
  @IsEnum(TipoVehiculo)
  tipo!: TipoVehiculo;

  @ApiProperty({
    description:
      'Se guarda en mayusculas y sin espacios ni guiones, como la teclea porteria en la puerta. ' +
      'Da igual como la escribas.',
    example: 'ABC123',
    maxLength: 10,
  })
  @IsString()
  @MinLength(4)
  @MaxLength(10)
  placa!: string;

  @ApiPropertyOptional({ example: 'Renault', maxLength: 40 })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  marca?: string;

  @ApiPropertyOptional({ example: 'Gris', maxLength: 30 })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  color?: string;

  @ApiPropertyOptional({
    description:
      'De quien es, si se sabe. Opcional a proposito: muchas veces el carro es de la empresa o ' +
      'del papa, y exigirlo llevaria a inventar un dato.',
    format: 'uuid',
  })
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

export class ActualizarVehiculoDto extends PartialType(RegistrarVehiculoDto) {}
