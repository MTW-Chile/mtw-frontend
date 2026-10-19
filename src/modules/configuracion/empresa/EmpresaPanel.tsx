import React, { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ImageUp, Save, Trash2 } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Seccion } from '../../../components/ui/Seccion';
import { Cargando } from '../../../components/ui/Estados';
import { InputArchivo } from '../../../components/ui/InputArchivo';
import { useConfirmar } from '../../../components/ui/Confirmar';
import { getConfiguracionEmpresa, getLogoEmpresa, quitarLogoEmpresa, subirLogoEmpresa, updateConfiguracionEmpresa } from '../../../api/client';
import { mostrarToast } from '../../../lib/toast';
import type { ConfiguracionEmpresa } from '../../../types';

const MAXIMO_LOGO = 1024 * 1024;

/** Configuración › Configuración de Empresa: datos de la empresa y logo de los documentos. */
export const EmpresaPanel: React.FC<{ puedeEditar: boolean }> = ({ puedeEditar }) => {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['configuracionEmpresa'], queryFn: getConfiguracionEmpresa });
  const config = data?.configuracionEmpresa;

  const [form, setForm] = useState<Partial<ConfiguracionEmpresa>>({});
  // Solo la primera carga pisa el formulario: un refetch en segundo plano no borra lo que se está escribiendo.
  useEffect(() => {
    if (config) setForm(config);
  }, [config?.id]);

  const actualizarCache = (res: { configuracionEmpresa: ConfiguracionEmpresa }) =>
    queryClient.setQueryData(['configuracionEmpresa'], { success: true, configuracionEmpresa: res.configuracionEmpresa });

  const guardar = useMutation({
    mutationFn: () =>
      updateConfiguracionEmpresa({
        footerWebUrl: form.footerWebUrl ?? null,
        footerWebLabel: form.footerWebLabel ?? null,
        footerInstagramUrl: form.footerInstagramUrl ?? null,
        footerInstagramHandle: form.footerInstagramHandle ?? null,
      }),
    onSuccess: (res) => {
      actualizarCache(res);
      mostrarToast('Datos de la empresa guardados.', { tipo: 'info' });
    },
  });

  const setCampo = (campo: keyof ConfiguracionEmpresa, valor: string) => setForm((f) => ({ ...f, [campo]: valor }));

  if (isLoading) return <Cargando />;

  const campos: [keyof ConfiguracionEmpresa, string, string][] = [
    ['footerWebUrl', 'Sitio web (URL)', 'https://www.mtw.cl'],
    ['footerWebLabel', 'Sitio web (texto a mostrar)', 'www.mtw.cl'],
    ['footerInstagramUrl', 'Instagram (URL)', 'https://instagram.com/mtwchile'],
    ['footerInstagramHandle', 'Instagram (@usuario a mostrar)', '@MTWChile'],
  ];

  return (
    <div className="space-y-6">
      <Seccion
        titulo="Datos de la empresa"
        descripcion="Sitio web y redes de la empresa. Hoy aparecen en el pie de los presupuestos; los textos de presentación y condiciones se configuran en Comercial › Plantillas de textos."
        acciones={
          puedeEditar && (
            <Button size="sm" leftIcon={<Save className="w-3.5 h-3.5" />} isLoading={guardar.isPending} onClick={() => guardar.mutate()}>
              Guardar
            </Button>
          )
        }
      >
        <div className="grid sm:grid-cols-2 gap-4">
          {campos.map(([campo, label, placeholder]) => (
            <Input
              key={campo}
              label={label}
              placeholder={placeholder}
              disabled={!puedeEditar}
              value={(form[campo] as string | null | undefined) ?? ''}
              onChange={(e) => setCampo(campo, e.target.value)}
            />
          ))}
        </div>
      </Seccion>

      {config && <LogoEmpresa config={config} puedeEditar={puedeEditar} onCambio={actualizarCache} />}
    </div>
  );
};

const LogoEmpresa: React.FC<{
  config: ConfiguracionEmpresa;
  puedeEditar: boolean;
  onCambio: (res: { configuracionEmpresa: ConfiguracionEmpresa }) => void;
}> = ({ config, puedeEditar, onCambio }) => {
  const queryClient = useQueryClient();
  const { confirmar } = useConfirmar();
  const { data: logo } = useQuery({
    queryKey: ['logoEmpresa', config.logoActualizadoEn],
    queryFn: getLogoEmpresa,
    enabled: config.tieneLogo,
  });

  const alCambiar = (res: { configuracionEmpresa: ConfiguracionEmpresa }) => {
    onCambio(res);
    queryClient.invalidateQueries({ queryKey: ['logoEmpresa'] });
  };
  const subir = useMutation({
    mutationFn: subirLogoEmpresa,
    onSuccess: (res) => {
      alCambiar(res);
      mostrarToast('Logo actualizado.', { tipo: 'info' });
    },
  });
  const quitar = useMutation({ mutationFn: quitarLogoEmpresa, onSuccess: alCambiar });

  const elegir = (archivos: File[]) => {
    const archivo = archivos[0];
    if (!['image/png', 'image/jpeg'].includes(archivo.type)) return mostrarToast('El logo debe ser una imagen PNG o JPG.');
    if (archivo.size > MAXIMO_LOGO) return mostrarToast('El logo debe pesar menos de 1 MB.');
    subir.mutate(archivo);
  };

  const pedirQuitar = async () => {
    if (await confirmar({ titulo: '¿Quitar el logo de la empresa?', mensaje: 'Los documentos vuelven a usar el logo de MTW.', confirmar: 'Quitar', peligro: true })) quitar.mutate();
  };

  return (
    <Seccion
      titulo="Logo"
      descripcion="Aparece en los PDF: presupuestos, Hoja de Fijación, órdenes de compra y adicionales. PNG o JPG de hasta 1 MB; mejor con fondo transparente."
      acciones={
        puedeEditar && (
          <>
            {config.tieneLogo && (
              <Button size="sm" variant="ghost" leftIcon={<Trash2 className="w-3.5 h-3.5" />} isLoading={quitar.isPending} onClick={pedirQuitar}>
                Quitar
              </Button>
            )}
            <InputArchivo accept="image/png,image/jpeg" etiqueta="Elegir logo" onArchivos={elegir}>
              {(abrir) => (
                <Button size="sm" variant="outline" leftIcon={<ImageUp className="w-3.5 h-3.5" />} isLoading={subir.isPending} onClick={abrir}>
                  {config.tieneLogo ? 'Reemplazar logo' : 'Subir logo'}
                </Button>
              )}
            </InputArchivo>
          </>
        )
      }
    >
      <div className="flex items-center gap-4">
        <div className="w-48 h-24 rounded-xl border border-dashed border-slate-300 bg-slate-50 flex items-center justify-center p-3">
          <img src={config.tieneLogo ? (logo ?? undefined) : `${import.meta.env.BASE_URL}mtw-logo.png`} alt="Logo de la empresa" className="max-w-full max-h-full object-contain" />
        </div>
        <p className="text-xs text-slate-500">{config.tieneLogo ? 'Logo propio de la empresa.' : 'Sin logo propio: los documentos usan el de MTW.'}</p>
      </div>
    </Seccion>
  );
};
