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

  // Indicadores Económicos (UF, Dolar, Euro, UTM). Antes, cualquier falla
  // (timeout, mindicador.cl caido, respuesta parcial) se tragaba en el
  // catch y devolvia numeros de relleno fijos -- se veian como un valor
  // real (mismo formato, mismo color) pero quedaban desactualizados apenas
  // pasaba un dia, y como el catch nunca dejaba propagar el error,
  // tampoco se disparaban los reintentos automaticos de react-query. Ahora
  // el queryFn deja fallar de verdad (incluye validar que la API haya
  // mandado los 4 numeros, no una respuesta parcial) para que react-query
  // reintente solo y, si a la tercera sigue sin poder, el consumidor lo
  // vea por isError en vez de mostrar un numero inventado.
  const indicadoresQuery = useQuery({
    queryKey: ['indicadoresEconomicosChile'],
    queryFn: async (): Promise<IndicadoresChile> => {
      const res = await axios.get('https://mindicador.cl/api', { timeout: 4000 });
      const uf = res.data?.uf?.valor;
      const dolar = res.data?.dolar?.valor;
      const euro = res.data?.euro?.valor;
      const utm = res.data?.utm?.valor;
      const valores = { uf, dolar, euro, utm };
      const incompleta = Object.values(valores).some((v) => typeof v !== 'number' || !Number.isFinite(v) || v <= 0);
      if (incompleta) {
        throw new Error('mindicador.cl devolvió una respuesta incompleta.');
      }
      return { ...valores, fecha: res.data?.fecha || new Date().toISOString() };
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
    isErrorIndicadores: indicadoresQuery.isError,
    feriadoInfo: feriadosQuery.data,
  };
}
