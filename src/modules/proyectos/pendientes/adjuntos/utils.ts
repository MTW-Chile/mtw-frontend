// Utilidades puras de los adjuntos de pendientes (sin red ni DOM, para poder probarlas).

export const TAMANO_MAXIMO_ADJUNTO = 20 * 1024 * 1024;
// Fotos mas grandes que esto (o de mas de LADO_MAXIMO_FOTO) se reducen antes de subir: las camaras
// de los telefonos entregan 5-10 MB y en obra la señal es mala.
export const UMBRAL_REDUCIR = 1024 * 1024;
export const LADO_MAXIMO_FOTO = 1920;

// Los mismos tipos que acepta el servidor (src/onedrive.ts).
const MIME_POR_EXTENSION: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  heic: 'image/heic',
  heif: 'image/heif',
  pdf: 'application/pdf',
  txt: 'text/plain',
  csv: 'text/csv',
  doc: 'application/msword',
  xls: 'application/vnd.ms-excel',
  ppt: 'application/vnd.ms-powerpoint',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
};

export const MIMES_ADJUNTO = new Set(Object.values(MIME_POR_EXTENSION));

/** Atributo `accept` del selector de archivos. */
export const ACCEPT_ADJUNTOS = Object.keys(MIME_POR_EXTENSION)
  .map((e) => `.${e}`)
  .join(',');

/** Tipo del archivo: el que informa el navegador o, si viene vacio (pasa con HEIC y algunos Android), el de la extension. */
export function mimeDeArchivo(nombre: string, mimeNavegador: string): string {
  const m = (mimeNavegador || '').toLowerCase().trim();
  if (m && m !== 'application/octet-stream') return m;
  const ext = nombre.includes('.') ? nombre.split('.').pop()!.toLowerCase() : '';
  return MIME_POR_EXTENSION[ext] ?? m;
}

export const esImagen = (mime: string) => mime.toLowerCase().startsWith('image/');

/** Las que el navegador sabe decodificar para reducirlas (HEIC no). */
export const esImagenReducible = (mime: string) => ['image/jpeg', 'image/png', 'image/webp'].includes(mime.toLowerCase());

/** Mensaje si el archivo no se puede adjuntar; null si esta bien. */
export function problemaDeArchivo(nombre: string, mime: string, tamano: number): string | null {
  if (!MIMES_ADJUNTO.has(mime.toLowerCase())) return `"${nombre}": tipo de archivo no permitido. Se aceptan fotos, PDF y documentos de Office.`;
  if (tamano <= 0) return `"${nombre}" está vacío.`;
  if (tamano > TAMANO_MAXIMO_ADJUNTO) return `"${nombre}" pesa ${formatoTamano(tamano)}; el máximo es ${TAMANO_MAXIMO_ADJUNTO / 1024 / 1024} MB.`;
  return null;
}

export function formatoTamano(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** Tamaño al que reducir una foto para que su lado mayor sea `max`; null si no hace falta. */
export function dimensionesReducidas(ancho: number, alto: number, max = LADO_MAXIMO_FOTO): { ancho: number; alto: number } | null {
  const mayor = Math.max(ancho, alto);
  if (mayor <= max || ancho <= 0 || alto <= 0) return null;
  const f = max / mayor;
  return { ancho: Math.round(ancho * f), alto: Math.round(alto * f) };
}

/** Una foto se reduce si pesa mucho o si es mas grande que el maximo. */
export function debeReducir(mime: string, tamano: number): boolean {
  return esImagenReducible(mime) && tamano > UMBRAL_REDUCIR;
}

/** Nombre del archivo reducido: siempre .jpg (se recodifica como JPEG). */
export function nombreComoJpg(nombre: string): string {
  const base = nombre.replace(/\.[^./\\]+$/, '');
  return `${base || 'foto'}.jpg`;
}

/** Tope al ELEGIR una foto reducible: se reduce antes de subir, asi que acepta fotos mas pesadas que el maximo del servidor. */
export const TAMANO_MAXIMO_FOTO_ORIGINAL = 80 * 1024 * 1024;

/** Como problemaDeArchivo, pero deja pasar las fotos pesadas que se van a reducir. */
export function problemaAlElegir(nombre: string, mime: string, tamano: number): string | null {
  if (esImagenReducible(mime) && tamano > 0 && tamano <= TAMANO_MAXIMO_FOTO_ORIGINAL) return null;
  return problemaDeArchivo(nombre, mime, tamano);
}
