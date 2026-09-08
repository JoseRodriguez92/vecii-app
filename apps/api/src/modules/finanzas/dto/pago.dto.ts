import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, IsUUID, Length, Min } from 'class-validator';
import { MedioPago } from '../../../generated/prisma/enums.js';

export class RegistrarPagoDto {
  @ApiProperty({ description: 'La unidad que pago. La deuda es de la unidad, no de la persona.' })
  @IsUUID()
  unidadId!: string;

  @ApiProperty({ example: 610000, description: 'En pesos enteros.' })
  @IsInt()
  @Min(1)
  valor!: number;

  @ApiProperty({
    example: '2026-09-15',
    description:
      'Cuando ENTRO la plata, no cuando se digita. Una consignacion del viernes que se registra ' +
      'el lunes vale del viernes: de ahi salen los intereses.',
  })
  @IsDateString()
  recibidoEn!: string;

  @ApiProperty({ enum: MedioPago })
  @IsEnum(MedioPago)
  medio!: MedioPago;

  @ApiPropertyOptional({
    description:
      'El numero de la consignacion o de la transaccion. Es como se concilia, y es lo que impide ' +
      'que el mismo pago entre dos veces.',
  })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  referencia?: string;
}

export class AnularPagoDto {
  @ApiProperty({
    example: 'El cheque reboto',
    description: 'Obligatorio: sin el, dentro de un ano nadie sabe por que se cayo este pago.',
  })
  @IsString()
  @Length(5, 200)
  motivo!: string;
}
