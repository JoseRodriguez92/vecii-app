/**
 * Comparar celulares entre lo que escribe una persona y lo que devuelve
 * Supabase.
 *
 * No es lo mismo texto. El administrador teclea "300 123 4567" o "3001234567";
 * Supabase guarda el numero en formato internacional, "573001234567". Comparar
 * las dos cadenas tal cual falla siempre, y falla en silencio: el enlace por
 * telefono simplemente no encontraria a nadie y crearia una persona nueva.
 *
 * Se comparan los ultimos diez digitos, que en Colombia son el numero completo
 * (los celulares son de diez cifras y el indicativo es 57). Es una heuristica y
 * hay que revisarla si algun dia entra un pais con otro largo.
 */
export function claveDeTelefono(valor: string | null | undefined): string | null {
  if (!valor) return null;
  const digitos = valor.replace(/\D/g, '');
  if (digitos.length < 10) return null;
  return digitos.slice(-10);
}
