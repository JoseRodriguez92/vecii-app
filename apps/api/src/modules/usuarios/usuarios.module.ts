import { Module } from '@nestjs/common';
import { AccesoService } from './acceso.service.js';
import { CargosService } from './cargos.service.js';
import { UsuariosController } from './usuarios.controller.js';
import { UsuariosService } from './usuarios.service.js';

/**
 * Las personas del conjunto, en tres piezas que se separaron porque son tres
 * preguntas distintas:
 *
 *   usuarios  quien esta aqui y en que unidad vive
 *   acceso    si ademas puede entrar a la app, y con que cuenta
 *   cargos    que cargo tiene, desde cuando y hasta cuando
 */
@Module({
  controllers: [UsuariosController],
  providers: [UsuariosService, AccesoService, CargosService],
})
export class UsuariosModule {}
