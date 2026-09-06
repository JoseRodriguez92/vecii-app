import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { RelacionUnidad, TipoDocumento } from '../../../generated/prisma/enums.js';
import { ROLES_DEL_SISTEMA } from '../../../common/roles.js';

export class RegistrarUsuarioDto {
  @ApiProperty({ example: 'jose@correo.com' })
  @IsEmail()
  email!: string;

  @ApiPropertyOptional({ example: 'Jose Manuel', maxLength: 80 })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  nombres?: string;

  @ApiPropertyOptional({ example: 'Rodriguez Rodriguez', maxLength: 80 })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  apellidos?: string;

  @ApiPropertyOptional({ enum: TipoDocumento })
  @IsOptional()
  @IsEnum(TipoDocumento)
  tipoDocumento?: TipoDocumento;

  @ApiPropertyOptional({ example: '79123456', maxLength: 20 })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  numeroDocumento?: string;

  @ApiPropertyOptional({ example: '3001234567', maxLength: 20 })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  celular?: string;

  @ApiPropertyOptional({
    description:
      'Unidad donde queda. Omitir para quien no vive aqui: un portero, un administrador externo.',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  unidadId?: string;

  @ApiPropertyOptional({ enum: RelacionUnidad, description: 'Obligatoria si se indica unidad.' })
  @IsOptional()
  @IsEnum(RelacionUnidad)
  relacion?: RelacionUnidad;

  @ApiPropertyOptional({
    enum: ROLES_DEL_SISTEMA.filter((r) => r.asignable).map((r) => r.codigo),
    isArray: true,
    description:
      'Cargos que se le otorgan. Solo la administracion puede darlos, y solo los `asignable`: ' +
      'PROPIETARIO y RESIDENTE no se otorgan, se derivan de la unidad.',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  roles?: string[];
}

export class CerrarVinculoDto {
  @ApiPropertyOptional({
    description: 'Desde cuando deja de vivir ahi. Por defecto, ahora.',
    example: '2026-03-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  hasta?: string;
}
