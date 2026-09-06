import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, Min } from 'class-validator';

/**
 * Las reglas de un espacio. Todas opcionales: un espacio sin politica se puede
 * reservar sin mas restriccion que la capacidad.
 *
 * NO lleva tarifas ni depositos: eso termina en el estado de cuenta y es de
 * finanzas. Aqui solo vive lo que se puede validar sin saber de plata.
 */
export class GuardarPoliticaDto {
  @ApiPropertyOptional({ description: 'El salon casi siempre la pide; el gimnasio nunca.' })
  @IsOptional()
  @IsBoolean()
  requiereAprobacion?: boolean;

  @ApiPropertyOptional({
    description: 'Antelacion MINIMA. Le da tiempo al administrador de preparar y avisarle a porteria.',
    example: 24,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  anticipacionMinimaHoras?: number;

  @ApiPropertyOptional({
    description:
      'Antelacion MAXIMA. Sin esto alguien aparta todos los sabados del ano en enero.',
    example: 30,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  anticipacionMaximaDias?: number;

  @ApiPropertyOptional({ example: 60 })
  @IsOptional()
  @IsInt()
  @Min(1)
  duracionMinimaMinutos?: number;

  @ApiPropertyOptional({ example: 480 })
  @IsOptional()
  @IsInt()
  @Min(1)
  duracionMaximaMinutos?: number;

  @ApiPropertyOptional({ description: 'Cuantas reservas activas puede tener una unidad a la vez.', example: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxSimultaneasPorUnidad?: number;

  @ApiPropertyOptional({ description: 'Cuantas al mes. Impide que el mismo apartamento lo monopolice.', example: 4 })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxMensualesPorUnidad?: number;

  @ApiPropertyOptional({
    description: 'Algunos reglamentos excluyen al arrendatario de ciertos espacios.',
  })
  @IsOptional()
  @IsBoolean()
  soloPropietarios?: boolean;

  @ApiPropertyOptional({
    description:
      'La Ley 675 no lo impone: lo decide cada reglamento. La consulta de mora la resolvera ' +
      'finanzas; hoy este campo se guarda pero todavia no bloquea nada.',
  })
  @IsOptional()
  @IsBoolean()
  bloqueaConMora?: boolean;

  @ApiPropertyOptional({ description: 'Con cuanta antelacion se puede cancelar sin sancion.', example: 24 })
  @IsOptional()
  @IsInt()
  @Min(0)
  cancelacionMinimaHoras?: number;
}
