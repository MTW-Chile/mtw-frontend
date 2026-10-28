import { describe, it, expect } from 'vitest';
import { estadoPartida } from './estadoSolicitudPartida';

const oc = (numero: string, estado: string, creadoEn: string, partidas: string[], faseId = 'f1') =>
  ({ numero, estado, creadoEn, faseId, items: partidas.map((codigo) => ({ partida: { codigo, nombre: codigo } })) }) as any;
const req = (id: string, estado: string, fechaSolicitud: string, materialIds: string[], faseId = 'f1') =>
  ({ id, estado, fechaSolicitud, faseId, items: materialIds.map((materialId) => ({ materialId })) }) as any;

const base = { requisiciones: [], faseId: 'f1', partidaCodigo: 'PER', materialIds: ['m1', 'm2'], cubiertaPorStock: false };

describe('estadoPartida', () => {
  it('sin nada pedido: Solicitar materiales, o Solicitar requisición si el stock ya cubre todo', () => {
    expect(estadoPartida({ ...base, ordenes: [oc('OC-1', 'ENVIADA', '2026-01-01', ['HER'])] })).toEqual({ badge: null, referencia: null, boton: { etiqueta: 'Solicitar materiales', accion: 'solicitar-materiales' } });
    expect(estadoPartida({ ...base, ordenes: [], cubiertaPorStock: true })).toMatchObject({ badge: { etiqueta: 'En bodega' }, boton: { etiqueta: 'Solicitar requisición', accion: 'solicitar-requisicion' } });
    // Cubierta solo con Obras Mayores: se puede pedir, pero avisa que falta el traslado.
    expect(estadoPartida({ ...base, ordenes: [], cubiertaPorStock: true, requiereTraslado: true })).toMatchObject({ badge: { etiqueta: 'En Obras Mayores · pedir traslado', variante: 'warning' }, boton: { accion: 'solicitar-requisicion' } });
  });

  it('con la OC en curso el botón queda en Solicitado y el badge dice en qué va', () => {
    const casos: [string, string][] = [
      ['BORRADOR', 'Enviado'],
      ['PENDIENTE_APROBACION', 'Pendiente de aprobación'],
      ['APROBADA', 'Pendiente de recepción'],
      ['ENVIADA', 'Pendiente de recepción'],
    ];
    for (const [estado, etiqueta] of casos) {
      expect(estadoPartida({ ...base, ordenes: [oc('OC-1', estado, '2026-01-01', ['PER'])] })).toMatchObject({ badge: { etiqueta }, referencia: 'OC-1', boton: { etiqueta: 'Solicitado', accion: null } });
    }
  });

  it('mira la OC más reciente de la partida en esa fase', () => {
    const ordenes = [oc('OC-1', 'RECIBIDA_TOTAL', '2026-01-01', ['PER']), oc('OC-2', 'PENDIENTE_APROBACION', '2026-02-01', ['PER', 'HER']), oc('OC-3', 'ENVIADA', '2026-03-01', ['PER'], 'f2')];
    expect(estadoPartida({ ...base, ordenes })).toMatchObject({ badge: { etiqueta: 'Pendiente de aprobación' }, referencia: 'OC-2' });
  });

  it('recibida (parcial, total o conciliada) habilita Solicitar requisición', () => {
    expect(estadoPartida({ ...base, ordenes: [oc('OC-1', 'RECIBIDA_PARCIAL', '2026-01-01', ['PER'])] })).toMatchObject({ badge: { etiqueta: 'Recibida (parcial)' }, boton: { etiqueta: 'Solicitar requisición', accion: 'solicitar-requisicion' } });
    expect(estadoPartida({ ...base, ordenes: [oc('OC-1', 'CONCILIADA', '2026-01-01', ['PER'])] })).toMatchObject({ badge: { etiqueta: 'Recibida (total)' }, boton: { accion: 'solicitar-requisicion' } });
  });

  it('una OC rechazada se muestra en el badge y deja volver a solicitar; una cancelada no cuenta', () => {
    expect(estadoPartida({ ...base, ordenes: [oc('OC-1', 'RECHAZADA', '2026-03-01', ['PER'])] })).toMatchObject({ badge: { etiqueta: 'Rechazada' }, boton: { etiqueta: 'Solicitar materiales', accion: 'solicitar-materiales' } });
    expect(estadoPartida({ ...base, ordenes: [oc('OC-0', 'CANCELADA', '2026-01-01', ['PER'])] })).toMatchObject({ badge: null, boton: { accion: 'solicitar-materiales' } });
  });

  it('con una requisición que pide sus materiales, el botón sigue la entrega', () => {
    const ordenes = [oc('OC-1', 'RECIBIDA_TOTAL', '2026-01-01', ['PER'])];
    expect(estadoPartida({ ...base, ordenes, requisiciones: [req('r1', 'GENERADA', '2026-01-02', ['m2'])] })).toMatchObject({ badge: { etiqueta: 'Recibida (total)' }, boton: { etiqueta: 'Esperando entrega', accion: null } });
    expect(estadoPartida({ ...base, ordenes, requisiciones: [req('r1', 'ENTREGADA', '2026-01-02', ['m1'])] })).toMatchObject({ boton: { etiqueta: 'Entregado a taller', accion: null } });
    // Rechazada, de otra fase o de otros materiales: no cuenta.
    expect(estadoPartida({ ...base, ordenes, requisiciones: [req('r1', 'RECHAZADA', '2026-01-02', ['m1']), req('r2', 'ENTREGADA', '2026-01-03', ['m1'], 'f2'), req('r3', 'ENTREGADA', '2026-01-03', ['otro'])] })).toMatchObject({ boton: { accion: 'solicitar-requisicion' } });
  });
});
