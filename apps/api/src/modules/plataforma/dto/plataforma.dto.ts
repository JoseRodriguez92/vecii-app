import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, IsUUID } from 'class-validator';
import { ROLES_DE_PLATAFORMA } from '../../../common/permisos.js';

export class NombrarStaffDto {
  @ApiProperty({ format: 'uuid', description: 'Quien entra al equipo. Ya tiene que ser usuario.' })
  @IsUUID()
  usuarioId!: string;

  @ApiProperty({
    enum: ROLES_DE_PLATAFORMA,
    description:
      'Solo estos. Otorgar CONSEJO por aqui convertiria a alguien en consejero de todos los ' +
      'conjuntos del pais.',
    example: 'SUPER_ADMIN',
  })
  @IsString()
  codigo!: string;

  @ApiPropertyOptional({ description: 'Desde cuando. Por defecto, ahora.' })
  @IsOptional()
  @IsDateString()
  desde?: string;
}

export class RetirarStaffDto {
  @ApiPropertyOptional({ description: 'Cuando dejo el equipo. Por defecto, ahora.' })
  @IsOptional()
  @IsDateString()
  hasta?: string;
}
