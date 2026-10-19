import { describe, it, expect } from 'vitest';
import { seccionDisponible, seccionEfectiva, SECCIONES_OBRA, SECCIONES_QUE_REQUIEREN_PRESUPUESTO } from './seccionesObra';

describe('seccionDisponible', () => {
  it('una obra manual solo tiene disponible lo que no requiere presupuesto', () => {
    expect(seccionDisponible('general', 'MANUAL_OBRA')).toBe(true);
    expect(seccionDisponible('fabricacion', 'MANUAL_OBRA')).toBe(true);
    expect(seccionDisponible('pendientes', 'MANUAL_OBRA')).toBe(true);
    expect(seccionDisponible('cubicacion', 'MANUAL_OBRA')).toBe(true);
    // Un adicional se cotiza con precios vigentes: no depende de la cotizacion.
    expect(seccionDisponible('adicionales', 'MANUAL_OBRA')).toBe(true);
    expect(seccionDisponible('abastecimiento', 'MANUAL_OBRA')).toBe(false);
    expect(seccionDisponible('bodega', 'MANUAL_OBRA')).toBe(false);
  });
  it('el resto de obras (HETMO y presupuesto manual aceptado) tiene todo disponible', () => {
    for (const origen of ['HETMO', 'MANUAL_PRESUPUESTO', undefined] as const) {
      for (const s of SECCIONES_OBRA) expect(seccionDisponible(s, origen)).toBe(true);
    }
  });
  it('Información General, Fabricacion, Cubicacion y Control de pendientes nunca requieren presupuesto', () => {
    for (const s of ['general', 'cubicacion', 'fabricacion', 'pendientes'] as const) expect(SECCIONES_QUE_REQUIEREN_PRESUPUESTO).not.toContain(s);
  });
  it('Fabricación va después de Cubicación', () => {
    expect(SECCIONES_OBRA.indexOf('fabricacion')).toBe(SECCIONES_OBRA.indexOf('cubicacion') + 1);
  });
});

describe('seccionEfectiva', () => {
  it('respeta la seccion pedida si esta disponible', () => {
    expect(seccionEfectiva('cubicacion', 'HETMO')).toBe('cubicacion');
    expect(seccionEfectiva('fabricacion', 'MANUAL_OBRA')).toBe('fabricacion');
  });
  it('los enlaces viejos a Control de presupuesto y Documentos abren Información General', () => {
    expect(seccionEfectiva('presupuesto', 'HETMO')).toBe('general');
    expect(seccionEfectiva('documentos', 'MANUAL_OBRA')).toBe('general');
  });
  it('sin seccion valida o disponible, cae a Información General', () => {
    expect(seccionEfectiva(undefined, 'HETMO')).toBe('general');
    expect(seccionEfectiva('inexistente', 'MANUAL_PRESUPUESTO')).toBe('general');
    expect(seccionEfectiva('bodega', 'MANUAL_OBRA')).toBe('general');
  });
});
