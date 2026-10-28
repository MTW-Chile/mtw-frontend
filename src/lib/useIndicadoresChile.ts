import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { getIndicadores } from '../api/client';
import type { IndicadoresEconomicos } from '../types';

export type IndicadoresChile = IndicadoresEconomicos;

export interface FeriadoChile {
  nombre: string;
  fecha: string;
  irrenunciable?: boolean;
}

/**
 * Indicadores economicos del dia y feriados de Chile.
 *
 * Los indicadores (UF, dolar, euro, UTM) los sirve mtw-api (GET /api/indicadores):
 * ahi se elige el proveedor (CMF oficial si hay API key, si no gael.cloud o
 * mindicador.cl), se guarda el valor por fecha y, si ningun proveedor responde,
 * llega el ultimo dia guardado con `desactualizado`. Antes el navegador
 * llamaba directo a mindicador.cl, que se caia seguido y dejaba la pantalla
 * sin valor; ahora todas las pantallas usan el mismo numero que el backend.
 */
export function useIndicadoresChile() {
  const currentYear = new Date().getFullYear();

  const indicadoresQuery = useQuery({
    queryKey: ['indicadoresEconomicos'],
    queryFn: getIndicadores,
    staleTime: 1000 * 60 * 10,
  });

  // Feriados de Chile (ChileDataAPI / Nager.Date)
  const feriadosQuery = useQuery({
    queryKey: ['feriadosChile', currentYear],
    queryFn: async (): Promise<{ hoyFeriado: string | null; proximoFeriado: string | null }> => {
      try {
        const res = await axios.get(
          `https://date.nager.at/api/v3/PublicHolidays/${currentYear}/CL`,
          { timeout: 4000 }
        );
        const feriados: { date: string; localName: string }[] = res.data || [];
        const todayStr = new Date().toISOString().split('T')[0];

        // Verificar si hoy es feriado
        const hoy = feriados.find((f) => f.date === todayStr);
        if (hoy) {
          return {
            hoyFeriado: `🎉 Hoy: ${hoy.localName}`,
            proximoFeriado: null,
          };
        }

        // Buscar el próximo feriado
        const proximo = feriados.find((f) => f.date > todayStr);
        if (proximo) {
          const parts = proximo.date.split('-');
          const fechaFormat = `${parts[2]}/${parts[1]}`;
          return {
            hoyFeriado: null,
            proximoFeriado: `📅 Próx. feriado: ${fechaFormat} (${proximo.localName})`,
          };
        }

        return { hoyFeriado: null, proximoFeriado: null };
      } catch {
        return { hoyFeriado: null, proximoFeriado: null };
      }
    },
    staleTime: 1000 * 60 * 60 * 24, // 24 horas
  });

  return {
    indicadores: indicadoresQuery.data,
    isLoadingIndicadores: indicadoresQuery.isLoading,
    isErrorIndicadores: indicadoresQuery.isError,
    feriadoInfo: feriadosQuery.data,
  };
}
