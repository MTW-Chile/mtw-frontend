import { describe, it, expect } from 'vitest';
import type { Ventana } from '../../../../types';
import { computePreciosVenta } from '../presupuesto';

const ventanaHetmo = (id: string, importeUnitario: number): Ventana =>
  ({ id, origen: 'HETMO', importeUnitario, unidades: 1 }) as unknown as Ventana;

describe('computePreciosVenta — un material agregado a mano se carga a SU ventana', () => {
  it('dos ventanas HETMO con el mismo importe de HETMO, una con un material extra agregado a mano', () => {
    const a = ventanaHetmo('a', 1); // 1 UF
    const b = ventanaHetmo('b', 1); // 1 UF
    const tasaUf = 1000;
    const ventaTotalCLP = 4000; // costoTotalProyectoCLP igual -> margenMultiplicador = 1
    const costoTotalProyectoCLP = 4000;
    // sumaTotalLineas > 0 -- solo se usa como bandera para activar el
    // prorrateo por importeHetmo (ver computePreciosVenta), no entra en la
    // fórmula del peso en sí.
    const sumaTotalLineas = 2;

    // Sin costo extra, misma venta para ambas (peso 1000 CLP cada una).
    const sinExtra = computePreciosVenta([a, b], sumaTotalLineas, ventaTotalCLP, undefined, costoTotalProyectoCLP, tasaUf);
    expect(sinExtra.get('a')!.precioVentaCLP).toBeCloseTo(sinExtra.get('b')!.precioVentaCLP);

    // Con un material de 500 CLP agregado a mano SOLO en "a".
    const costoExtra = (v: Ventana) => (v.id === 'a' ? 500 : 0);
    const conExtra = computePreciosVenta([a, b], sumaTotalLineas, ventaTotalCLP, undefined, costoTotalProyectoCLP, tasaUf, costoExtra);
    // peso_a = 1000 + 500, peso_b = 1000 -> a se lleva 1500/2500 de la venta.
    expect(conExtra.get('a')!.precioVentaCLP).toBeCloseTo((1500 / 2500) * ventaTotalCLP);
    expect(conExtra.get('b')!.precioVentaCLP).toBeCloseTo((1000 / 2500) * ventaTotalCLP);
    // La ventana con el material extra ahora vale más que antes -- el costo
    // quedó cargado a ella, no repartido por igual entre todas.
    expect(conExtra.get('a')!.precioVentaCLP).toBeGreaterThan(sinExtra.get('a')!.precioVentaCLP);
    expect(conExtra.get('b')!.precioVentaCLP).toBeLessThan(sinExtra.get('b')!.precioVentaCLP);
  });
});
