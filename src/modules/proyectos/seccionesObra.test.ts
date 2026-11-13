import { describe, it, expect } from 'vitest';
import { PERMISO_SECCION, seccionDisponible, seccionEfectiva, seccionesDelModo, SECCIONES_FABRICACION, SECCIONES_OBRA, SECCIONES_QUE_REQUIEREN_PRESUPUESTO, usaCubicacion, usaReservaMateriales } from './seccionesObra';

describe('seccionDisponible', () => {
  it('una obra legacy solo tiene disponible lo que no requiere presupuesto', () => {
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
  it('una obra legacy en Comercial solo tiene Información General; en el taller, todo', () => {
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

describe('tipo de proyecto sin cubicación ni reserva (retail)', () => {
  const retail = { tipoProyecto: { id: '1', codigo: 'RETAIL', nombre: 'Retail', usaCubicacion: false, usaReservaMateriales: false } };
  it('lo dice el tipo de proyecto; sin el dato, como hasta ahora (sí usa)', () => {
    expect(usaCubicacion(retail)).toBe(false);
    expect(usaReservaMateriales(retail)).toBe(false);
    expect(usaCubicacion({ tipoProyecto: { id: '2', codigo: 'EDIFICIO', nombre: 'Edificio', usaCubicacion: true, usaReservaMateriales: true } })).toBe(true);
    expect(usaCubicacion({ tipoProyecto: { id: '2', codigo: 'EDIFICIO', nombre: 'Edificio' } })).toBe(true);
    expect(usaReservaMateriales(undefined)).toBe(true);
  });
  it('en el taller no tiene Cubicación (rectifica desde Fases); Fases sigue antes de Requisiciones', () => {
    expect(seccionesDelModo('fabricacion', 'HETMO', false)).toEqual(['general', 'fabricacion', 'requisiciones', 'pendientes']);
    expect(seccionEfectiva('cubicacion', 'HETMO', 'fabricacion', false)).toBe('general');
    expect(seccionEfectiva('fabricacion', 'HETMO', 'fabricacion', false)).toBe('fabricacion');
  });
  it('en Comercial conserva sus pestañas (la reserva se oculta dentro de Abastecimiento)', () => {
    expect(seccionesDelModo('obra', 'HETMO', false)).toEqual(SECCIONES_OBRA);
  });
});
