import { describe, expect, it } from 'vitest';
import { normalizarPlaca, normalizarPlacaOpcional } from './placa.js';

describe('la placa', () => {
  it('se guarda como la teclea porteria: mayusculas y sin separadores', () => {
    expect(normalizarPlaca('abc 123')).toBe('ABC123');
    expect(normalizarPlaca('abc-123')).toBe('ABC123');
    expect(normalizarPlaca('ABC123')).toBe('ABC123');
  });

  it('sin placa es null, no cadena vacia: no vino el dato', () => {
    expect(normalizarPlacaOpcional(undefined)).toBeNull();
    expect(normalizarPlacaOpcional(null)).toBeNull();
    expect(normalizarPlacaOpcional('')).toBeNull();
  });

  it('las dos versiones normalizan igual: es una sola regla', () => {
    expect(normalizarPlacaOpcional('abc-123')).toBe(normalizarPlaca('abc-123'));
  });
});
