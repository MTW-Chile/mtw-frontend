// PDF de un adicional: mismo lenguaje visual que la oferta (presupuestoPdf.ts:
// colores, encabezado, textos y condiciones), pero con una tabla de ítems
// (descripción, cantidad, unidad, precio unitario, total) en vez de tarjetas
// de ventana -- un adicional de ítems sueltos no es una ventana ni un vidrio.
// Sin imports de React: se puede generar desde un script para revisarlo.
import { HEX, escapeHtml } from '../../cotizaciones/steps/Step5Consolidacion/presupuestoPdf';
import type { Adicional } from '../../../types';
import { ETIQUETA_FORMA_COBRO } from '../../../types';

const clp = (v: number) => `$ ${Math.round(v).toLocaleString('es-CL')}`;
const cantidad = (v: number) => v.toLocaleString('es-CL', { maximumFractionDigits: 2 });

export interface AdicionalPdfParams {
  adicional: Adicional;
  logoDataUrl: string | null;
}

export function buildAdicionalHtml({ adicional: a, logoDataUrl }: AdicionalPdfParams): string {
  const codigo = `${a.proyecto.codigoInterno ?? a.proyecto.obra} · Adicional A${a.numero}`;
  const fecha = new Date(a.fechaEnvio ?? Date.now()).toLocaleDateString('es-CL');
  const descuento = a.cargoA === 'INSTALADOR' && a.formaCobroInstalador === 'DESCUENTO_ESTADO_PAGO';
  const titulo = a.cargoA === 'INSTALADOR' ? 'Cargo al instalador' : 'Cotización de adicional';
  const destinatario =
    a.cargoA === 'INSTALADOR'
      ? { etiqueta: 'Instalador', nombre: a.instalador?.nombre ?? '—', rut: a.instalador?.rut ?? null }
      : { etiqueta: 'Señor(es)', nombre: a.proyecto.cliente?.nombre ?? '—', rut: a.proyecto.cliente?.rut ?? null };
  const tasaUf = Number(a.tasaUf);

  const filas = a.items
    .map(
      (i, idx) => `
      <tr style="background:${idx % 2 ? HEX.zebra : '#fff'};">
        <td style="padding:6px 8px;font-size:9.5px;color:${HEX.navy};">${escapeHtml(i.descripcion)}</td>
        <td style="padding:6px 8px;font-size:9.5px;color:${HEX.navy};text-align:right;">${cantidad(Number(i.cantidad))}</td>
        <td style="padding:6px 8px;font-size:9.5px;color:${HEX.gris};">${escapeHtml(i.unidad)}</td>
        <td style="padding:6px 8px;font-size:9.5px;color:${HEX.navy};text-align:right;">${clp(i.precioUnitario)}</td>
        <td style="padding:6px 8px;font-size:9.5px;color:${HEX.navy};text-align:right;font-weight:bold;">${clp(i.precioTotal)}</td>
      </tr>`
    )
    .join('');

  const condiciones = a.condicionesComerciales
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => `<li style="margin-bottom:3px;">${escapeHtml(l)}</li>`)
    .join('');

  const filaTotal = (etiqueta: string, valor: string, fuerte = false) => `
    <tr>
      <td style="padding:4px 10px;font-size:9.5px;color:${HEX.gris};text-align:right;">${etiqueta}</td>
      <td style="padding:4px 10px;font-size:${fuerte ? '11px' : '9.5px'};color:${HEX.navy};text-align:right;font-weight:${fuerte ? 'bold' : 'normal'};">${valor}</td>
    </tr>`;
  const totales = descuento
    ? filaTotal('Monto a descontar (neto)', clp(a.totales.venta), true)
    : filaTotal('Subtotal neto', clp(a.totales.venta)) +
      filaTotal(`IVA (${a.totales.ivaPct}%)`, clp(a.totales.iva)) +
      filaTotal('Total', clp(a.totales.totalConIva), true);

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8" />
<style>
  @page { size: A4; margin: 42px; }
  body { font-family: Helvetica, Arial, sans-serif; color: ${HEX.navy}; margin: 0; }
