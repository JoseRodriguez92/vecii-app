import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsEmail, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { CodigoRol, RelacionUnidad } from '../../../generated/prisma/enums.js';

export class CrearInvitacionDto {
  @ApiProperty({ example: 'residente@ejemplo.com' })
  @IsEmail()
  // Se normaliza aqui porque es la llave con la que se cruza al iniciar sesion:
  // "Jose@X.com" y "jose@x.com" tienen que encontrar la misma invitacion.
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  email!: string;

  @ApiPropertyOptional({
    description: 'Unidad a la que queda vinculada. Omitir para quien no vive aqui (un portero).',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  unidadId?: string;

  @ApiPropertyOptional({
    enum: RelacionUnidad,
    description: 'Obligatorio si se indica unidad.',
    example: RelacionUnidad.ARRENDATARIO,
  })
  @IsOptional()
  @IsEnum(RelacionUnidad)
  relacion?: RelacionUnidad;

  @ApiPropertyOptional({
    enum: CodigoRol,
    isArray: true,
    description:
      'Cargos que se otorgan al aceptar. Solo roles otorgables, y solo quien tiene ' +
      'usuarios.invitar puede asignarlos. Un propietario invitando a su unidad no puede.',
    example: [CodigoRol.PORTERIA],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @IsEnum(CodigoRol, { each: true })
  roles?: CodigoRol[];
}
