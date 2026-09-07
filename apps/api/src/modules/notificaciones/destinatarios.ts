/**
 * A quien le llega un aviso.
 *
 * Cinco formas, y la ultima es la que hace que esto envejezca bien: se avisa a
 * quien tenga un PERMISO, no a quien tenga un cargo. Si manana un conjunto
 * inventa un "Comite de Deportes" y le da `reservas.administrar`, las
 * notificaciones le llegan solas; si se lo quitan, dejan de llegarle. Nadie
 * tiene que acordarse de mantener una lista.
 *
 * Es la misma razon por la que el guard pregunta por permisos y no por roles.
 * Hacerlo por rol seria el unico lugar del sistema donde el codigo vuelve a
 * nombrar cargos.
 */
export type Destinatario =
  /** Una persona concreta: el que reservo. */
  | { persona: string }
  /** Los residentes vigentes de una unidad: el paquete del 501. */
  | { unidad: string }
  /** Los de toda una torre o etapa, incluidas las que cuelgan de ella: el recibo del agua. */
  | { agrupacion: string }
  /** Todos los del conjunto: la cartelera. */
  | { conjunto: true }
  /** Quien pueda hacer algo: la reserva que espera aprobacion. */
  | { permiso: string };
