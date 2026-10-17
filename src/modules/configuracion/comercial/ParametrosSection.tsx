import React, { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Save } from 'lucide-react';
import { getConfiguracionGeneral, updateConfiguracionGeneral } from '../../../api/client';
import { Button } from '../../../components/ui/Button';
import type { ParametrosGenerales } from '../../../types';
import { CAMPO_CLASS, Cargando, ErrorCarga, Interruptor, Seccion, avisarError } from '../catalogo/comun';

// Campo numerico con etiqueta y ayuda; guarda texto local para editar sin saltos.
const Numero: React.FC<{
  etiqueta: string;
  ayuda?: string;
  valor: number | null;
  onChange: (v: number | null) => void;
  disabled: boolean;
  sufijo?: string;
  permiteVacio?: boolean;
}> = ({ etiqueta, ayuda, valor, onChange, disabled, sufijo, permiteVacio }) => (
  <label className="block space-y-1">
    <span className="block text-[11px] font-bold text-slate-600">{etiqueta}</span>
    <span className="flex items-center gap-1.5">
      <input
        type="number"
        step="any"
        min={0}
        disabled={disabled}
        value={valor ?? ''}
        placeholder={permiteVacio ? 'Sin límite' : undefined}
        onChange={(e) => onChange(e.target.value === '' ? (permiteVacio ? null : 0) : Number(e.target.value))}
        className={`${CAMPO_CLASS} text-right max-w-[160px]`}
      />
      {sufijo && <span className="text-[11px] text-slate-400">{sufijo}</span>}
    </span>
    {ayuda && <span className="block text-[10px] text-slate-400">{ayuda}</span>}
  </label>
);

const Grupo: React.FC<{ titulo: string; children: React.ReactNode }> = ({ titulo, children }) => (
  <fieldset className="space-y-3">
    <legend className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">{titulo}</legend>
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{children}</div>
  </fieldset>
);

/**
 * Parámetros comerciales y operativos que antes estaban escritos en el código:
 * IVA, tasas de respaldo, Hoja de Fijación por defecto, aprobación de
 * adicionales y tolerancias de conciliación.
 */
