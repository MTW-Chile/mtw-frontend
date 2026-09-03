// Estilo compartido de los PDFs exportables de la app (Hoja de Fijación,
// Analítica de Materiales, Presupuesto): mismo logo, colores de marca y
// estilo de tabla en los tres, para que se sientan un mismo documento.

export const MTW_ROJO: [number, number, number] = [227, 74, 38];
export const MTW_NAVY: [number, number, number] = [15, 23, 42];
export const MTW_HEAD_BG: [number, number, number] = [241, 245, 249];
export const MTW_BORDE: [number, number, number] = [226, 232, 240];
export const MTW_GRIS: [number, number, number] = [100, 116, 139];
export const MTW_GRIS_CLARO: [number, number, number] = [148, 163, 184];

export const loadImageDataUrl = async (url: string): Promise<string> => {
  const response = await fetch(url);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

// Estilo base de autoTable para todas las tablas de estos PDFs: header claro
// (no el navy oscuro por defecto de jspdf-autotable), texto navy, bordes
// finos y zebra sutil.
export const pdfTableStyle = {
  theme: 'grid' as const,
  styles: { fontSize: 8.5, cellPadding: 5, textColor: MTW_NAVY, lineColor: MTW_BORDE, lineWidth: 0.5 },
  headStyles: { fillColor: MTW_HEAD_BG, textColor: MTW_NAVY, fontStyle: 'bold' as const, fontSize: 8.5 },
  alternateRowStyles: { fillColor: [248, 250, 252] as [number, number, number] },
};

/**
 * Encabezado común: barra roja de acento + logo MTW arriba a la izquierda,
 * título del documento arriba a la derecha. Devuelve el logo cargado (o
 * null si falló) para que el llamador no repita el fetch en páginas nuevas.
 */
export async function drawPdfHeader(
  doc: any,
  titulo: string,
  subtitulo: string,
  pageWidth: number
): Promise<string | null> {
  doc.setFillColor(...MTW_ROJO);
  doc.rect(0, 0, pageWidth, 4, 'F');

  let logoDataUrl: string | null = null;
  try {
    logoDataUrl = await loadImageDataUrl('/mtw-logo.png');
    doc.addImage(logoDataUrl, 'PNG', 36, 18, 92, 42.1);
  } catch {
    // El logo es decorativo -- si falla la carga, el PDF sigue sin él.
  }

  doc.setTextColor(...MTW_NAVY);
  doc.setFontSize(17);
  doc.setFont('helvetica', 'bold');
  doc.text(titulo, pageWidth - 36, 36, { align: 'right' });
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...MTW_GRIS);
  doc.text(subtitulo, pageWidth - 36, 50, { align: 'right' });

  return logoDataUrl;
}
