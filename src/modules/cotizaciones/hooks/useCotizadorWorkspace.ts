import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getProyectoById,
  updateVersionConfig,
  triggerManualSync,
  updateProyectoCliente,
  updateCodigoInterno,
  getClientes,
  createCliente,
  setVersionActiva,
  updateEstadoAprobacion,
} from '../../../api/client';
import type { ProyectoVersion, Cliente } from '../../../types';

export interface NuevoClienteForm {
  nombre: string;
  rut: string;
  giro: string;
  direccion: string;
  localidad: string;
  contacto: string;
  telefono: string;
  email: string;
}

const initialNuevoCliente: NuevoClienteForm = {
  nombre: '',
  rut: '',
  giro: '',
  direccion: '',
  localidad: '',
  contacto: '',
  telefono: '',
  email: '',
};

export function useCotizadorWorkspace(proyectoId: string) {
  const queryClient = useQueryClient();
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [selectedVersionIdx, setSelectedVersionIdx] = useState(0);
  const [showReimportModal, setShowReimportModal] = useState(false);

  // Form State para Divisas (Paso 1)
  const [dolar, setDolar] = useState<string>('950');
  const [uf, setUf] = useState<string>('38500');
  const [euro, setEuro] = useState<string>('1030');
  const [saveSuccess, setSaveSuccess] = useState(false);

  // UI State para Gestión de Clientes (Paso 1)
  const [clientMode, setClientMode] = useState<'view' | 'select' | 'create'>('view');
  const [searchClientTerm, setSearchClientTerm] = useState('');
  const [nuevoCliente, setNuevoCliente] = useState<NuevoClienteForm>(initialNuevoCliente);

  // Queries
  // Se usa isPending (no isLoading) para que el workspace no se resetee durante
  // refetches silenciosos provocados por invalidateQueries (ej. al guardar una
  // corrección de geometría). isPending es true solo en la carga inicial cuando
  // no hay datos en caché; en refetches posteriores el dato previo sigue visible.
  const { data: proyecto, isPending: isLoading, isError } = useQuery({
    queryKey: ['proyectoDetail', proyectoId],
    queryFn: () => getProyectoById(proyectoId),
    enabled: !!proyectoId,
  });

  const { data: clientesData } = useQuery({
    queryKey: ['clientesMaster'],
    queryFn: () => getClientes(),
  });

  const masterClientes: Cliente[] = clientesData?.data || [];

  const activeVersion: ProyectoVersion | undefined =
    proyecto?.versiones[selectedVersionIdx] || proyecto?.versiones[0];

  // Al entrar al proyecto, parte de la version que quedo guardada como
  // activa (no de la de versionNumero mas alto) - HETMO puede tener
  // versiones mas nuevas que la que en realidad se esta cotizando. Solo
  // corre al cambiar de proyecto, no en cada refetch, para no pisar una
  // seleccion que el usuario acaba de hacer en esta misma sesion.
  useEffect(() => {
    if (!proyecto) return;
    if (proyecto.versionActivaHetmoId == null) return;
    const idx = proyecto.versiones.findIndex((v) => v.hetmoId === proyecto.versionActivaHetmoId);
    if (idx >= 0) setSelectedVersionIdx(idx);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proyecto?.id]);

  // Mutación para elegir/guardar que version de HETMO se cotiza
  const setVersionActivaMutation = useMutation({
    mutationFn: async (hetmoId: number) => setVersionActiva(proyectoId, hetmoId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proyectoDetail', proyectoId] });
      queryClient.invalidateQueries({ queryKey: ['proyectos'] });
    },
  });

  // Mutación para el numero de presupuesto INTERNO de MTW (distinto al de
  // HETMO) -- formato "numero-version", ver codigoInternoMutation.mutate
  // en handleGuardarNumeroInterno/handleSelectVersion.
  const codigoInternoMutation = useMutation({
    mutationFn: async (codigoInterno: string | null) => updateCodigoInterno(proyectoId, codigoInterno),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proyectoDetail', proyectoId] });
      queryClient.invalidateQueries({ queryKey: ['proyectos'] });
    },
  });

  // El "numero" que la persona escribe es solo la mitad de codigoInterno --
  // la otra mitad (versionNumero de HETMO) se recompone siempre al vuelo,
  // nunca queda guardada aparte, así que si más adelante cambia la version
  // activa (handleSelectVersion) el codigo sigue correcto sin que nadie
  // tenga que volver a escribirlo.
  const numeroInterno = (proyecto?.codigoInterno || '').split('-').slice(0, -1).join('-') || (proyecto?.codigoInterno ?? '');
  const handleGuardarNumeroInterno = (numero: string) => {
    const limpio = numero.trim();
    if (!limpio) {
      codigoInternoMutation.mutate(null);
      return;
    }
    codigoInternoMutation.mutate(activeVersion ? `${limpio}-${activeVersion.versionNumero}` : limpio);
  };

  const handleSelectVersion = (index: number) => {
    setSelectedVersionIdx(index);
    const version = proyecto?.versiones[index];
    if (version) setVersionActivaMutation.mutate(version.hetmoId);
    // Si ya hay un numero interno guardado, se recompone con la version
    // nueva para que el codigo no quede apuntando a una revision vieja.
    if (version && numeroInterno) {
      codigoInternoMutation.mutate(`${numeroInterno}-${version.versionNumero}`);
    }
  };

  // "Crear Nueva Versión Interna" (Paso 5, solo con APROBADO_GERENCIA): a
  // diferencia de handleSelectVersion, el hetmoId elegido puede no estar
  // todavia en proyecto.versiones -- setVersionActiva lo trae de HETMO en
  // el momento. Por eso el indice recien se puede resolver despues de
  // refrescar el proyecto, no antes como en handleSelectVersion.
  const handleCrearVersionInterna = async (hetmoId: number) => {
    await setVersionActivaMutation.mutateAsync(hetmoId);
    const actualizado = await queryClient.fetchQuery({
      queryKey: ['proyectoDetail', proyectoId],
      queryFn: () => getProyectoById(proyectoId),
    });
    const idx = actualizado?.versiones.findIndex((v) => v.hetmoId === hetmoId) ?? -1;
    if (idx >= 0) setSelectedVersionIdx(idx);
  };

  useEffect(() => {
    if (activeVersion) {
      setDolar(activeVersion.tipoCambioDolar ? String(activeVersion.tipoCambioDolar) : '950');
      setUf(activeVersion.tipoCambioUF ? String(activeVersion.tipoCambioUF) : '38500');
      setEuro(activeVersion.tipoCambioEuro ? String(activeVersion.tipoCambioEuro) : '1030');
    }
  }, [activeVersion]);

  useEffect(() => {
    if (proyecto) {
      if (proyecto.cliente) {
        setClientMode('view');
      } else {
        // Precargar formulario de creación con los datos crudos de HETMO como sugerencia
        setNuevoCliente((prev) => ({
          ...prev,
          nombre: proyecto.clienteNombreRaw || '',
          rut: proyecto.clienteRutRaw || '',
          direccion: proyecto.clienteDireccionRaw || '',
          localidad: proyecto.clienteLocalidadRaw || '',
        }));
      }
    }
  }, [proyecto]);

  // ['proyectos'] (CotizacionesPage.tsx) sólo muestra codigoInterno, los
  // datos crudos de cliente (clienteNombreRaw/RutRaw/DireccionRaw -- del
  // import de HETMO, no del Cliente vinculado del maestro) y el estadoGlosa
  // de la última versión importada. Vincular/crear cliente, guardar divisas
  // y cambiar el estado comercial interno no tocan nada de eso, así que
  // invalidarlo ahí sólo generaba un refetch de red de hasta 100 proyectos
  // en cada guardado sin que la lista fuese a mostrar algo distinto.

  // Mutación para vincular o desvincular un cliente existente del maestro
  const vincularClienteMutation = useMutation({
    mutationFn: async (clienteId: string | null) => {
      return updateProyectoCliente(proyectoId, clienteId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proyectoDetail', proyectoId] });
      setClientMode('view');
    },
  });

  // Mutación para crear nuevo cliente en el maestro y vincularlo al proyecto
  const crearClienteMutation = useMutation({
    mutationFn: async () => {
      const resp = await createCliente({
        nombre: nuevoCliente.nombre,
        rut: nuevoCliente.rut || null,
        giro: nuevoCliente.giro || null,
        direccion: nuevoCliente.direccion || null,
        localidad: nuevoCliente.localidad || null,
        contacto: nuevoCliente.contacto || null,
        telefono: nuevoCliente.telefono || null,
        email: nuevoCliente.email || null,
      });
      if (resp.data?.id) {
        await updateProyectoCliente(proyectoId, resp.data.id);
      }
      return resp.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proyectoDetail', proyectoId] });
      queryClient.invalidateQueries({ queryKey: ['clientesMaster'] });
      setClientMode('view');
    },
  });

  // Mutación para guardar divisas
  const updateConfigMutation = useMutation({
    mutationFn: async () => {
      if (!activeVersion) return;
      return updateVersionConfig(activeVersion.id, {
        tipoCambioDolar: dolar ? Number(dolar) : null,
        tipoCambioUF: uf ? Number(uf) : null,
        tipoCambioEuro: euro ? Number(euro) : null,
        estadoAprobacion: activeVersion.estadoAprobacion === 'BORRADOR' ? 'EN_COTIZACION' : activeVersion.estadoAprobacion,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proyectoDetail', proyectoId] });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    },
  });

  // Mutación para avanzar/retroceder el estado comercial interno
  // (independiente del estado del documento en HETMO)
  const estadoAprobacionMutation = useMutation({
    mutationFn: async (estado: 'EN_COTIZACION' | 'ESPERANDO_APROBACION_COMERCIAL' | 'APROBADO_GERENCIA' | 'ACEPTADO_CLIENTE') => {
      if (!activeVersion) return;
      return updateEstadoAprobacion(activeVersion.id, estado);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proyectoDetail', proyectoId] });
    },
  });

  // Mutación para reimportar desde HETMO
  const reimportMutation = useMutation({
    mutationFn: async () => triggerManualSync(true),
    onSuccess: () => {
      setShowReimportModal(false);
      queryClient.invalidateQueries({ queryKey: ['proyectoDetail', proyectoId] });
      queryClient.invalidateQueries({ queryKey: ['proyectos'] });
    },
  });

  // Filtrar clientes del maestro en el buscador
  const filteredMasterClientes = masterClientes.filter((c) => {
    const term = searchClientTerm.toLowerCase().trim();
    if (!term) return true;
    return c.nombre.toLowerCase().includes(term) || (c.rut && c.rut.toLowerCase().includes(term));
  });

  const handleSaveAndAdvance = () => {
    updateConfigMutation.mutate();
    setCurrentStep(2);
  };

  const updateNuevoClienteField = (field: keyof NuevoClienteForm, value: string) => {
    setNuevoCliente((prev) => ({ ...prev, [field]: value }));
  };

  return {
    proyecto,
    isLoading,
    isError,
    activeVersion,
    currentStep,
    setCurrentStep,
    selectedVersionIdx,
    setSelectedVersionIdx,
    handleSelectVersion,
    setVersionActivaMutation,
    numeroInterno,
    handleGuardarNumeroInterno,
    codigoInternoMutation,
    estadoAprobacionMutation,
    handleCrearVersionInterna,
    showReimportModal,
    setShowReimportModal,
    // Divisas
    dolar,
    setDolar,
    uf,
    setUf,
    euro,
    setEuro,
    saveSuccess,
    updateConfigMutation,
    handleSaveAndAdvance,
    // Cliente
    clientMode,
    setClientMode,
    searchClientTerm,
    setSearchClientTerm,
    filteredMasterClientes,
    nuevoCliente,
    updateNuevoClienteField,
    vincularClienteMutation,
    crearClienteMutation,
    // Reimportar
    reimportMutation,
  };
}
