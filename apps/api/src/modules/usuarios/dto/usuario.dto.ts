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

export class DarAccesoDto {
  @ApiProperty({
    description:
      'El correo con el que va a entrar. Se le crea la cuenta y se le engancha a la persona ' +
      'que ya existe — no se crea una persona nueva, que la duplicaria.',
    example: 'marta@correo.com',
  })
  @IsEmail()
  email!: string;
}

export class RegistrarUsuarioDto {
  @ApiPropertyOptional({
    description:
      'Si viene, se le crea la cuenta y podra entrar a la app. Si no viene, la persona queda ' +
      'registrada por su documento y sin acceso — que es el caso del copropietario que no ' +
      'gestiona, del dueno que vive afuera, o de la empresa que compro el local. ' +
      'Hace falta esto **o** el documento; los dos a la vez tambien vale.',
    example: 'jose@correo.com',
  })
  @IsOptional()
  @IsEmail()
  email?: string;

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

  @ApiPropertyOptional({
    enum: TipoDocumento,
    description:
      'Junto al numero, es LA identidad de la persona. Todo el mundo tiene documento y no todo ' +
      'el mundo tiene correo. `PPT` es el permiso por proteccion temporal, y `NIT` cuando la ' +
      'unidad la compro una empresa.',
  })
  @IsOptional()
  @IsEnum(TipoDocumento)
  tipoDocumento?: TipoDocumento;

  @ApiPropertyOptional({ example: '79123456', maxLength: 20 })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  numeroDocumento?: string;

  @ApiPropertyOptional({
    description:
      'El celular. Sirve como identidad —basta correo, documento o celular— y es la puerta de ' +
      'entrada de verdad: el dia que exista el OTP, la persona entra con este numero y el ' +
      'sistema la reconoce sin que haya dado correo nunca.',
    example: '3001234567',
    maxLength: 20,
  })
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
