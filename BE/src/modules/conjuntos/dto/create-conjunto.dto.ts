import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, Length } from 'class-validator';

export class CreateConjuntoDto {
  @ApiProperty({ example: 'Conjunto Residencial Los Almendros' })
  @IsString()
  @Length(3, 160)
  nombre!: string;

  @ApiPropertyOptional({ example: '900123456-7' })
  @IsOptional()
  @IsString()
  @Length(5, 20)
  nit?: string;

  @ApiProperty({ example: 'Calle 100 # 15-20' })
  @IsString()
  @Length(3, 200)
  direccion!: string;

  @ApiProperty({ example: 'Bogota' })
  @IsString()
  @Length(2, 80)
  ciudad!: string;

  @ApiProperty({ example: 'Cundinamarca' })
  @IsString()
  @Length(2, 80)
  departamento!: string;

  @ApiPropertyOptional({ example: '6011234567' })
  @IsOptional()
  @IsString()
  @Length(7, 20)
  telefono?: string;

  @ApiPropertyOptional({ example: 'admin@losalmendros.co' })
  @IsOptional()
  @IsEmail()
  email?: string;
}
