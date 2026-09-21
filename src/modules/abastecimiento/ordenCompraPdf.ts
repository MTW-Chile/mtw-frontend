// Armado del PDF de Orden de Compra -- mismo patron que presupuestoPdf.ts
// (Step5Consolidacion) y catalogoPdf.ts: logica de documento pura, sin
// imports de React, HTML real renderizado a PDF con Chromium en el relay
// (ver renderPdf en api/client.ts). Reusa la paleta/escape de HTML de
// presupuestoPdf.ts para que se sienta el mismo documento que el
// Presupuesto y el Catálogo Técnico, no uno aparte con otro estilo.
import { HEX, escapeHtml } from '../cotizaciones/steps/Step5Consolidacion/presupuestoPdf';
import type { OrdenCompra } from '../../types';
import { CATEGORIA_GASTO_LABEL } from './categoriaGasto';

const formatoMonto = (valor: number, moneda: string) =>
  valor.toLocaleString('es-CL', {
    style: moneda === 'CLP' ? 'currency' : 'decimal',
    currency: moneda === 'CLP' ? 'CLP' : undefined,
    maximumFractionDigits: moneda === 'CLP' ? 0 : 2,
  }) + (moneda !== 'CLP' ? ` ${moneda}` : '');

const filaDato = (label: string, valor: string | null | undefined) =>
  valor
    ? `<div style="font-size:9.5px;color:${HEX.navy};margin-bottom:2px;"><span style="color:${HEX.gris};">${escapeHtml(label)}:</span> ${escapeHtml(valor)}</div>`
    : '';

