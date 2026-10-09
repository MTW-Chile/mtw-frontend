import { describe, it, expect } from 'vitest';
import { seccionDisponible, seccionEfectiva, SECCIONES_OBRA, SECCIONES_QUE_REQUIEREN_PRESUPUESTO } from './seccionesObra';

describe('seccionDisponible', () => {
  it('una obra manual solo tiene disponible lo que no requiere presupuesto', () => {
    expect(seccionDisponible('fabricacion', 'MANUAL_OBRA')).toBe(true);
    expect(seccionDisponible('pendientes', 'MANUAL_OBRA')).toBe(true);
    expect(seccionDisponible('cubicacion', 'MANUAL_OBRA')).toBe(true);
    expect(seccionDisponible('presupuesto', 'MANUAL_OBRA')).toBe(false);
    expect(seccionDisponible('fases', 'MANUAL_OBRA')).toBe(false);
    expect(seccionDisponible('abastecimiento', 'MANUAL_OBRA')).toBe(false);
    expect(seccionDisponible('bodega', 'MANUAL_OBRA')).toBe(false);
  });
  it('el resto de obras (HETMO y presupuesto manual aceptado) tiene todo disponible', () => {
    for (const origen of ['HETMO', 'MANUAL_PRESUPUESTO', undefined] as const) {
      for (const s of SECCIONES_OBRA) expect(seccionDisponible(s, origen)).toBe(true);
    }
  });
  it('Fabricacion, Cubicacion y Control de pendientes nunca requieren presupuesto', () => {
    expect(SECCIONES_QUE_REQUIEREN_PRESUPUESTO).not.toContain('cubicacion');
    expect(SECCIONES_QUE_REQUIEREN_PRESUPUESTO).not.toContain('fabricacion');
    expect(SECCIONES_QUE_REQUIEREN_PRESUPUESTO).not.toContain('pendientes');
  });
});

describe('seccionEfectiva', () => {
  it('respeta la seccion pedida si esta disponible', () => {
    expect(seccionEfectiva('fases', 'HETMO')).toBe('fases');
    expect(seccionEfectiva('fabricacion', 'MANUAL_OBRA')).toBe('fabricacion');
  });
  it('una obra manual con un enlace a una seccion en gris cae a Fabricacion', () => {
    expect(seccionEfectiva('presupuesto', 'MANUAL_OBRA')).toBe('fabricacion');
    expect(seccionEfectiva('bodega', 'MANUAL_OBRA')).toBe('fabricacion');
    expect(seccionEfectiva(undefined, 'MANUAL_OBRA')).toBe('fabricacion');
  });
  it('sin seccion valida, el resto cae a Control de presupuesto', () => {
    expect(seccionEfectiva(undefined, 'HETMO')).toBe('presupuesto');
    expect(seccionEfectiva('inexistente', 'MANUAL_PRESUPUESTO')).toBe('presupuesto');
  });
});