export const ParametrosSection: React.FC<{ puedeEditar: boolean }> = ({ puedeEditar }) => {
  const queryClient = useQueryClient();
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ['configuracionGeneral'], queryFn: getConfiguracionGeneral });
  const [form, setForm] = useState<ParametrosGenerales | null>(null);
  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  const guardar = useMutation({
    mutationFn: (p: ParametrosGenerales) => updateConfiguracionGeneral(p),
    onSuccess: (p) => {
      queryClient.setQueryData(['configuracionGeneral'], p);
      // La Analítica sin Hoja guardada usa estos valores por defecto.
      queryClient.invalidateQueries({ queryKey: ['proyectoDetail'] });
    },
    onError: avisarError,
  });

  if (isLoading || (!form && !isError)) return <Cargando />;
  if (isError || !form) return <ErrorCarga que="los parámetros" onReintentar={refetch} />;

  const sucio = JSON.stringify(form) !== JSON.stringify(data);
  const set = <K extends keyof ParametrosGenerales>(k: K, v: ParametrosGenerales[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));
  const dis = !puedeEditar;
  const pct = (fraccion: number) => Math.round(fraccion * 10000) / 100;

  return (
    <Seccion
      titulo="Parámetros"
      descripcion="Valores comerciales y operativos que usa todo el sistema. Cambiarlos no altera cotizaciones ya congeladas."
      accion={
        puedeEditar ? (
          <Button size="sm" leftIcon={<Save className="w-3.5 h-3.5" />} disabled={!sucio} isLoading={guardar.isPending} onClick={() => guardar.mutate(form)}>
            Guardar
          </Button>
        ) : undefined
      }
    >
      <div className="p-5 space-y-6">
        <Grupo titulo="Impuestos y divisas">
          <Numero etiqueta="IVA" sufijo="%" valor={form.ivaPct} disabled={dis} onChange={(v) => set('ivaPct', v ?? 0)} />
          <Numero
            etiqueta="Dólar de respaldo"
            sufijo="CLP"
            ayuda="Si la cotización aún no tiene sus tasas."
            valor={form.tasasRespaldo.dolar}
            disabled={dis}
            onChange={(v) => set('tasasRespaldo', { ...form.tasasRespaldo, dolar: v ?? 0 })}
          />
          <Numero etiqueta="Euro de respaldo" sufijo="CLP" valor={form.tasasRespaldo.euro} disabled={dis} onChange={(v) => set('tasasRespaldo', { ...form.tasasRespaldo, euro: v ?? 0 })} />
          <Numero etiqueta="UF de respaldo" sufijo="CLP" valor={form.tasasRespaldo.uf} disabled={dis} onChange={(v) => set('tasasRespaldo', { ...form.tasasRespaldo, uf: v ?? 0 })} />
        </Grupo>

        <Grupo titulo="Hoja de Fijación por defecto">
          {(
            [
              ['manoObraM2', 'Mano de obra fabricación', 'CLP/m² ventana'],
              ['filmM2', 'Film protector', 'CLP/m² vidrio'],
              ['materialInstalacionM2', 'Material de instalación', 'CLP/m² ventana'],
              ['instalacionM2', 'Instalación', 'CLP/m² ventana'],
              ['instalacionProtexM2', 'Instalación Puerta Protex', 'CLP/m²'],
              ['valorViaje', 'Valor por viaje', 'CLP'],
              ['ventanasPorViaje', 'Ventanas por viaje', 'ventanas'],
              ['margenPct', 'Margen de venta', '%'],
            ] as const
          ).map(([k, etiqueta, sufijo]) => (
            <Numero
              key={k}
              etiqueta={etiqueta}
              sufijo={sufijo}
              valor={form.fijacion[k]}
              disabled={dis}
              onChange={(v) => set('fijacion', { ...form.fijacion, [k]: v ?? 0 })}
            />
          ))}
        </Grupo>

        <Grupo titulo="Adicionales">
          <label className="flex items-start gap-2.5 text-xs">
            <Interruptor
              valor={form.adicional.requiereAprobacion}
              disabled={dis}
              etiqueta="Requiere aprobación gerencial"
              onChange={(v) => set('adicional', { ...form.adicional, requiereAprobacion: v })}
            />
            <span>
              <span className="block font-bold text-slate-800">Requiere aprobación gerencial</span>
              <span className="block text-[10px] text-slate-400">Antes de enviarse al cliente o al instalador.</span>
            </span>
          </label>
          <Numero
            etiqueta="Desde un monto de venta"
            sufijo="UF"
            permiteVacio
            ayuda="Vacío: siempre que se exija aprobación."
            valor={form.adicional.umbralAprobacionUf}
            disabled={dis || !form.adicional.requiereAprobacion}
            onChange={(v) => set('adicional', { ...form.adicional, umbralAprobacionUf: v })}
          />
        </Grupo>

        <Grupo titulo="Conciliación de facturas">
          <Numero
            etiqueta="Cuadra con la OC"
            sufijo="%"
            ayuda="Diferencia aceptada entre factura y OC."
            valor={pct(form.conciliacion.toleranciaCuadre)}
            disabled={dis}
            onChange={(v) => set('conciliacion', { ...form.conciliacion, toleranciaCuadre: (v ?? 0) / 100 })}
          />
          <Numero
            etiqueta="Sugerencia de ítems"
            sufijo="%"
            valor={pct(form.conciliacion.toleranciaSugerencia)}
            disabled={dis}
            onChange={(v) => set('conciliacion', { ...form.conciliacion, toleranciaSugerencia: (v ?? 0) / 100 })}
          />
          <Numero
            etiqueta="Filtro de facturas por monto"
            sufijo="%"
            valor={pct(form.conciliacion.toleranciaFiltro)}
            disabled={dis}
            onChange={(v) => set('conciliacion', { ...form.conciliacion, toleranciaFiltro: (v ?? 0) / 100 })}
          />
        </Grupo>
      </div>
    </Seccion>
  );
};
