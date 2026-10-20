import { extraerErrorParaToast, mostrarToast } from '../../../lib/toast';

// Piezas compartidas de Configuración (lo visual vive en components/ui).

export const avisarError = (err: unknown) => mostrarToast(extraerErrorParaToast(err).mensaje);
