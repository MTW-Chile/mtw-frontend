import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileCheck2, KeyRound } from 'lucide-react';
import { getConfiguracionBsale, guardarConfiguracionBsale } from '../../api/client';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Aviso } from '../../components/ui/Aviso';
import { Seccion } from '../../components/ui/Seccion';
import { Interruptor } from '../../components/ui/Campos';
import { Cargando, ErrorCarga } from '../../components/ui/Estados';
import { useConfirmar } from '../../components/ui/Confirmar';
import { extraerErrorParaToast, mostrarToast } from '../../lib/toast';
import type { ConfiguracionBsale } from '../../types';

/**
 * Configuración › Integraciones › Bsale: token de la API (cifrado en el
 * servidor, se prueba antes de guardarse) y parámetros con que se emite la
 * guía de despacho electrónica (sucursal, tipo de traslado, declarar al SII).
 * Sin token cargado aquí, la API usa las variables BSALE_* del entorno si
 * existen; sin ninguna, los despachos se emiten con guía manual o sin guía.
 */
export const BsalePanel: React.FC<{ puedeEditar: boolean }> = ({ puedeEditar }) => {
  const queryClient = useQueryClient();
  const { confirmar } = useConfirmar();
  const [token, setToken] = useState('');
  // Error del último guardado, visible en el panel (no solo como toast que desaparece).
  const [errorGuardado, setErrorGuardado] = useState<string | null>(null);
  const [officeId, setOfficeId] = useState<string | null>(null);
  const [shippingTypeId, setShippingTypeId] = useState<string | null>(null);
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ['configuracionBsale'], queryFn: getConfiguracionBsale });

  const guardar = useMutation({
    mutationFn: (cambios: Parameters<typeof guardarConfiguracionBsale>[0]) => guardarConfiguracionBsale(cambios),
    onSuccess: (c: ConfiguracionBsale, cambios) => {
      queryClient.setQueryData(['configuracionBsale'], c);
      queryClient.invalidateQueries({ queryKey: ['bsaleEstado'] });
      setToken('');
      setOfficeId(null);
      setShippingTypeId(null);
      setErrorGuardado(null);
      mostrarToast(cambios.accessToken === null ? 'Token de Bsale quitado.' : cambios.accessToken ? 'Token de Bsale guardado y probado.' : 'Parámetros de Bsale guardados.', { tipo: 'info' });
    },
    onError: (e) => {
      const { mensaje, detalle } = extraerErrorParaToast(e);
      setErrorGuardado(detalle ? `${mensaje} ${detalle}` : mensaje);
      mostrarToast(mensaje, { detalle });
    },
  });

  const quitar = async () => {
    if (await confirmar({ titulo: 'Quitar el token de Bsale', mensaje: 'Los despachos dejarán de poder emitir guía electrónica (salvo que el servidor tenga BSALE_ACCESS_TOKEN).', confirmar: 'Quitar', peligro: true }))
      guardar.mutate({ accessToken: null });
  };

  if (isLoading) return <Cargando />;
  if (isError || !data) return <ErrorCarga que="la configuración de Bsale" onReintentar={refetch} />;

  const entero = (v: string | null, actual: number | null) => (v === null ? actual : v.trim() === '' ? null : Number.isInteger(Number(v)) && Number(v) > 0 ? Number(v) : actual);
  const parametrosCambiados = officeId !== null || shippingTypeId !== null;

  return (
    <div className="space-y-6">
      {errorGuardado && (
        <Aviso tono="peligro" titulo="No se guardó">
          {errorGuardado}
        </Aviso>
      )}
      {data.error && (
        <Aviso tono="peligro" titulo="El token guardado no se puede leer">
          {data.error}
        </Aviso>
      )}
      <Seccion
        icono={KeyRound}
        titulo="Token de acceso"
        descripcion="Bsale › Integraciones › API. Se prueba contra la cuenta antes de guardarse y queda cifrado en el servidor; nunca vuelve a mostrarse."
      >
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Badge variant={data.configurada ? 'success' : 'default'}>{data.configurada ? 'Conectado' : 'Sin token'}</Badge>
            <span className="text-slate-500">
              {data.origen === 'configuracion' ? 'Token cargado desde el ERP.' : data.origen === 'entorno' ? 'Token tomado de las variables del servidor (BSALE_ACCESS_TOKEN); cárgalo aquí para administrarlo desde el ERP.' : 'Los despachos se emiten con guía manual o sin guía.'}
            </span>
            {data.url && <span className="text-slate-400 font-mono">{data.url}</span>}
          </div>
          {puedeEditar && (
            <div className="flex flex-col sm:flex-row sm:items-end gap-2">
              <div className="flex-1">
                <Input label={data.origen === 'configuracion' ? 'Reemplazar token' : 'Token de la API de Bsale'} type="password" autoComplete="off" value={token} onChange={(e) => setToken(e.target.value)} placeholder="Pega aquí el token" helperText="Se prueba listando los tipos de despacho de la cuenta." />
              </div>
              <Button size="sm" variant="primary" disabled={!token.trim()} isLoading={guardar.isPending && !!guardar.variables?.accessToken} onClick={() => { setErrorGuardado(null); guardar.mutate({ accessToken: token.trim() }); }}>
                Guardar token
              </Button>
              {data.origen === 'configuracion' && (
                <Button size="sm" variant="outline" isLoading={guardar.isPending && guardar.variables?.accessToken === null} onClick={quitar}>
                  Quitar
                </Button>
              )}
            </div>
          )}
        </div>
      </Seccion>

      <Seccion icono={FileCheck2} titulo="Cómo se emite la guía" descripcion="Parámetros de la guía de despacho electrónica (código SII 52).">
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <Input
              label="Sucursal emisora (officeId)"
              inputMode="numeric"
              value={officeId ?? (data.officeId == null ? '' : String(data.officeId))}
              onChange={(e) => setOfficeId(e.target.value)}
              placeholder="Vacío = sucursal por defecto"
              helperText="Id de Bsale (GET /v1/offices.json)."
              disabled={!puedeEditar}
            />
            <Input
              label="Tipo de traslado (shippingTypeId)"
              inputMode="numeric"
              value={shippingTypeId ?? String(data.shippingTypeId)}
              onChange={(e) => setShippingTypeId(e.target.value)}
              helperText="6 = Otros traslados no venta (GET /v1/shipping_types.json)."
              disabled={!puedeEditar}
            />
          </div>
          <Interruptor
            etiqueta="Declarar la guía al SII"
            label="Declarar la guía al SII"
            valor={data.declararSii}
            disabled={!puedeEditar || guardar.isPending}
            onChange={(v) => guardar.mutate({ declararSii: v })}
          />
          {!data.declararSii && <Aviso tono="advertencia">Las guías quedan como borrador interno en Bsale: no se declaran al SII.</Aviso>}
          {puedeEditar && parametrosCambiados && (
            <div className="flex gap-2">
              <Button
                size="sm"
                isLoading={guardar.isPending && !guardar.variables?.accessToken && guardar.variables?.accessToken !== null}
                onClick={() => guardar.mutate({ officeId: entero(officeId, data.officeId), shippingTypeId: entero(shippingTypeId, data.shippingTypeId) ?? data.shippingTypeId })}
              >
                Guardar parámetros
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setOfficeId(null); setShippingTypeId(null); }}>
                Descartar
              </Button>
            </div>
          )}
        </div>
      </Seccion>
    </div>
  );
};
