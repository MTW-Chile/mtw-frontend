import { describe, expect, it } from 'vitest';
import { describirVentana, describirVidrios } from './descripcionVentana';

describe('describirVidrios', () => {
  it('agrupa por tipo y suma las unidades', () => {
    expect(
      describirVidrios([
        { codigo_articulo: '5/9/5 INC', descripcion_articulo: 'FLOAT 5mm + Cámara 9mm + FLOAT 5mm INCOLORO', UDS: 1 },
        { codigo_articulo: '5/9/5 INC', descripcion_articulo: 'FLOAT 5mm + Cámara 9mm + FLOAT 5mm INCOLORO', UDS: 1 },
        { codigo_articulo: 'LAM 6', descripcion_articulo: '', UDS: 2 },
      ])
    ).toBe('FLOAT 5mm + Cámara 9mm + FLOAT 5mm INCOLORO (2) + LAM 6 (2)');
  });
});

describe('describirVentana', () => {
  it('sin ventana no hay descripción', () => {
    expect(describirVentana(null)).toBeNull();
  });
  it('una puerta Protex no pasa por el motor de aperturas', () => {
    expect(describirVentana({ tipoLineaManual: 'PROTEX' } as never)).toEqual({ apertura: 'Puerta Protex', composicion: '' });
  });
});
