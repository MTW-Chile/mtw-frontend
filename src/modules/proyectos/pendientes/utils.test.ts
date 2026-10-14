import { describe, it, expect } from 'vitest';
import {
  codigoPendiente,
  varianteEstadoPendiente,
  textoEstadoPendiente,
  etapasPara,
  sugerirDescripcion,
  referenciaPendiente,
  contarPorEstado,
  areaDelPendiente,
  exigeResponsable,
  admiteRectificacion,
  leerMilimetros,
  tituloPendiente,
  textoRectificacion,
} from './utils';
import type { EtapaPendiente } from '../../../types';

const etapa = (nombre: string, orden: number, destino: EtapaPendiente['destino'] = null, activa = true): EtapaPendiente => ({
  id: nombre,
  nombre,
  orden,
  destino,
  activa,
});

describe('codigoPendiente', () => {
  it('rellena a 6 digitos', () => {
    expect(codigoPendiente(1)).toBe('PEN-000001');
    expect(codigoPendiente(123)).toBe('PEN-000123');
    expect(codigoPendiente(1234567)).toBe('PEN-1234567');
  });
});

describe('estado del pendiente', () => {
  it('colorea por estado', () => {
    expect(varianteEstadoPendiente('INGRESADO')).toBe('info');
    expect(varianteEstadoPendiente('EN_CURSO')).toBe('warning');
    expect(varianteEstadoPendiente('RESUELTO')).toBe('success');
  });
  it('en curso muestra la etapa; los otros estados, solo su nombre', () => {
    expect(textoEstadoPendiente({ estado: 'EN_CURSO', etapa: { nombre: 'Orden de compra enviada' } })).toBe('En curso · Orden de compra enviada');
    expect(textoEstadoPendiente({ estado: 'EN_CURSO', etapa: null })).toBe('En curso');
    expect(textoEstadoPendiente({ estado: 'INGRESADO', etapa: { nombre: 'x' } })).toBe('Ingresado');
    expect(textoEstadoPendiente({ estado: 'RESUELTO' })).toBe('Resuelto');
  });
});

describe('etapasPara', () => {
  const catalogo = [
    etapa('Recibido', 40),
    etapa('Solicitado', 10),
    etapa('Solo fabricacion', 20, 'FABRICACION'),
    etapa('Solo compras', 30, 'COMPRAS'),
    etapa('Vieja', 5, null, false),
  ];
  it('deja las activas que aplican al destino (o a ambos), en orden', () => {
    expect(etapasPara(catalogo, 'COMPRAS').map((e) => e.nombre)).toEqual(['Solicitado', 'Solo compras', 'Recibido']);
    expect(etapasPara(catalogo, 'FABRICACION').map((e) => e.nombre)).toEqual(['Solicitado', 'Solo fabricacion', 'Recibido']);
  });
  it('no modifica la lista original', () => {
    const copia = [...catalogo];
    etapasPara(catalogo, 'COMPRAS');
    expect(catalogo).toEqual(copia);
  });
});

describe('sugerirDescripcion', () => {
  it('un vidrio lleva codigo y las medidas reales', () => {
    expect(sugerirDescripcion({ tipo: 'VIDRIO', vidrio: { codigo: '5/12/5 INC', ancho: 2000, alto: 400 } })).toBe(
      'Vidrio 5/12/5 INC · 2.000 × 400 mm'
    );
    expect(sugerirDescripcion({ tipo: 'VIDRIO', vidrio: { codigo: '4/9/4 INC', ancho: 1032.5, alto: 1554 } })).toBe(
      'Vidrio 4/9/4 INC · 1.032,5 × 1.554 mm'
    );
  });
  it('hoja con y sin medidas', () => {
    expect(sugerirDescripcion({ tipo: 'HOJA', hoja: { numero: 61, ancho: '1144.5', alto: '1666' } })).toBe('Hoja 61 · 1.144,5 × 1.666 mm');
    expect(sugerirDescripcion({ tipo: 'HOJA', hoja: { numero: 62 } })).toBe('Hoja 62');
  });
  it('material, ventana y casos sin datos', () => {
    expect(sugerirDescripcion({ tipo: 'MATERIAL', material: { codigo: '14440', descripcion: 'Bisagra de hoja' } })).toBe('Bisagra de hoja (14440)');
    expect(sugerirDescripcion({ tipo: 'VENTANA', ventanaModelo: '2115 V02' })).toBe('Ventana 2115 V02');
    expect(sugerirDescripcion({ tipo: 'VIDRIO' })).toBe('');
    expect(sugerirDescripcion({ tipo: 'OTRO', ventanaModelo: 'x' })).toBe('');
  });
});

