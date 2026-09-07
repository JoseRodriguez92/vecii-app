import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsEnum, IsInt, Max, Min, ValidateNested } from 'class-validator';
import { DiaSemana } from '../../../generated/prisma/enums.js';

export class FranjaDto {
  @ApiProperty({ enum: DiaSemana, example: DiaSemana.LUNES })
  @IsEnum(DiaSemana)
  dia!: DiaSemana;

  @ApiProperty({
    description: 'Minutos desde medianoche. 0 = 00:00, 480 = 08:00, 1439 = 23:59.',
    example: 480,
    minimum: 0,
    maximum: 1439,
  })
  @IsInt()
  @Min(0)
  @Max(1439)
  apertura!: number;

  @ApiProperty({
    description:
      'Idem. 1440 = medianoche del dia siguiente. Tiene que ser mayor que `apertura`: un ' +
      'evento que pasa de medianoche es asunto de la reserva, no del horario.',
    example: 1320,
    minimum: 1,
    maximum: 1440,
  })
  @IsInt()
  @Min(1)
  @Max(1440)
  cierre!: number;
}

export class ReemplazarHorariosDto {
  @ApiProperty({
    type: [FranjaDto],
    description:
      'La semana COMPLETA. Lo que mandes reemplaza lo que habia: un dia sin franjas queda ' +
      'cerrado. Se hace asi y no una franja a la vez porque la pantalla que edita esto es un ' +
      'horario semanal, y guardarlo en pedazos deja estados a medias si el usuario se va. ' +
      'Varias franjas del mismo dia son un horario partido (abre, cierra al mediodia, reabre).',
  })
  @IsArray()
  @ArrayMaxSize(70)
  @ValidateNested({ each: true })
  @Type(() => FranjaDto)
  franjas!: FranjaDto[];
}
