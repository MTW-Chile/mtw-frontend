import { getProyectos } from '../../api/client';

// Consulta de la lista de Presupuestos, compartida entre la pantalla y la
// insignia numerica del menu (App.tsx): con la misma clave y la misma
// funcion comparten cache, asi la insignia SIEMPRE cuenta lo mismo que
// muestra el filtro por defecto.
export type FiltroPresupuestos = 'PRINCIPAL' | 'TODOS';

export const clavePresupuestos = (filtro: FiltroPresupuestos) => ['proyectos', 'presupuestos', filtro] as const;

// El filtro por estado va en el SERVIDOR (ver comentario en
// CotizacionesPage): la lista pagina por actualizadoEn y un resync amplio
// puede llenar la pagina con otros estados. Las obras manuales (nunca
// cotizadas) se excluyen aca tambien, para que ni la lista ni la insignia
// las cuenten.
export const consultarPresupuestos = (filtro: FiltroPresupuestos) =>
  getProyectos({ limit: 100, estado: filtro === 'PRINCIPAL' ? 2 : undefined, excluirOrigen: 'MANUAL_OBRA' });
