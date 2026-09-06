/**
 * Filtro de asignaciones de rol vigentes hoy.
 *
 * Es una funcion y no una constante a proposito: una constante congelaria
 * `new Date()` al cargar el modulo, y a partir de ahi el servidor evaluaria la
 * vigencia contra la hora en que arranco. Ese bug tarda semanas en aparecer.
 */
export const rolVigente = () => ({
  OR: [{ hasta: null }, { hasta: { gt: new Date() } }],
});
