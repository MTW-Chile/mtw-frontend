import React, { useRef } from 'react';
import { Camera, Paperclip } from 'lucide-react';
import { Button } from '../../../../components/ui/Button';
import { mostrarToast } from '../../../../lib/toast';
import { ACCEPT_ADJUNTOS, mimeDeArchivo, problemaAlElegir } from './utils';

interface Props {
  onArchivos: (archivos: File[]) => void;
  disabled?: boolean;
}

// "Tomar foto" abre la camara directamente en celulares y tablets (capture);
// "Adjuntar archivo" abre el selector (fotos de la galeria, PDF, Office). En un
// computador ambos abren el selector de archivos. Los archivos que no sirven se
// descartan con un aviso: el resto sigue.
export const BotonesAdjuntar: React.FC<Props> = ({ onArchivos, disabled }) => {
  const camara = useRef<HTMLInputElement>(null);
  const archivos = useRef<HTMLInputElement>(null);

  const recibir = (e: React.ChangeEvent<HTMLInputElement>) => {
    const elegidos = Array.from(e.target.files ?? []);
    e.target.value = ''; // permite volver a elegir el mismo archivo
    const buenos: File[] = [];
    for (const f of elegidos) {
      const problema = problemaAlElegir(f.name, mimeDeArchivo(f.name, f.type), f.size);
      if (problema) mostrarToast(problema, { tipo: 'info' });
      else buenos.push(f);
    }
    if (buenos.length) onArchivos(buenos);
  };

  return (
    <div className="flex flex-wrap gap-2">
      <input ref={camara} type="file" accept="image/*" capture="environment" className="hidden" onChange={recibir} aria-label="Tomar foto" data-testid="adjunto-camara" />
      <input ref={archivos} type="file" accept={ACCEPT_ADJUNTOS} multiple className="hidden" onChange={recibir} aria-label="Elegir archivos" data-testid="adjunto-archivos" />
      <Button type="button" size="sm" variant="outline" leftIcon={<Camera className="w-3.5 h-3.5" />} disabled={disabled} onClick={() => camara.current?.click()}>
        Tomar foto
      </Button>
      <Button type="button" size="sm" variant="outline" leftIcon={<Paperclip className="w-3.5 h-3.5" />} disabled={disabled} onClick={() => archivos.current?.click()}>
        Adjuntar archivo
      </Button>
    </div>
  );
};
