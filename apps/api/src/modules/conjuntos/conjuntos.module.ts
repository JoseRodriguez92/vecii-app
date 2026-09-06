import { Module } from '@nestjs/common';
import { ConjuntosController } from './conjuntos.controller.js';
import { ConjuntosService } from './conjuntos.service.js';

@Module({
  controllers: [ConjuntosController],
  providers: [ConjuntosService],
  exports: [ConjuntosService],
})
export class ConjuntosModule {}
