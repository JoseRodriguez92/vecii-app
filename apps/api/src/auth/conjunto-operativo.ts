import { EstadoConjunto } from '../generated/prisma/enums.js';

/**
 * Si un conjunto deja entrar a su gente hoy, y que decirle cuando no.
 *
 * `EstadoConjunto` existia desde el principio y nadie lo consultaba: se podia
 * marcar un conjunto como `SUSPENDIDO` y sus 500 residentes seguian entrando
 * igual. Suspender es la palanca de cobranza del negocio —y lo unico que hace
 * que dejar de pagar tenga consecuencia—, asi que la regla vive aca, sola y
 * probada, y no repartida en cada guard que se le ocurra preguntar.
 *
 * La regla es una sola frase: **entra la gente del conjunto mientras el
 * conjunto no este suspendido ni cancelado**. El equipo de Vecii entra siempre,
 * y esa excepcion no es un descuido: es Vecii quien suspende, y quien tiene que
 * poder mirar adentro para explicar la factura y para reactivar.
 */

/**
 * Por que no se puede entrar, o `null` si se puede.
 *
 * Es un mapa exhaustivo a proposito: agregar un valor a `EstadoConjunto` sin
 * decidir que pasa con el rompe la compilacion, en vez de dejar entrar a todo
 * el mundo por descuido.
 */
const MOTIVO_POR_ESTADO: Record<EstadoConjunto, string | null> = {
  /** Todavia esta cargando unidades y coeficientes, pero su gente ya entra. */
  EN_IMPLEMENTACION: null,
  ACTIVO: null,
  SUSPENDIDO:
    'Este conjunto esta suspendido temporalmente. Comunicate con la administracion de tu conjunto.',
  CANCELADO:
    'Este conjunto ya no usa Vecii. Comunicate con la administracion de tu conjunto.',
};

/**
 * El texto que ve la persona, o `null` si puede pasar.
 *
 * Una sola funcion y no un `esOperativo()` mas un `motivoDe()`: dos funciones
 * son dos cosas que se pueden contradecir, y el dia que no coincidan alguien
 * queda afuera con un mensaje que dice que todo esta bien.
 */
export function motivoParaNoEntrar(estado: EstadoConjunto): string | null {
  return MOTIVO_POR_ESTADO[estado];
}
