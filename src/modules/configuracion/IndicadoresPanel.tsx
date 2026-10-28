import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound, TrendingUp } from 'lucide-react';
import { getConfiguracionIndicadores, guardarConfiguracionIndicadores } from '../../api/client';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Aviso } from '../../components/ui/Aviso';
import { Seccion } from '../../components/ui/Seccion';
import { Cargando, ErrorCarga } from '../../components/ui/Estados';
import { useConfirmar } from '../../components/ui/Confirmar';
import { extraerErrorParaToast, mostrarToast } from '../../lib/toast';
import { formatNumber } from '../../lib/utils';

/**
 * Configuración › Indicadores económicos: de dónde salen la UF, el dólar, el
 * euro y la UTM del día que usa todo el ERP (Inicio, adicionales, factura de
 * un estado de pago). La fuente oficial es la CMF, con una API key gratuita
 * que se carga aquí y queda cifrada en el servidor; sin ella se usan
 * proveedores sin registro (gael.cloud, mindicador.cl).
 */
export const IndicadoresPanel: React.FC<{ puedeEditar: boolean }> = ({ puedeEditar }) => {
  const queryClient = useQueryClient();
  const { confirmar } = useConfirmar();
  const [clave, setClave] = useState('');
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ['configuracionIndicadores'], queryFn: getConfiguracionIndicadores });

  const guardar = useMutation({
    mutationFn: (cmfApiKey: string | null) => guardarConfiguracionIndicadores(cmfApiKey),
    onSuccess: (c) => {
      queryClient.setQueryData(['configuracionIndicadores'], c);
      queryClient.invalidateQueries({ queryKey: ['indicadoresEconomicos'] });
      setClave('');
      mostrarToast(c.cmfConfigurada ? 'Clave de la CMF guardada: los indicadores salen de la fuente oficial.' : 'Clave quitada: se usan los proveedores de respaldo.', { tipo: 'info' });
    },
    onError: (e) => {
      const { mensaje, detalle } = extraerErrorParaToast(e);
      mostrarToast(mensaje, { detalle });
    },
  });

  const quitar = async () => {
    if (await confirmar({ titulo: 'Quitar la clave de la CMF', mensaje: 'Los indicadores pasarán a salir de los proveedores sin registro.', confirmar: 'Quitar', peligro: true })) guardar.mutate(null);
  };

  if (isLoading) return <Cargando />;
  if (isError || !data) return <ErrorCarga que="la configuración de indicadores" onReintentar={refetch} />;
  const v = data.vigentes;

  return (
    <div className="space-y-6">
      <Seccion icono={TrendingUp} titulo="Indicadores del día" descripcion="El mismo valor que ven Inicio, los adicionales y la factura de un estado de pago. Se guarda uno por día; si ningún proveedor responde, se usa el último guardado.">
        {v ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
              <Badge variant={v.desactualizado ? 'warning' : 'success'}>{v.desactualizado ? `Último valor: ${v.fecha}` : `Hoy · ${v.fecha}`}</Badge>
              <span>Fuente: <b className="text-slate-800">{v.fuente}</b></span>
            </div>
            <dl className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              {(
                [
                  ['UF', v.uf, 2],
                  ['Dólar', v.dolar, 2],
                  ['Euro', v.euro, 2],
                  ['UTM', v.utm, 0],
                ] as const
              ).map(([k, valor, dec]) => (
                <div key={k} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <dt className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">{k}</dt>
                  <dd className="font-mono tabular-nums text-slate-800 font-semibold">{valor != null ? `$${formatNumber(valor, dec)}` : '—'}</dd>
                </div>
              ))}
            </dl>
          </div>
        ) : (
          <Aviso tono="peligro" titulo="Sin indicadores">{data.error ?? 'Ningún proveedor respondió y no hay un valor guardado.'}</Aviso>
        )}
      </Seccion>

      <Seccion
        icono={KeyRound}
        titulo="Fuente oficial: CMF"
        descripcion="La Comisión para el Mercado Financiero publica la UF, el dólar observado, el euro y la UTM. La API key es gratuita (api.cmfchile.cl › Solicitar API Key) y queda cifrada en el servidor; nunca vuelve a mostrarse."
      >
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs">
            <Badge variant={data.cmfConfigurada ? 'success' : 'default'}>{data.cmfConfigurada ? 'Clave configurada' : 'Sin clave'}</Badge>
            <span className="text-slate-500">{data.cmfConfigurada ? 'Los indicadores se piden primero a la CMF.' : 'Se usan api.gael.cloud y mindicador.cl, que no piden registro.'}</span>
          </div>
          {puedeEditar && (
            <div className="flex flex-col sm:flex-row sm:items-end gap-2">
              <div className="flex-1">
                <Input label={data.cmfConfigurada ? 'Reemplazar clave' : 'API key de la CMF'} type="password" autoComplete="off" value={clave} onChange={(e) => setClave(e.target.value)} placeholder="Pega aquí la clave" helperText="Se prueba contra la CMF antes de guardarla." />
              </div>
              <Button size="sm" variant="primary" disabled={!clave.trim()} isLoading={guardar.isPending && guardar.variables !== null} onClick={() => guardar.mutate(clave.trim())}>
                Guardar clave
              </Button>
              {data.cmfConfigurada && (
                <Button size="sm" variant="outline" isLoading={guardar.isPending && guardar.variables === null} onClick={quitar}>
                  Quitar
                </Button>
              )}
            </div>
          )}
        </div>
      </Seccion>
    </div>
  );
};
