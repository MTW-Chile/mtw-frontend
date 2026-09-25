import { describe, it, expect } from 'vitest';
import type { ProyectoVersion } from '../../../../types';
import { computeMaterialesConsolidados } from '../materialesConsolidados';

const version = (precioPersonalizado: number | null) =>
  ({
    ventanas: [
      {
        materiales: [
          {
            id: 'mv1',
            materialId: 'mat-perfil',
            cantidad: 31,
            longitudMm: 0,
            origen: 'HETMO',
            excluido: false,
            precioOrigen: 10,
            monedaOrigen: null,
            material: { id: 'mat-perfil', skuInterno: '91315', descripcion: 'TAPA CANAL HERRAJE', familia: 'Perfileria', unidadMedida: 'UN' },
          },
        ],
      },
    ],
    materialAjustes:
      precioPersonalizado == null
        ? []
        : [{ materialId: 'mat-perfil', precioPersonalizado, monedaPersonalizada: 'CLP', familiaPersonalizada: null, excluido: false }],
    materialesResumen: [{ materialId: 'mat-perfil', cantidadHetmo: 31 }],
  }) as unknown as ProyectoVersion;

describe('computeMaterialesConsolidados — precio por barra de Perfileria', () => {
  it('expone el factor de barra que multiplica precioCLP', () => {
    const [m] = computeMaterialesConsolidados(version(1690), 950, 1030, 38500, []);
    expect(m.factorBarra).toBe(5.8);
    expect(m.precioCLP).toBeCloseTo(1690 * 5.8);
  });

  it('guardar precioCLP / factorBarra deja la columna CLP en el valor escrito', () => {
    const escritoEnColumnaClp = 1690;
    const [antes] = computeMaterialesConsolidados(version(1690), 950, 1030, 38500, []);
    const [despues] = computeMaterialesConsolidados(version(escritoEnColumnaClp / antes.factorBarra), 950, 1030, 38500, []);
    expect(despues.precioCLP).toBeCloseTo(escritoEnColumnaClp);
  });
});
