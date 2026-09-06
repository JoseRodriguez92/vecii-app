import { Module } from '@nestjs/common';
import { PlataformaController } from './plataforma.controller.js';
import { PlataformaService } from './plataforma.service.js';

/** El equipo de Vecii. Roles que no pertenecen a ningun conjunto. */
@Module({
  controllers: [PlataformaController],
  providers: [PlataformaService],
})
export class PlataformaModule {}
