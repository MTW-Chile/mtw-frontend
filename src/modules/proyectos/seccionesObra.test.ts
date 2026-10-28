import { describe, it, expect } from 'vitest';
import { PERMISO_SECCION, seccionDisponible, seccionEfectiva, seccionesDelModo, SECCIONES_FABRICACION, SECCIONES_OBRA, SECCIONES_QUE_REQUIEREN_PRESUPUESTO } from './seccionesObra';

describe('seccionDisponible', () => {
  it('una obra manual solo tiene disponible lo que no requiere presupuesto', () => {
    expect(seccionDisponible('general', 'MANUAL_OBRA')).toBe(true);
    expect(seccionDisponible('fabricacion', 'MANUAL_OBRA')).toBe(true);
    expect(seccionDisponible('pendientes', 'MANUAL_OBRA')).toBe(true);
    expect(seccionDisponible('cubicacion', 'MANUAL_OBRA')).toBe(true);
    // Un adicional se cotiza con precios vigentes: no depende de la cotizacion.
    expect(seccionDisponible('adicionales', 'MANUAL_OBRA')).toBe(true);
    expect(seccionDisponible('abastecimiento', 'MANUAL_OBRA')).toBe(false);
    // Una requisicion nace de una fase de la version cotizada.
    expect(seccionDisponible('requisiciones', 'MANUAL_OBRA')).toBe(false);
  });
  it('el resto de obras (HETMO y presupuesto manual aceptado) tiene todo disponible', () => {
    for (const origen of ['HETMO', 'MANUAL_PRESUPUESTO', undefined] as const) {
      for (const s of [...SECCIONES_OBRA, ...SECCIONES_FABRICACION]) expect(seccionDisponible(s, origen)).toBe(true);
    }
  });
  it('Información General, Fabricacion, Cubicacion y Control de pendientes nunca requieren presupuesto', () => {
    for (const s of ['general', 'cubicacion', 'fabricacion', 'pendientes'] as const) expect(SECCIONES_QUE_REQUIEREN_PRESUPUESTO).not.toContain(s);
  });
});

describe('pestañas por modo', () => {
  it('Comercial > Obras en curso: lo que se vende, se compra y se cobra', () => {
    expect(seccionesDelModo('obra')).toEqual(['general', 'abastecimiento', 'adicionales', 'estados-pago']);
    expect(seccionesDelModo('obra', 'HETMO')).toEqual(seccionesDelModo('obra'));
  });
  it('una obra manual en Comercial solo tiene Información General; en el taller, todo', () => {
    expect(seccionesDelModo('obra', 'MANUAL_OBRA')).toEqual(['general']);
    expect(seccionesDelModo('fabricacion', 'MANUAL_OBRA')).toEqual(seccionesDelModo('fabricacion'));
    expect(seccionEfectiva('adicionales', 'MANUAL_OBRA')).toBe('general');
    expect(seccionEfectiva('estados-pago', 'MANUAL_OBRA')).toBe('general');
  });
  it('Taller > Fabricación: lo que se cubica, se produce y se pide a bodega (los despachos tienen sección propia)', () => {
    expect(seccionesDelModo('fabricacion')).toEqual(['general', 'cubicacion', 'fabricacion', 'requisiciones', 'pendientes']);
    // Fases (id 'fabricacion') va justo a la derecha de Cubicación.
    expect(SECCIONES_FABRICACION.indexOf('fabricacion')).toBe(SECCIONES_FABRICACION.indexOf('cubicacion') + 1);
  });
  it('las dos vistas parten en Información General', () => {
    expect(SECCIONES_OBRA[0]).toBe('general');
    expect(SECCIONES_FABRICACION[0]).toBe('general');
  });
  it('cada pestaña con permiso propio exige un permiso de ver del catalogo', () => {
    expect(PERMISO_SECCION).toEqual({ abastecimiento: 'compras.ver', adicionales: 'adicionales.ver', 'estados-pago': 'estados_pago.ver', pendientes: 'pendientes.ver' });
  });
});

describe('seccionEfectiva', () => {
  it('respeta la seccion pedida si existe en el modo y esta disponible', () => {
    expect(seccionEfectiva('adicionales', 'HETMO')).toBe('adicionales');
    expect(seccionEfectiva('cubicacion', 'HETMO', 'fabricacion')).toBe('cubicacion');
    expect(seccionEfectiva('fabricacion', 'MANUAL_OBRA', 'fabricacion')).toBe('fabricacion');
  });
  it('una seccion del otro modo (o la vieja pestaña Despachos) cae a Información General', () => {
    expect(seccionEfectiva('cubicacion', 'HETMO')).toBe('general');
    expect(seccionEfectiva('despachos', 'HETMO', 'fabricacion')).toBe('general');
    expect(seccionEfectiva('estados-pago', 'HETMO', 'fabricacion')).toBe('general');
  });
  it('los enlaces viejos abren su equivalente', () => {
    expect(seccionEfectiva('presupuesto', 'HETMO')).toBe('general');
    expect(seccionEfectiva('documentos', 'MANUAL_OBRA')).toBe('general');
    expect(seccionEfectiva('bodega', 'HETMO', 'fabricacion')).toBe('requisiciones');
    expect(seccionEfectiva('bodega', 'MANUAL_OBRA', 'fabricacion')).toBe('general');
  });
  it('sin seccion valida o disponible, cae a Información General', () => {
    expect(seccionEfectiva(undefined, 'HETMO')).toBe('general');
    expect(seccionEfectiva(undefined, 'MANUAL_OBRA', 'fabricacion')).toBe('general');
    expect(seccionEfectiva('inexistente', 'MANUAL_PRESUPUESTO')).toBe('general');
    expect(seccionEfectiva('requisiciones', 'MANUAL_OBRA', 'fabricacion')).toBe('general');
  });
});