</style></head>
<body>
  ${logoDataUrl ? `<img src="${logoDataUrl}" style="max-width:101px;max-height:46px;width:auto;height:auto;object-fit:contain;display:block;margin-bottom:12px;" />` : ''}
  <div style="font-size:20px;font-weight:bold;color:${HEX.navy};">${escapeHtml(titulo)}</div>
  <div style="border-top:2px solid ${HEX.rojo};margin:8px 0 10px;"></div>
  <table style="width:100%;font-size:9.5px;margin-bottom:12px;">
    <tr>
      <td style="color:${HEX.navy};font-weight:bold;">${escapeHtml(codigo)}</td>
      <td style="text-align:right;color:${HEX.gris};">Fecha: ${escapeHtml(fecha)}</td>
    </tr>
  </table>
  <table style="font-size:9.5px;margin-bottom:12px;border-collapse:collapse;">
    <tr><td style="color:${HEX.gris};padding:2px 12px 2px 0;">${destinatario.etiqueta}</td><td style="font-weight:bold;">${escapeHtml(destinatario.nombre)}</td></tr>
    ${destinatario.rut ? `<tr><td style="color:${HEX.gris};padding:2px 12px 2px 0;">R.U.T.</td><td>${escapeHtml(destinatario.rut)}</td></tr>` : ''}
    <tr><td style="color:${HEX.gris};padding:2px 12px 2px 0;">Obra</td><td>${escapeHtml(a.proyecto.obra)}</td></tr>
    <tr><td style="color:${HEX.gris};padding:2px 12px 2px 0;">Referencia</td><td>${escapeHtml(a.titulo)}</td></tr>
    ${a.cargoA === 'INSTALADOR' && a.formaCobroInstalador ? `<tr><td style="color:${HEX.gris};padding:2px 12px 2px 0;">Forma de cobro</td><td>${escapeHtml(ETIQUETA_FORMA_COBRO[a.formaCobroInstalador])}</td></tr>` : ''}
  </table>
  ${a.textoPresentacion ? `<p style="font-size:10px;line-height:1.5;margin:0 0 14px;">${escapeHtml(a.textoPresentacion)}</p>` : ''}

  <table style="width:100%;border-collapse:collapse;margin-bottom:10px;">
    <thead>
      <tr style="background:${HEX.headBg};">
        <th style="padding:6px 8px;font-size:9px;text-align:left;color:${HEX.navy};">PRODUCTO O SERVICIO</th>
        <th style="padding:6px 8px;font-size:9px;text-align:right;color:${HEX.navy};">CANTIDAD</th>
        <th style="padding:6px 8px;font-size:9px;text-align:left;color:${HEX.navy};">UNIDAD</th>
        <th style="padding:6px 8px;font-size:9px;text-align:right;color:${HEX.navy};">PRECIO UNIT.</th>
        <th style="padding:6px 8px;font-size:9px;text-align:right;color:${HEX.navy};">TOTAL</th>
      </tr>
    </thead>
    <tbody>${filas}</tbody>
  </table>
  <table style="margin-left:auto;border-collapse:collapse;margin-bottom:6px;">${totales}</table>
  ${tasaUf > 0 ? `<p style="font-size:8.5px;color:${HEX.gris};text-align:right;margin:0 0 16px;">Equivalente: ${(a.totales.venta / tasaUf).toLocaleString('es-CL', { maximumFractionDigits: 2 })} UF neto (UF $ ${tasaUf.toLocaleString('es-CL', { maximumFractionDigits: 2 })}).</p>` : ''}

  ${condiciones ? `<div style="font-size:10px;font-weight:bold;margin-bottom:4px;">Condiciones comerciales</div><ul style="font-size:9.5px;line-height:1.45;padding-left:16px;margin:0;">${condiciones}</ul>` : ''}
</body></html>`;
}
