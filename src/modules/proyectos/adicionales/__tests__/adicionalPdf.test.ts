import { describe, it, expect } from 'vitest';
import { buildAdicionalHtml } from '../adicionalPdf';
import type { Adicional } from '../../../../types';

const base = (extra: Partial<Adicional> = {}): Adicional =>
  ({
    id: 'a',
    numero: 2,
    titulo: 'Cambio de ventana V12',
    estado: 'ENVIADO',
    cargoA: 'CLIENTE',
    formaCobroInstalador: null,
    instalador: null,
    proyecto: { id: 'p', obra: 'Edificio Test', codigoInterno: 'PRJ-1', cliente: { id: 'c', nombre: 'Constructora X', rut: '76.000.000-0' } },
    tasaUf: 40000,
    textoPresentacion: 'Presentamos el adicional.',
    condicionesComerciales: 'Validez 15 días.\nValores más IVA.',
    fechaEnvio: '2026-10-18T12:00:00Z',
    items: [
      { id: 'i1', descripcion: 'Arriendo de andamio', cantidad: 2, unidad: 'día', precioUnitario: 60000, precioTotal: 120000 },
    ],
    totales: { costo: 90000, venta: 120000, ventaUf: 3, iva: 22800, totalConIva: 142800, ivaPct: 19 },
    ...extra,
  }) as unknown as Adicional;

describe('buildAdicionalHtml', () => {
  it('al cliente: tabla de ítems, neto, IVA, total, UF y condiciones', () => {
    const html = buildAdicionalHtml({ adicional: base(), logoDataUrl: null });
    expect(html).toContain('Cotización de adicional');
    expect(html).toContain('PRJ-1 · Adicional A2');
    expect(html).toContain('Constructora X');
    expect(html).toContain('Arriendo de andamio');
    expect(html).toContain('IVA (19%)');
    expect(html).toContain('$ 142.800');
    expect(html).toContain('3 UF neto');
    expect(html).toContain('<li style="margin-bottom:3px;">Valores más IVA.</li>');
  });

  it('al instalador por descuento en su estado de pago: solo el neto a descontar', () => {
    const html = buildAdicionalHtml({
      adicional: base({ cargoA: 'INSTALADOR', formaCobroInstalador: 'DESCUENTO_ESTADO_PAGO', instalador: { id: 'x', nombre: 'Instalaciones Sur', rut: '77.111.111-1' } }),
      logoDataUrl: null,
    });
    expect(html).toContain('Cargo al instalador');
    expect(html).toContain('Instalaciones Sur');
    expect(html).toContain('Monto a descontar (neto)');
    expect(html).not.toContain('IVA (19%)');
  });
});
