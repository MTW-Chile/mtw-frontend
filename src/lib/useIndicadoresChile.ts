import { useQuery } from '@tanstack/react-query';
import axios from 'axios';

export interface IndicadoresChile {
  uf: number;
  dolar: number;
  euro: number;
  utm: number;
  fecha: string;
}

export interface FeriadoChile {
  nombre: string;
  fecha: string;
  irrenunciable?: boolean;
}

export function useIndicadoresChile() {
  const currentYear = new Date().getFullYear();

  // Indicadores Económicos (UF, Dolar, Euro, UTM)
  const indicadoresQuery = useQuery({
    queryKey: ['indicadoresEconomicosChile'],
    queryFn: async (): Promise<IndicadoresChile> => {
      try {
        const res = await axios.get('https://mindicador.cl/api', {
          timeout: 4000,
        });
        return {
          uf: res.data?.uf?.valor || 39850,
          dolar: res.data?.dolar?.valor || 945,
          euro: res.data?.euro?.valor || 1025,
          utm: res.data?.utm?.valor || 68450,
          fecha: res.data?.fecha || new Date().toISOString(),
        };
      } catch {
        // Fallback referencial realista si falla la conexión externa
        return {
          uf: 39850,
          dolar: 945.5,
          euro: 1025.8,
          utm: 68450,
          fecha: new Date().toISOString(),
        };
      }
    },
    staleTime: 1000 * 60 * 60, // 1 hora
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
    feriadoInfo: feriadosQuery.data,
  };
}
