import React, { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Save } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Seccion } from '../../components/ui/Seccion';
import { Cargando } from '../../components/ui/Estados';
import { getConfiguracionEmpresa, updateConfiguracionEmpresa } from '../../api/client';
import type { ConfiguracionEmpresa } from '../../types';

export const PresupuestoConfigPanel: React.FC = () => {
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

  if (isLoading) return <Cargando />;

  const campos: [keyof ConfiguracionEmpresa, string, string][] = [
    ['footerWebUrl', 'Sitio web (URL)', 'https://www.mtw.cl'],
    ['footerWebLabel', 'Sitio web (texto a mostrar)', 'www.mtw.cl'],
    ['footerInstagramUrl', 'Instagram (URL)', 'https://instagram.com/mtwchile'],
    ['footerInstagramHandle', 'Instagram (@handle a mostrar)', '@MTWChile'],
  ];

  return (
    <Seccion
      titulo="Redes sociales del pie de los PDF"
      descripcion="Los textos de presentación y condiciones comerciales se configuran por tipo de proyecto en Comercial › Plantillas de textos."
      acciones={
        <>
          {mutation.isSuccess && <span className="text-xs text-emerald-600 font-semibold">Guardado.</span>}
          <Button size="sm" leftIcon={<Save className="w-3.5 h-3.5" />} isLoading={mutation.isPending} onClick={() => mutation.mutate()}>
            Guardar
          </Button>
        </>
      }
    >
      <div className="grid sm:grid-cols-2 gap-4">
        {campos.map(([campo, label, placeholder]) => (
          <Input key={campo} label={label} placeholder={placeholder} value={(form[campo] as string | null | undefined) ?? ''} onChange={(e) => setCampo(campo, e.target.value)} />
        ))}
      </div>
    </Seccion>
  );
};
