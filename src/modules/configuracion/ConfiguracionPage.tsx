import React, { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Save, Settings } from 'lucide-react';
import { getConfiguracionEmpresa, updateConfiguracionEmpresa } from '../../api/client';
import type { ConfiguracionEmpresa } from '../../types';

// Únicos textos "por defecto" que siguen viviendo en el código, no en la
// base -- el piso final si la fila de configuración está vacía (recién
// creada) Y el usuario todavía no cargó nada acá. Antes ESTOS eran los
// únicos valores posibles (hardcodeados en PresupuestoOferta.tsx); ahora
// son solo el fallback del fallback.
const FALLBACK_TEXTO = 'De acuerdo a sus requerimientos y solicitud de cotización, presentamos propuesta de Ventanas MTW con las líneas adecuadas para su proyecto.';
const FALLBACK_CONDICIONES = `Se considera provisión e instalación de ventanas de PVC y termopaneles según especificación del proyecto.
Validez de la oferta 30 días.
Valores expresados en Unidades de Fomento (UF) más IVA.
Se considera anticipo del 10% del valor del contrato.`;

const Campo: React.FC<{ label: string; hint?: string; children: React.ReactNode }> = ({ label, hint, children }) => (
  <div className="space-y-1.5">
    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">{label}</label>
    {children}
    {hint && <p className="text-[11px] text-slate-400">{hint}</p>}
  </div>
);

const inputClass = 'w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-[#E34A26] transition-colors';

export const ConfiguracionPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['configuracionEmpresa'],
    queryFn: () => getConfiguracionEmpresa(),
  });
  const config = data?.configuracionEmpresa;

  const [form, setForm] = useState<Partial<ConfiguracionEmpresa>>({});
  // Solo pisa el formulario con lo que llega del servidor la PRIMERA vez
  // que carga (config pasa de undefined a un objeto) -- si lo hiciéramos
  // en cada refetch, cualquier cambio sin guardar del usuario se perdería
  // apenas React Query revalidara en segundo plano.
  useEffect(() => {
    if (config) setForm(config);
  }, [config?.id]);

  const mutation = useMutation({
    mutationFn: () => updateConfiguracionEmpresa(form),
    onSuccess: (res) => {
      queryClient.setQueryData(['configuracionEmpresa'], { success: true, configuracionEmpresa: res.configuracionEmpresa });
    },
  });

  const setCampo = (campo: keyof ConfiguracionEmpresa, valor: string) => setForm((f) => ({ ...f, [campo]: valor }));

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center text-slate-400">
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-5 sm:p-8 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#E34A26]/10 flex items-center justify-center text-[#E34A26]">
          <Settings className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-base font-black text-slate-900">Configuración</h1>
          <p className="text-xs text-slate-500">Branding y textos por defecto del Presupuesto (Oferta Cliente) -- afecta a todos los proyectos.</p>
        </div>
      </div>

      <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">Redes sociales del footer</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <Campo label="Sitio web (URL)">
            <input
              className={inputClass}
              placeholder="https://www.mtw.cl"
              value={form.footerWebUrl ?? ''}
              onChange={(e) => setCampo('footerWebUrl', e.target.value)}
            />
          </Campo>
          <Campo label="Sitio web (texto a mostrar)">
            <input
              className={inputClass}
              placeholder="www.mtw.cl"
              value={form.footerWebLabel ?? ''}
              onChange={(e) => setCampo('footerWebLabel', e.target.value)}
            />
          </Campo>
          <Campo label="Instagram (URL)">
            <input
              className={inputClass}
              placeholder="https://instagram.com/mtwchile"
              value={form.footerInstagramUrl ?? ''}
              onChange={(e) => setCampo('footerInstagramUrl', e.target.value)}
            />
          </Campo>
          <Campo label="Instagram (@handle a mostrar)">
            <input
              className={inputClass}
              placeholder="@MTWChile"
              value={form.footerInstagramHandle ?? ''}
              onChange={(e) => setCampo('footerInstagramHandle', e.target.value)}
            />
          </Campo>
        </div>
      </div>

      <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">Textos por defecto del Presupuesto</h2>
        <Campo label="Texto de presentación" hint="Se precarga en cada Presupuesto nuevo -- el vendedor lo puede editar por proyecto sin afectar este default.">
          <textarea
            rows={3}
            className={inputClass}
            placeholder={FALLBACK_TEXTO}
            value={form.textoPresentacionDefault ?? ''}
            onChange={(e) => setCampo('textoPresentacionDefault', e.target.value)}
          />
        </Campo>
        <Campo label="Condiciones comerciales" hint="Una condición por línea.">
          <textarea
            rows={6}
            className={inputClass}
            placeholder={FALLBACK_CONDICIONES}
            value={form.condicionesComercialesDefault ?? ''}
            onChange={(e) => setCampo('condicionesComercialesDefault', e.target.value)}
          />
        </Campo>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
          className="px-4 py-2.5 rounded-xl bg-[#E34A26] text-white text-xs font-bold flex items-center gap-2 hover:bg-[#c93f1e] transition-colors disabled:opacity-50"
        >
          {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Guardar
        </button>
        {mutation.isSuccess && <span className="text-xs text-emerald-600 font-semibold">Guardado.</span>}
        {mutation.isError && <span className="text-xs text-red-600 font-semibold">No se pudo guardar -- reintentá.</span>}
      </div>
    </div>
  );
};