export function buildOrdenCompraHtml(oc: OrdenCompra, logoDataUrl: string | null): string {
  const proveedor = oc.proveedor;
  const total = oc.items.reduce((sum, i) => sum + Number(i.cantidad) * Number(i.precioUnitario), 0);
  const fechaEmision = new Date(oc.fechaEnvio || oc.creadoEn).toLocaleDateString('es-CL');
  const logoImg = logoDataUrl ? `<img src="${logoDataUrl}" style="width:101px;height:46px;display:block;" />` : '';

  const filasItems = oc.items
    .map(
      (item, i) => `
    <tr style="background:${i % 2 === 0 ? HEX.zebra : '#ffffff'};">
      <td style="padding:7px 10px;font-size:9.5px;color:${HEX.navy};">${escapeHtml(item.descripcion)}</td>
      <td style="padding:7px 10px;font-size:9.5px;color:${HEX.gris};">${escapeHtml(CATEGORIA_GASTO_LABEL[item.categoria] || item.categoria)}</td>
      <td style="padding:7px 10px;font-size:9.5px;color:${HEX.navy};text-align:right;white-space:nowrap;">${Number(item.cantidad).toLocaleString('es-CL', { maximumFractionDigits: 2 })} ${escapeHtml(item.unidadMedida)}</td>
      <td style="padding:7px 10px;font-size:9.5px;color:${HEX.navy};text-align:right;white-space:nowrap;">${escapeHtml(formatoMonto(Number(item.precioUnitario), oc.moneda))}</td>
      <td style="padding:7px 10px;font-size:9.5px;color:${HEX.navy};font-weight:bold;text-align:right;white-space:nowrap;">${escapeHtml(formatoMonto(Number(item.cantidad) * Number(item.precioUnitario), oc.moneda))}</td>
    </tr>`
    )
    .join('');

  const datosProveedorHtml = [
    filaDato('R.U.T.', proveedor?.rut),
    filaDato('Giro', proveedor?.giroComercial),
    filaDato('Dirección', [proveedor?.direccion, proveedor?.comuna].filter(Boolean).join(', ') || null),
    filaDato('Contacto', proveedor?.contactoNombre),
    filaDato('Correo', proveedor?.emailPedidos || proveedor?.email),
    filaDato('Teléfono', proveedor?.telefono),
  ].join('');

  const faseLabel = oc.fase ? (oc.fase.numeroFase === 0 ? `Fase 0 - ${oc.fase.nombre}` : `Fase ${oc.fase.numeroFase} - ${oc.fase.nombre}`) : null;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
  @page { size: letter; }
  * { box-sizing: border-box; }
  body { margin: 0; }
</style>
</head>
<body>
  <div style="width:100%;font-family:Helvetica,Arial,sans-serif;background:#ffffff;">
    <div style="height:4px;background:${HEX.rojo};"></div>
    <div style="padding:24px 42px;">
      <table style="width:100%;margin-bottom:12px;"><tr>
        <td style="vertical-align:top;">${logoImg}</td>
        <td style="vertical-align:top;text-align:right;">
          <div style="font-size:19px;font-weight:bold;color:${HEX.navy};">Orden de Compra</div>
          <div style="font-size:12px;color:${HEX.gris};margin-top:2px;font-family:monospace;">${escapeHtml(oc.numero)}</div>
        </td>
      </tr></table>
      <div style="border-top:1px solid ${HEX.borde};margin-bottom:18px;"></div>

      <table style="width:100%;margin-bottom:20px;"><tr>
        <td style="width:52%;vertical-align:top;padding-right:16px;">
          <div style="font-size:9px;font-weight:bold;color:${HEX.gris};text-transform:uppercase;letter-spacing:.03em;margin-bottom:6px;">Proveedor</div>
          <div style="font-size:11px;font-weight:bold;color:${HEX.navy};margin-bottom:3px;">${escapeHtml(proveedor?.nombre || '—')}</div>
          ${datosProveedorHtml}
        </td>
        <td style="width:48%;vertical-align:top;">
          <div style="font-size:9px;font-weight:bold;color:${HEX.gris};text-transform:uppercase;letter-spacing:.03em;margin-bottom:6px;">Obra</div>
          <div style="font-size:11px;font-weight:bold;color:${HEX.navy};margin-bottom:3px;">${escapeHtml(oc.proyecto?.obra || '—')}</div>
          ${filaDato('Código', oc.proyecto?.codigoInterno || null)}
          ${filaDato('Fase', faseLabel)}
          ${filaDato('Fecha de emisión', fechaEmision)}
          ${filaDato('Fecha calendarizada', oc.fechaCalendarizada ? new Date(oc.fechaCalendarizada).toLocaleDateString('es-CL') : null)}
        </td>
      </tr></table>

      <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
        <thead>
          <tr style="background:${HEX.headBg};">
            <th style="padding:7px 10px;font-size:9px;color:${HEX.navy};text-align:left;">Descripción</th>
            <th style="padding:7px 10px;font-size:9px;color:${HEX.navy};text-align:left;">Categoría</th>
            <th style="padding:7px 10px;font-size:9px;color:${HEX.navy};text-align:right;">Cantidad</th>
            <th style="padding:7px 10px;font-size:9px;color:${HEX.navy};text-align:right;">Precio unit.</th>
            <th style="padding:7px 10px;font-size:9px;color:${HEX.navy};text-align:right;">Subtotal</th>
          </tr>
        </thead>
        <tbody>${filasItems}</tbody>
      </table>

      <div style="display:flex;justify-content:flex-end;">
        <div style="background:${HEX.navy};border-radius:6px;padding:12px 20px;color:#ffffff;min-width:220px;">
          <table style="width:100%;border-collapse:collapse;"><tr>
            <td style="font-size:10px;font-weight:bold;text-transform:uppercase;letter-spacing:.02em;">Total</td>
            <td style="font-size:15px;font-weight:bold;text-align:right;">${escapeHtml(formatoMonto(total, oc.moneda))}</td>
          </tr></table>
        </div>
      </div>

      ${
        oc.motivoRechazo
          ? `<div style="margin-top:18px;padding:10px 14px;background:#fef2f2;border:1px solid #fecaca;border-radius:6px;font-size:9.5px;color:#b91c1c;"><strong>Motivo de rechazo:</strong> ${escapeHtml(oc.motivoRechazo)}</div>`
          : ''
      }

      <div style="margin-top:24px;font-size:8.5px;color:${HEX.gris};">
        Documento generado por MTW ERP el ${new Date().toLocaleDateString('es-CL')}.
      </div>
    </div>
  </div>
</body>
</html>`;
}
