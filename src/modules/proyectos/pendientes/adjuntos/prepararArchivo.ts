import { LADO_MAXIMO_FOTO, debeReducir, dimensionesReducidas, mimeDeArchivo, nombreComoJpg } from './utils';

export interface ArchivoListo {
  blob: Blob;
  nombre: string;
  mime: string;
}

// Deja el archivo listo para subir. Las fotos pesadas se reducen (lado mayor
// 1920 px, JPEG): una foto de telefono de 8 MB queda en ~400 KB, que sube bien
// con la señal de una obra. Si algo falla, o la reduccion no mejora nada, se
// sube el original: reducir es solo una optimizacion, nunca debe impedir adjuntar.
export async function prepararArchivo(archivo: File): Promise<ArchivoListo> {
  const mime = mimeDeArchivo(archivo.name, archivo.type);
  const original: ArchivoListo = { blob: archivo, nombre: archivo.name, mime };
  if (!debeReducir(mime, archivo.size)) return original;
  try {
    const imagen = await createImageBitmap(archivo, { imageOrientation: 'from-image' });
    const nuevo = dimensionesReducidas(imagen.width, imagen.height, LADO_MAXIMO_FOTO) ?? { ancho: imagen.width, alto: imagen.height };
    const lienzo = document.createElement('canvas');
    lienzo.width = nuevo.ancho;
    lienzo.height = nuevo.alto;
    const ctx = lienzo.getContext('2d');
    if (!ctx) return original;
    ctx.drawImage(imagen, 0, 0, nuevo.ancho, nuevo.alto);
    imagen.close();
    const blob = await new Promise<Blob | null>((resolve) => lienzo.toBlob(resolve, 'image/jpeg', 0.82));
    if (!blob || blob.size >= archivo.size) return original;
    return { blob, nombre: nombreComoJpg(archivo.name), mime: 'image/jpeg' };
  } catch {
    return original;
  }
}
