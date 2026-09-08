import { describe, expect, it } from 'vitest';
import { type AlColgar, problemaAlColgar } from './reglas-unidad-accesoria.js';

const colgar = (p: Partial<AlColgar> = {}): AlColgar => ({
  identificador: 'P-34',
  accesorias: 0,
  principal: { identificador: '501', yaEsAccesoria: false, esLaMisma: false },
  ...p,
});

describe('colgar una unidad de otra', () => {
  it('el parqueadero cuelga del apartamento: es el caso normal', () => {
    expect(problemaAlColgar(colgar())).toBeNull();
  });

  it('la principal tiene que existir en este conjunto', () => {
    expect(problemaAlColgar(colgar({ principal: null }))).toContain('no existe');
  });

  it('una unidad no se vende consigo misma', () => {
    const p = { identificador: 'P-34', yaEsAccesoria: false, esLaMisma: true };
    expect(problemaAlColgar(colgar({ principal: p }))).toContain('consigo misma');
  });
});

describe('el arbol tiene exactamente dos niveles', () => {
  it('no se cuelga de una que ya cuelga de otra (hacia abajo)', () => {
    const p = { identificador: 'P-34', yaEsAccesoria: true, esLaMisma: false };
    expect(problemaAlColgar(colgar({ principal: p }))).toContain('un solo nivel');
  });

  it('una que YA es principal no se puede volver accesoria (hacia arriba)', () => {
    // Este era el hueco: el 501 tiene el parqueadero y el deposito colgando, y
    // alguien lo cuelga del 302. Queda P-34 -> 501 -> 302, y al facturar el 501
    // y su parqueadero se quedan sin recibo sin que nadie lo note.
    const problema = problemaAlColgar(colgar({ identificador: '501', accesorias: 2 }));
    expect(problema).toContain('ya es principal');
    expect(problema).toContain('2 unidades accesorias');
  });

  it('lo dice en singular cuando es una sola', () => {
    expect(problemaAlColgar(colgar({ accesorias: 1 }))).toContain('1 unidad accesoria');
  });
});
