/**
 * La placa como la teclea porteria: en mayusculas y sin separadores.
 *
 * Vive en `common` porque la escriben dos modulos —el registro del vehiculo y
 * la reserva del parqueadero— y tienen que normalizarla IGUAL. Si uno guarda
 * "ABC123" y el otro "abc-123", la busqueda de porteria en la puerta no
 * encuentra el carro que esta viendo.
 */
export function normalizarPlaca(placa: string): string {
  return placa.toUpperCase().replace(/[\s-]/g, '');
}

/** La misma regla cuando la placa puede no venir: un invitado a pie no trae. */
export function normalizarPlacaOpcional(placa?: string | null): string | null {
  return placa ? normalizarPlaca(placa) : null;
}
