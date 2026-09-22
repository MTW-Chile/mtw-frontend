// Armado del PDF de Orden de Compra. Estructura calcada del formato de
// referencia que pidió el usuario (plantilla OnlyOffice "Orden de compra
// 7": título + datos de la empresa arriba, N.º de OC / Fecha, franjas
// VENDEDOR/CLIENTE, tabla PRODUCTO O SERVICIO con resumen Subtotal/
// Impuesto/Total, y Comentarios al final) -- reemplazando "CLIENTE" por
// "OBRA" (no hay un cliente en una OC, hay un proyecto) y el IVA 19% fijo
// que ya usa el Presupuesto (ver PresupuestoOferta.tsx) en vez de
// inventar un campo de envío que no se rastrea en ningún lado. Colores y
// tipografia reusan la paleta de presupuestoPdf.ts (HEX.navy calza casi
// exacto con el gris-azulado de la plantilla de referencia) para que se
// sienta el mismo tipo de documento que el Presupuesto y el Catálogo
// Técnico, no uno aparte con otro estilo.
import { HEX, escapeHtml } from '../cotizaciones/steps/Step5Consolidacion/presupuestoPdf';
import type { OrdenCompra } from '../../types';

const IVA_PCT = 19;

const formatoMonto = (valor: number, moneda: string) =>
  valor.toLocaleString('es-CL', {
    style: moneda === 'CLP' ? 'currency' : 'decimal',
    currency: moneda === 'CLP' ? 'CLP' : undefined,
    maximumFractionDigits: moneda === 'CLP' ? 0 : 2,
  }) + (moneda !== 'CLP' ? ` ${moneda}` : '');

// Fila "etiqueta + valor" del bloque Vendedor/Obra -- mismos datos
// (dirección, teléfono, correo) que trae la plantilla de referencia (ahí
// van con ícono; acá con etiqueta de texto -- un emoji a color desentonaba
// con la paleta monocroma del resto del documento), omitida si no hay
// dato (nunca una fila con "—" vacío).
const filaDato = (label: string, valor: string | null | undefined) =>
  valor
    ? `<tr><td style="padding:2px 8px 2px 0;width:56px;color:${HEX.gris};font-size:8.5px;vertical-align:top;">${escapeHtml(label)}</td><td style="padding:2px 0;font-size:9.5px;color:${HEX.navy};">${escapeHtml(valor)}</td></tr>`
    : '';

