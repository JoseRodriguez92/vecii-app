import { SetMetadata } from '@nestjs/common';
import type { RolMembresia } from '../../generated/prisma/enums.js';

export const ROLES_KEY = 'roles';

/**
 * Exige que el usuario tenga al menos uno de estos roles en el conjunto
 * indicado por la cabecera `x-conjunto-id`. Requiere `RolesGuard`.
 */
export const Roles = (...roles: RolMembresia[]) => SetMetadata(ROLES_KEY, roles);
