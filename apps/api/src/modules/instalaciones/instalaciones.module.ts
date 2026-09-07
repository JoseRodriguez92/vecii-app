import { Module } from '@nestjs/common';
import { AsignacionesController } from './asignaciones.controller.js';
import { AsignacionesService } from './asignaciones.service.js';
import { HorariosController } from './horarios.controller.js';
import { HorariosService } from './horarios.service.js';
import { ParqueaderosController } from './parqueaderos.controller.js';
import { ParqueaderosService } from './parqueaderos.service.js';
import { ZonasController } from './zonas.controller.js';
import { ZonasService } from './zonas.service.js';

/**
 * Lo FISICO que el conjunto tiene y la gente usa: zonas comunes y parqueaderos.
 *
 * Es la tercera cosa, distinta de las dos con las que se confunde:
 *
 *   estructura     la propiedad PRIVADA: lo que tiene coeficiente y se vende
 *   instalaciones  lo que se USA: el salon, la piscina, los cupos
 *   reservas       como se REPARTE lo que aqui existe
 *
 * Y se llama asi, y no `bienes_comunes`, porque un parqueadero PRIVADO no es un
 * bien comun —tiene matricula y coeficiente, y existe ademas como unidad— pero
 * vive en la misma tabla que los de visitantes. `instalaciones` no afirma nada
 * sobre quien es dueno, y por eso los cubre a los dos sin mentir.
 *
 * Meter una piscina en `unidades` terminaria, tarde o temprano, en un recibo a
 * nombre de la piscina.
 *
 * Las reglas que cruzan naturaleza y origen —que un cupo privado no se sortee—
 * viven en `reglas-parqueadero.ts`, en funciones puras y con su propia prueba.
 */
@Module({
  controllers: [
    ZonasController,
    HorariosController,
    ParqueaderosController,
    AsignacionesController,
  ],
  providers: [ZonasService, HorariosService, ParqueaderosService, AsignacionesService],
})
export class InstalacionesModule {}
