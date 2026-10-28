import { describe, it, expect } from 'vitest';
import { acotarCantidad, estadoInicialRecepcion, filasDesdeOC, itemsRecepcion, marcarTodas, resumenRecepcion, type FilaRecepcion } from './recepcion';

const oc = {
  items: [
    { id: 'a', descripcion: 'Perfil marco', unidadMedida: 'BARRA', cantidad: 18, recepciones: [], material: { individualizado: true } },
    { id: 'b', descripcion: 'Refuerzo', unidadMedida: 'BARRA', cantidad: 18, recepciones: [{ cantidadRecibida: 6 }], material: { individualizado: true } },
    { id: 'c', descripcion: 'Silicona', unidadMedida: 'UN', cantidad: 2.5, recepciones: [{ cantidadRecibida: 2.5 }] },
    { id: 'd', descripcion: 'Vidrio DVH', unidadMedida: 'UN', cantidad: 1, recepciones: [], anchoMm: 1000, altoMm: 1200, referenciaVentana: 'V01' },
  ],
} as any;

describe('filasDesdeOC', () => {
  it('calcula pedido, ya recibido y pendiente por ítem', () => {
    const filas = filasDesdeOC(oc);
    expect(filas.map((f) => [f.id, f.pedido, f.yaRecibido, f.pendiente])).toEqual([
      ['a', 18, 0, 18],
      ['b', 18, 6, 12],
      ['c', 2.5, 2.5, 0],
      ['d', 1, 0, 1],
    ]);
  });
  it('una pieza a medida se cuenta entera y muestra sus medidas', () => {
    const d = filasDesdeOC(oc)[3];
    expect(d.enteros).toBe(true);
    expect(d.detalle).toBe('Pieza 1000 × 1200 mm · V01');
  });
});

describe('estado y resumen', () => {
  const filas: FilaRecepcion[] = filasDesdeOC(oc);

  it('al abrir, lo pendiente queda marcado con su cantidad completa', () => {
    const estado = estadoInicialRecepcion(filas);
    expect(estado.a).toMatchObject({ marcada: true, cantidad: 18 });
    expect(estado.c.marcada).toBe(false);
    expect(resumenRecepcion(filas, estado)).toEqual({ pendientes: 3, marcadas: 3, unidades: 31, quedaranPendientes: 0 });
  });

  it('una recepción parcial deja la fila pendiente', () => {
    const estado = estadoInicialRecepcion(filas);
    estado.b = { ...estado.b, cantidad: 5 };
    estado.d = { ...estado.d, marcada: false };
    expect(resumenRecepcion(filas, estado)).toEqual({ pendientes: 3, marcadas: 2, unidades: 23, quedaranPendientes: 2 });
  });

  it('"Nada" desmarca y "Llegó todo" vuelve a la cantidad completa', () => {
    let estado = estadoInicialRecepcion(filas);
    estado.a = { ...estado.a, cantidad: 3 };
    estado = marcarTodas(filas, estado, false);
    expect(resumenRecepcion(filas, estado).marcadas).toBe(0);
    estado = marcarTodas(filas, estado, true);
    expect(estado.a).toMatchObject({ marcada: true, cantidad: 18 });
    expect(estado.c.marcada).toBe(false);
  });

  it('no deja recibir más de lo pendiente ni fracciones de una unidad entera', () => {
    expect(acotarCantidad(filas[1], 40)).toBe(12);
    expect(acotarCantidad(filas[1], 2.7)).toBe(3);
    expect(acotarCantidad(filas[1], -1)).toBe(0);
  });

  it('manda solo lo marcado con cantidad, con la observación si marcó dañado', () => {
    const estado = estadoInicialRecepcion(filas);
    estado.a = { ...estado.a, danado: true, observacion: ' llegó rayado ' };
    estado.b = { ...estado.b, cantidad: 0 };
    estado.d = { ...estado.d, danado: false, observacion: 'ignorada' };
    expect(itemsRecepcion(filas, estado)).toEqual([
      { id: 'a', cantidad: 18, observacion: 'llegó rayado' },
      { id: 'd', cantidad: 1, observacion: null },
    ]);
    // Dañado sin texto: queda la constancia igual.
    estado.d = { ...estado.d, danado: true, observacion: '  ' };
    expect(itemsRecepcion(filas, estado)[1]).toEqual({ id: 'd', cantidad: 1, observacion: 'Llegó dañado / incompleto' });
  });
});
