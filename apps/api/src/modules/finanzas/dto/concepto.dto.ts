import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsNumber, IsOptional, IsString, Length, Min } from 'class-validator';

export class CrearConceptoDto {
  @ApiProperty({ example: 'Alquiler salon social', description: 'Como lo ve el residente en su cuenta.' })
  @IsString()
  @Length(3, 80)
  nombre!: string;

  @ApiPropertyOptional({
    example: 200000,
    description:
      'Precio fijo, cuando lo tiene. Omitir cuando el valor se calcula caso por caso —una multa ' +
      'que varia, un cobro puntual—: entonces se escribe al momento de cobrarlo.',
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  tarifa?: number;

  @ApiPropertyOptional({
    default: false,
    description: 'Un descuento resta en vez de sumar. Ej: descuento por pronto pago.',
  })
  @IsOptional()
  @IsBoolean()
  esDescuento?: boolean;
}

export class ActualizarConceptoDto extends PartialType(CrearConceptoDto) {
  @ApiPropertyOptional({ description: 'Falso = ya no se cobra. No se borra: los cobros viejos lo siguen nombrando.' })
  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
