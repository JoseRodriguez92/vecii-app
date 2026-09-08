import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsInt, IsOptional, Min } from 'class-validator';

export class GenerarFacturacionDto {
  @ApiProperty({
    example: '2026-09-01',
    description: 'El mes que se factura. Se usa el primer dia; el resto de la fecha se ignora.',
  })
  @IsDateString()
  periodo!: string;

  @ApiProperty({
    example: 24000000,
    description:
      'Lo que hay que repartir entre las unidades este mes, en pesos enteros. Sale del ' +
      'presupuesto anual aprobado en asamblea, dividido en doce.',
  })
  @IsInt()
  @Min(1)
  valorARepartir!: number;
}

export class EmitirFacturacionDto {
  @ApiProperty({
    example: '2026-09-10',
    description: 'Desde cuando genera mora. Es la fecha que el residente ve como "pagar antes de".',
  })
  @IsDateString()
  venceEl!: string;

  @ApiPropertyOptional({
    description:
      'Avisarle a los residentes por la campanita. Por defecto si: emitir sin avisar deja la ' +
      'cuenta esperando a que alguien entre a mirar.',
    default: true,
  })
  @IsOptional()
  avisar?: boolean;
}
