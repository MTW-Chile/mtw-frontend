import { describe, it, expect } from 'vitest';
import { computeMaterialesConsolidados } from '../materialesConsolidados';
import type { ProyectoVersion } from '../../../../types';

// Un material que llega por "Reemplazar" en una línea debe quedar marcado,
// y uno que solo viene de la receta HETMO no.
describe('computeMaterialesConsolidados - reemplazado', () => {
  const material = (id: string, familia: string) => ({
    id,
    skuInterno: `SKU-${id}`,
    descripcion: `Material ${id}`,
    familia,
    unidadMedida: 'UN',
    proveedor: null,
  });

  const version = {
    id: 'v1',
    ventanas: [
      {
        id: 'w1',
        materiales: [
          { id: 'mv1', materialId: 'A', origen: 'HETMO', cantidad: 2, precioOrigen: 10, monedaOrigen: '2', material: material('A', 'ACCESORIOS') },
          {
            id: 'mv2',
            materialId: 'B',
            origen: 'PERSONALIZADO',
            cantidad: 2,
            precioOrigen: 10,
            monedaOrigen: '2',
            reemplazaMaterialId: 'A',
            material: material('B', 'ACCESORIOS'),
          },
          { id: 'mv3', materialId: 'C', origen: 'HETMO', cantidad: 1, precioOrigen: 5, monedaOrigen: '2', material: material('C', 'ACCESORIOS') },
        ],
      },
    ],
  } as unknown as ProyectoVersion;

  it('marca solo el material que llegó por reemplazo', () => {
    const consolidados = computeMaterialesConsolidados(version, 950, 1030, 38500, []);
    const porId = new Map(consolidados.map((m) => [m.materialId, m]));
    expect(porId.get('B')?.reemplazado).toBe(true);
    expect(porId.get('C')?.reemplazado).toBe(false);
  });
});
