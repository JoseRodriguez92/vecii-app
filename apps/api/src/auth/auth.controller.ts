import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { AuthUser } from './auth-user.js';
import { AuthService } from './auth.service.js';

@ApiTags('auth')
@ApiBearerAuth()
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('me')
  @ApiOperation({
    summary: 'Quien entro, donde puede entrar, y que puede hacer en cada lado',
    description:
      'La primera llamada de la app. **No lleva `x-conjunto-id`**: es la que dice cuales hay.\n\n' +
      'Cada conjunto viene con sus `permisos` ya resueltos, que es con lo que se arma el menu. ' +
      'Los `roles` van al lado para poder mostrarlos ("Consejo", "Porteria"), pero **no se ' +
      'decide nada con ellos**: propietario y residente no se otorgan, se derivan de tener una ' +
      'unidad, y un conjunto puede inventarse un "Comite de Deportes" con los permisos que ' +
      'quiera. Preguntar por rol es apostar a una lista que cambia sin avisar.\n\n' +
      'Es el mismo calculo que hace el guard en cada peticion, asi que lo que aparezca aqui es ' +
      'exactamente lo que la API va a dejar pasar.\n\n' +
      '`unidades` son las de la persona en ese conjunto, hoy: es "mi apartamento" para todo lo ' +
      'que venga despues.\n\n' +
      '`id` de cada conjunto es lo que va en la cabecera `x-conjunto-id`; `vinculoId` es otra ' +
      'cosa y casi nunca hace falta.',
  })
  me(@CurrentUser() user: AuthUser) {
    return this.authService.me(user);
  }
}
