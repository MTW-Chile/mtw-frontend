import { subirAdjuntoPendiente } from '../../../../api/client';
import { extraerErrorParaToast } from '../../../../lib/toast';
import { prepararArchivo } from './prepararArchivo';

export interface ResultadoSubida {
  subidos: number;
  /** "nombre: motivo" de cada archivo que no se pudo subir. */
  fallidos: string[];
}

// Sube los archivos de a uno (la señal de una obra no soporta varios a la vez)
// y sigue con los demas si alguno falla: el resultado dice cuales no subieron.
export async function subirArchivos(
  pendienteId: string,
  archivos: File[],
  alAvanzar?: (hechos: number, total: number) => void
): Promise<ResultadoSubida> {
  const resultado: ResultadoSubida = { subidos: 0, fallidos: [] };
  for (let i = 0; i < archivos.length; i++) {
    alAvanzar?.(i, archivos.length);
    const original = archivos[i];
    try {
      const listo = await prepararArchivo(original);
      await subirAdjuntoPendiente(pendienteId, listo.blob, listo.nombre, listo.mime);
      resultado.subidos++;
    } catch (e) {
      resultado.fallidos.push(`${original.name}: ${extraerErrorParaToast(e).mensaje}`);
    }
  }
  alAvanzar?.(archivos.length, archivos.length);
  return resultado;
}
