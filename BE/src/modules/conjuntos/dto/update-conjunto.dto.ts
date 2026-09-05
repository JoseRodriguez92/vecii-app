import { PartialType } from '@nestjs/swagger';
import { CreateConjuntoDto } from './create-conjunto.dto.js';

export class UpdateConjuntoDto extends PartialType(CreateConjuntoDto) {}
