import { Module } from '@nestjs/common';
import { HorariosController } from './horarios.controller.js';
import { HorariosService } from './horarios.service.js';
import { ZonasController } from './zonas.controller.js';
import { ZonasService } from './zonas.service.js';

/**
 * El inventario FISICO del conjunto: lo que existe en el mundo y es de todos.
 *
 * Es la tercera cosa, distinta de las otras dos con las que se confunde:
 *
 *   estructura  la propiedad PRIVADA: lo que tiene coeficiente y se vende
 *   inventario  los bienes COMUNES: no se venden y no pagan administracion
 *   reservas    como se REPARTE lo que aqui existe
 *
 * Meter una piscina en `unidades` terminaria, tarde o temprano, en un recibo a
 * nombre de la piscina.
 *
 * Falta la otra mitad: parqueaderos y sus asignaciones.
 */
@Module({
  controllers: [ZonasController, HorariosController],
  providers: [ZonasService, HorariosService],
})
export class InventarioModule {}
