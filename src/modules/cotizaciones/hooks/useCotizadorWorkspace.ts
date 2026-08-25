import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  getProyectoById, 
  updateVersionConfig, 
  triggerManualSync, 
  updateProyectoCliente, 
  getClientes, 
  createCliente 
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
  const { data: proyecto, isLoading, isError } = useQuery({
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

  // Mutación para vincular o desvincular un cliente existente del maestro
  const vincularClienteMutation = useMutation({
    mutationFn: async (clienteId: string | null) => {
      return updateProyectoCliente(proyectoId, clienteId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proyectoDetail', proyectoId] });
      queryClient.invalidateQueries({ queryKey: ['proyectos'] });
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
      queryClient.invalidateQueries({ queryKey: ['proyectos'] });
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
      queryClient.invalidateQueries({ queryKey: ['proyectos'] });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
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