export function buildOrdenCompraHtml(oc: OrdenCompra, logoDataUrl: string | null): string {
  const proveedor = oc.proveedor;
  const subtotal = oc.items.reduce((sum, i) => sum + Number(i.cantidad) * Number(i.precioUnitario), 0);
  const iva = subtotal * (IVA_PCT / 100);
  const total = subtotal + iva;
  const fechaEmision = new Date(oc.fechaEnvio || oc.creadoEn).toLocaleDateString('es-CL');
  const logoImg = logoDataUrl ? `<img src="${logoDataUrl}" style="width:101px;height:46px;display:block;" />` : '';
  const faseLabel = oc.fase ? (oc.fase.numeroFase === 0 ? `Fase 0 - ${oc.fase.nombre}` : `Fase ${oc.fase.numeroFase} - ${oc.fase.nombre}`) : null;

  const filasItems = oc.items
    .map(
      (item, i) => `
    <tr style="background:${i % 2 === 0 ? '#ffffff' : HEX.zebra};">
      <td style="padding:7px 10px;font-size:9px;color:${HEX.gris};text-align:center;border-bottom:1px solid ${HEX.borde};">${i + 1}</td>
      <td style="padding:7px 10px;font-size:9.5px;color:${HEX.navy};border-bottom:1px solid ${HEX.borde};">${escapeHtml(item.descripcion)}</td>
      <td style="padding:7px 10px;font-size:9.5px;color:${HEX.navy};text-align:right;white-space:nowrap;border-bottom:1px solid ${HEX.borde};">
        ${Number(item.cantidad).toLocaleString('es-CL', { maximumFractionDigits: 2 })} ${escapeHtml(item.unidadMedida)}
      </td>
      <td style="padding:7px 10px;font-size:9.5px;color:${HEX.navy};text-align:right;white-space:nowrap;border-bottom:1px solid ${HEX.borde};">${escapeHtml(formatoMonto(Number(item.precioUnitario), oc.moneda))}</td>
      <td style="padding:7px 10px;font-size:9.5px;color:${HEX.navy};font-weight:bold;text-align:right;white-space:nowrap;border-bottom:1px solid ${HEX.borde};">${escapeHtml(formatoMonto(Number(item.cantidad) * Number(item.precioUnitario), oc.moneda))}</td>
    </tr>`
    )
    .join('');

  // Bloque de comentarios: notas propias de la OC (motivo de rechazo,
  // condiciones de pago del proveedor, fecha calendarizada) -- si no hay
  // ninguno de estos datos, se muestra un guion en vez de una caja vacía.
  const comentarios = [
    oc.comentarios?.trim() || null,
    oc.motivoRechazo ? `Motivo de rechazo: ${oc.motivoRechazo}` : null,
    proveedor?.condicionesPago ? `Condiciones de pago: ${proveedor.condicionesPago}` : null,
    oc.fechaCalendarizada ? `Fecha calendarizada de entrega: ${new Date(oc.fechaCalendarizada).toLocaleDateString('es-CL')}` : null,
    oc.requiereAprobacion ? 'Esta orden requiere aprobación de Gerencia antes de enviarse al proveedor.' : null,
  ].filter(Boolean) as string[];

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
    <div style="padding:28px 42px;">

      <!-- Título + logo -->
      <table style="width:100%;margin-bottom:22px;"><tr>
        <td style="vertical-align:top;">
          <div style="font-size:30px;font-weight:bold;color:${HEX.navy};letter-spacing:-.01em;">Orden de Compra</div>
        </td>
        <td style="vertical-align:top;text-align:right;">${logoImg}</td>
      </tr></table>

      <!-- N.º de OC / Fecha -->
      <table style="width:100%;margin-bottom:20px;"><tr>
        <td style="font-size:10px;color:${HEX.navy};">
          <span style="font-weight:bold;">N.º de orden de compra:</span>
          <span style="font-family:monospace;">${escapeHtml(oc.numero)}</span>
        </td>
        <td style="font-size:10px;color:${HEX.navy};text-align:right;">
          <span style="font-weight:bold;">Fecha:</span> ${escapeHtml(fechaEmision)}
        </td>
      </tr></table>

      <!-- Vendedor / Obra -->
      <table style="width:100%;border-collapse:collapse;margin-bottom:22px;border:1px solid ${HEX.borde};">
        <tr>
          <td style="width:50%;background:${HEX.navy};color:#ffffff;padding:6px 12px;font-size:9.5px;font-weight:bold;letter-spacing:.03em;">VENDEDOR</td>
          <td style="width:50%;background:${HEX.navy};color:#ffffff;padding:6px 12px;font-size:9.5px;font-weight:bold;letter-spacing:.03em;border-left:1px solid #ffffff33;">OBRA</td>
        </tr>
        <tr>
          <td style="padding:10px 12px;vertical-align:top;">
            <div style="font-size:10.5px;font-weight:bold;color:${HEX.navy};margin-bottom:3px;">${escapeHtml(proveedor?.nombre || '—')}</div>
            <table style="border-collapse:collapse;">
              ${filaDato('R.U.T.', proveedor?.rut)}
              ${filaDato('Dirección', [proveedor?.direccion, proveedor?.comuna].filter(Boolean).join(', ') || null)}
              ${filaDato('Teléfono', proveedor?.telefono)}
              ${filaDato('Correo', proveedor?.emailPedidos || proveedor?.email)}
            </table>
          </td>
          <td style="padding:10px 12px;vertical-align:top;border-left:1px solid ${HEX.borde};">
            <div style="font-size:10.5px;font-weight:bold;color:${HEX.navy};margin-bottom:3px;">${escapeHtml(oc.proyecto?.obra || '—')}</div>
            <table style="border-collapse:collapse;">
              ${filaDato('Código', oc.proyecto?.codigoInterno || null)}
              ${filaDato('Fase', faseLabel)}
            </table>
          </td>
        </tr>
      </table>

      <!-- Producto o Servicio -->
      <div style="background:${HEX.navy};color:#ffffff;padding:6px 12px;font-size:9.5px;font-weight:bold;letter-spacing:.03em;">PRODUCTO O SERVICIO</div>
      <table style="width:100%;border-collapse:collapse;border:1px solid ${HEX.borde};border-top:none;margin-bottom:16px;">
        <thead>
          <tr style="background:${HEX.headBg};">
            <th style="padding:7px 10px;font-size:9px;color:${HEX.navy};width:28px;">N.º</th>
            <th style="padding:7px 10px;font-size:9px;color:${HEX.navy};text-align:left;">Descripción</th>
            <th style="padding:7px 10px;font-size:9px;color:${HEX.navy};text-align:right;width:90px;">Cantidad</th>
            <th style="padding:7px 10px;font-size:9px;color:${HEX.navy};text-align:right;width:100px;">Precio unitario</th>
            <th style="padding:7px 10px;font-size:9px;color:${HEX.navy};text-align:right;width:100px;">Total</th>
          </tr>
        </thead>
        <tbody>${filasItems}</tbody>
        <tfoot>
          <tr>
            <td colspan="3"></td>
            <td style="padding:6px 10px;font-size:9.5px;font-weight:bold;color:${HEX.navy};text-align:right;border-top:1px solid ${HEX.borde};">SUBTOTAL</td>
            <td style="padding:6px 10px;font-size:9.5px;color:${HEX.navy};text-align:right;border-top:1px solid ${HEX.borde};">${escapeHtml(formatoMonto(subtotal, oc.moneda))}</td>
          </tr>
          <tr>
            <td colspan="3"></td>
            <td style="padding:6px 10px;font-size:9.5px;font-weight:bold;color:${HEX.navy};text-align:right;">IVA (${IVA_PCT}%)</td>
            <td style="padding:6px 10px;font-size:9.5px;color:${HEX.navy};text-align:right;">${escapeHtml(formatoMonto(iva, oc.moneda))}</td>
          </tr>
          <tr>
            <td colspan="3"></td>
            <td style="padding:8px 10px;font-size:10.5px;font-weight:bold;color:#ffffff;text-align:right;background:${HEX.navy};">TOTAL</td>
            <td style="padding:8px 10px;font-size:10.5px;font-weight:bold;color:#ffffff;text-align:right;background:${HEX.navy};">${escapeHtml(formatoMonto(total, oc.moneda))}</td>
          </tr>
        </tfoot>
      </table>

      <!-- Comentarios o instrucciones especiales -->
      <div style="background:${HEX.navy};color:#ffffff;padding:6px 12px;font-size:9.5px;font-weight:bold;letter-spacing:.03em;">COMENTARIOS O INSTRUCCIONES ESPECIALES</div>
      <div style="border:1px solid ${HEX.borde};border-top:none;padding:12px;min-height:60px;">
        ${
          comentarios.length
            ? comentarios.map((c) => `<div style="font-size:9.5px;color:${HEX.navy};margin-bottom:4px;">${escapeHtml(c)}</div>`).join('')
            : `<span style="font-size:9.5px;color:${HEX.gris};">—</span>`
        }
      </div>

      <div style="margin-top:24px;text-align:right;font-size:9px;color:${HEX.gris};">
        MTW ERP · Documento generado el ${new Date().toLocaleDateString('es-CL')}
      </div>
    </div>
  </div>
</body>
</html>`;
}
