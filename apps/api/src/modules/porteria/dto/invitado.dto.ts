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
import { TipoDocumento } from '../../../generated/prisma/enums.js';

export class AutorizarInvitadoDto {
  @ApiProperty({ description: 'A que unidad viene.', format: 'uuid' })
  @IsUUID()
  unidadId!: string;

  @ApiProperty({ example: 'Rosa Elena Rodriguez', maxLength: 120 })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  nombre!: string;

  @ApiPropertyOptional({ enum: TipoDocumento, example: TipoDocumento.CC })
  @IsOptional()
  @IsEnum(TipoDocumento)
  tipoDocumento?: TipoDocumento;

  @ApiPropertyOptional({
    description: 'Con esto el portero verifica en la puerta que sea quien dice ser.',
    example: '41123456',
    maxLength: 20,
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  numeroDocumento?: string;

  @ApiPropertyOptional({ example: '3001234567', maxLength: 20 })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  telefono?: string;

  @ApiPropertyOptional({ description: 'Si viene en carro.', example: 'ABC123', maxLength: 10 })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  placa?: string;

  @ApiPropertyOptional({
    description: 'Desde cuando puede entrar. Por defecto, ya.',
    example: '2026-09-12T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  desde?: string;

  @ApiPropertyOptional({
    description:
      'Hasta cuando. **Omitir para una autorizacion permanente** —la empleada, el profesor de ' +
      'la nina—. Con fecha, es puntual: el amigo que viene el sabado.',
    example: '2026-09-12T23:59:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  hasta?: string;

  @ApiPropertyOptional({ maxLength: 500, example: 'Empleada domestica, entra de lunes a viernes' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  observacion?: string;
}

/** La unidad no se cambia: si se equivocaron de unidad, se revoca y se crea otra. */
export class ActualizarInvitadoDto extends PartialType(AutorizarInvitadoDto) {
  @ApiPropertyOptional({ readOnly: true, description: 'No se puede cambiar.' })
  declare unidadId?: never;
}