describe('referenciaPendiente', () => {
  it('prefiere la ventana ligada', () => {
    expect(
      referenciaPendiente({ ventanaRef: 'texto', fabricacionVentana: { id: '1', hetmoVentanaId: 12154, orden: 31, modelo: '2115 V02' } })
    ).toBe('Pos 31 · 2115 V02');
  });
  it('cae al texto libre y tolera la ausencia de todo', () => {
    expect(referenciaPendiente({ ventanaRef: 'V05 piso 3', fabricacionVentana: null })).toBe('V05 piso 3');
    expect(referenciaPendiente({ ventanaRef: null, fabricacionVentana: null })).toBe('');
  });
});

describe('areaDelPendiente', () => {
  it('ventana y hoja van a Fábrica', () => {
    expect(areaDelPendiente('VENTANA', 'FALLA')).toBe('FABRICA');
    expect(areaDelPendiente('HOJA', 'DANO_OBRA')).toBe('FABRICA');
  });
  it('vidrio, material y otro van al área técnica', () => {
    expect(areaDelPendiente('VIDRIO', 'FALLA')).toBe('TECNICA');
    expect(areaDelPendiente('MATERIAL', 'DANO_INSTALACION')).toBe('TECNICA');
    expect(areaDelPendiente('OTRO', 'FALLA')).toBe('TECNICA');
  });
  it('no fabricado y no recepción mandan: Fábrica', () => {
    expect(areaDelPendiente('VIDRIO', 'NO_FABRICADO')).toBe('FABRICA');
    expect(areaDelPendiente('MATERIAL', 'NO_RECEPCION')).toBe('FABRICA');
  });
  it('responsable solo en los daños; rectificar solo ventana y vidrio', () => {
    expect(exigeResponsable('DANO_OBRA') && exigeResponsable('DANO_INSTALACION')).toBe(true);
    expect(exigeResponsable('FALLA')).toBe(false);
    expect(admiteRectificacion('VENTANA') && admiteRectificacion('VIDRIO')).toBe(true);
    expect(admiteRectificacion('HOJA') || admiteRectificacion('MATERIAL') || admiteRectificacion('OTRO')).toBe(false);
  });
});

describe('leerMilimetros', () => {
  it('acepta coma decimal y punto de miles', () => {
    expect(leerMilimetros('1234,5')).toBe(1234.5);
    expect(leerMilimetros('1.234,5')).toBe(1234.5);
    expect(leerMilimetros(' 2249 ')).toBe(2249);
    expect(leerMilimetros('1032.5')).toBe(1032.5);
  });
  it('rechaza lo que no es una medida', () => {
    expect(leerMilimetros('')).toBeNull();
    expect(leerMilimetros('abc')).toBeNull();
    expect(leerMilimetros('0')).toBeNull();
    expect(leerMilimetros('-5')).toBeNull();
    expect(leerMilimetros('25000')).toBeNull();
  });
});

describe('tituloPendiente', () => {
  it('usa lo elegido si hay', () => {
    expect(tituloPendiente({ tipo: 'VENTANA', ventanaModelo: '2115 V02' }, 'x')).toBe('Ventana 2115 V02');
  });
  it('sin elemento elegido: tipo, ventana y notas', () => {
    expect(tituloPendiente({ tipo: 'VIDRIO' })).toBe('Vidrio');
    expect(tituloPendiente({ tipo: 'MATERIAL', ventanaModelo: 'V05' }, 'falta   silicona')).toBe('Material · V05: falta silicona');
    expect(tituloPendiente({ tipo: 'OTRO' }, 'a'.repeat(100))).toBe(`Otro: ${'a'.repeat(77)}...`);
  });
});

describe('textoRectificacion', () => {
  it('muestra lo que cambia y lo que no', () => {
    expect(textoRectificacion({ anchoOriginalMm: '2249.00', altoOriginalMm: '1749.00', anchoRectificadoMm: '2240.00', altoRectificadoMm: '1749.00' })).toBe(
      'Rectificar medidas: ancho 2.249 → 2.240 mm · alto 1.749 mm (sin cambio)'
    );
  });
  it('sin rectificación: null', () => {
    expect(textoRectificacion({ anchoOriginalMm: null, altoOriginalMm: null, anchoRectificadoMm: null, altoRectificadoMm: null })).toBeNull();
  });
});

describe('contarPorEstado', () => {
  it('cuenta cada estado', () => {
    expect(contarPorEstado([{ estado: 'INGRESADO' }, { estado: 'EN_CURSO' }, { estado: 'INGRESADO' }, { estado: 'RESUELTO' }])).toEqual({
      INGRESADO: 2,
      EN_CURSO: 1,
      RESUELTO: 1,
    });
    expect(contarPorEstado([])).toEqual({ INGRESADO: 0, EN_CURSO: 0, RESUELTO: 0 });
  });
});
