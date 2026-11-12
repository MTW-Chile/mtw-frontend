import { describe, expect, it } from 'vitest';
import type { FabricacionPieza } from '../../../types';
import { accionesDeLote, esGestionableEnLote, perfilesDeCuadro } from './utils';

const pieza = (o: Partial<FabricacionPieza>): FabricacionPieza => ({
  id: Math.random().toString(36),
  cuadroId: 'c1',
  numeroCuadro: 3,
  unidad: 1,
  codigoArticulo: '11031',
  descripcion: 'HOJA PRIME',
  familia: 'Perfileria',
  acabadoCodigo: 'JB',
  acabadoDescripcion: 'Jet Black',
  longitudMm: 2168,
  longitudInteriorMm: null,
  anguloInicio: 45,
  anguloFin: 45,
  posicion: 'D',
  cortado: null,
  incidencia: false,
  materialId: null,
  ...o,
});

describe('perfilesDeCuadro', () => {
  it('junta los perfiles iguales con su cantidad y sus posiciones', () => {
    const filas = perfilesDeCuadro([pieza({ posicion: 'D' }), pieza({ posicion: 'Z' }), pieza({ posicion: 'S', longitudMm: 1331.5 }), pieza({ posicion: 'I', longitudMm: '1331.5' })]);
    expect(filas).toHaveLength(2);
    expect(filas[0]).toMatchObject({ codigo: '11031', largo: 2168, cantidad: 2, corte: '45° / 45°' });
    expect(filas[0].posiciones).toHaveLength(2);
    expect(filas[1]).toMatchObject({ largo: 1331.5, cantidad: 2 });
  });

  it('toma una sola ventana cuando la línea trae varias iguales', () => {
    const filas = perfilesDeCuadro([pieza({ unidad: 1 }), pieza({ unidad: 2 }), pieza({ unidad: 3 })]);
    expect(filas).toHaveLength(1);
    expect(filas[0].cantidad).toBe(1);
  });

  it('separa el mismo perfil con otro acabado', () => {
    expect(perfilesDeCuadro([pieza({}), pieza({ acabadoCodigo: 'BL', acabadoDescripcion: 'Blanco' })])).toHaveLength(2);
  });
});

describe('accionesDeLote', () => {
  it('Compras: una OC para los que aún no la tienen, o recibir los que están en compra', () => {
    expect(accionesDeLote('COMPRAS', [{ paso: 'INGRESADO' }, { paso: 'RECIBIDO' }])).toEqual(['OC']);
    expect(accionesDeLote('COMPRAS', [{ paso: 'EN_PROCESO_COMPRA' }, { paso: 'EN_PROCESO_COMPRA' }])).toEqual(['RECIBIR']);
  });

  it('Fábrica: a producción o listos para despacho', () => {
    expect(accionesDeLote('FABRICA', [{ paso: 'RECIBIDO' }, { paso: 'EN_PRODUCCION' }])).toEqual(['PRODUCCION', 'LISTO']);
  });

  it('no ofrece nada si van en tramos distintos o ya no se mueven a mano', () => {
    expect(accionesDeLote('COMPRAS', [{ paso: 'RECIBIDO' }, { paso: 'EN_PROCESO_COMPRA' }])).toEqual([]);
    expect(accionesDeLote('FABRICA', [{ paso: 'LISTO_DESPACHO' }])).toEqual([]);
    expect(accionesDeLote('COMPRAS', [])).toEqual([]);
    expect(esGestionableEnLote('COMPRAS', { paso: 'DESPACHADO' })).toBe(false);
    expect(esGestionableEnLote('FABRICA', { paso: 'INGRESADO' })).toBe(true);
    // Pendiente de una obra cotizada (sin pasos).
    expect(esGestionableEnLote('FABRICA', { paso: null })).toBe(false);
  });
});
