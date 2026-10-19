import { describe, it, expect } from 'vitest';
import * as core from '../geometryCore';

// Corredera de 3 hojas (apertura 36) con la hoja fija marcada por HETMO en el
// despiece: 40003 = trae SUPLEMENTO FIJO, 40004 = trae GUIA ADICIONAL (tercer riel).
const hoja = (n: number) => ({ tipo_elemento: 40001, numero_ventana: 1, numero_hoja: n, ancho: 1393, alto: 2154 });
const marca = (tipo: number, n: number) => ({ tipo_elemento: tipo, numero_ventana: 1, numero_hoja: n });
const piezas = (raw: unknown[]) =>
  (core.slidingPieces({ apertura: 36, raw, width: 4100 }) as { kind: string; carril: number }[]).map((p) => [p.kind, p.carril]);

describe('corredera con hoja fija declarada en el despiece', () => {
  it('Car Wash V10: móvil-fija-móvil en 2 rieles, las móviles hacia el centro', () => {
    expect(piezas([hoja(1), hoja(2), hoja(3), marca(40003, 2)])).toEqual([['int:right', 1], ['fijo', 2], ['int:left', 1]]);
  });
  it('La Aurora V03B: móvil-móvil-fija en 3 rieles', () => {
    expect(piezas([hoja(1), hoja(2), hoja(3), marca(40003, 3), marca(40004, 3)])).toEqual([['int:right', 1], ['ext:right', 2], ['fijo', 3]]);
  });
  it('sin marcas sigue la regla anterior', () => {
    expect(core.slidingPiecesFromFixedLeaf({ raw: [hoja(1)] }, ['a', 'b', 'c'], [], 4100, {})).toBeNull();
  });
});
