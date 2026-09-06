import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayUnique, IsArray, IsDateString, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ROLES_DEL_SISTEMA } from '../../../common/roles.js';

export class ActualizarRolDto {
  @ApiPropertyOptional({
    description: 'Como lo llama el conjunto. El `codigo` nunca cambia: de el dependen los permisos.',
    example: 'Junta Directiva',
    maxLength: 60,
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  nombre?: string;

  @ApiPropertyOptional({ maxLength: 300 })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  descripcion?: string;
}

export class ReemplazarPermisosDto {
  @ApiProperty({
    type: [String],
    description:
      'La lista COMPLETA de permisos del rol. Es un reemplazo, no un agregado: lo que no ' +
      'venga en la lista se quita.',
    example: ['conjuntos.leer', 'reservas.leer'],
  })
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  permisos!: string[];
}

export class OtorgarRolDto {
  @ApiProperty({
    enum: ROLES_DEL_SISTEMA.filter((r) => r.asignable).map((r) => r.codigo),
    description:
      'Solo los roles `asignable`. PROPIETARIO y RESIDENTE no se otorgan: se derivan de las ' +
      'ocupaciones de la unidad.',
    example: 'CONSEJO',
  })
  @IsString()
  codigo!: string;

  @ApiPropertyOptional({
    description: 'Desde cuando. Por defecto, ahora. Para el consejo, el inicio del periodo.',
    example: '2026-01-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  desde?: string;
}

export class TerminarRolDto {
  @ApiPropertyOptional({
    description: 'Cuando termino el periodo. Por defecto, ahora.',
    example: '2026-12-31T23:59:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  hasta?: string;
}
