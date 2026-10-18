import React, { useRef } from 'react';

/**
 * Elegir archivos con un botón propio (DESIGN.md 5): el <input type="file">
 * queda oculto y `children` recibe la función que lo abre.
 *
 *   <InputArchivo accept=".pdf" onArchivos={subir}>
 *     {(abrir) => <Button onClick={abrir}>Subir PDF</Button>}
 *   </InputArchivo>
 */
export const InputArchivo: React.FC<{
  accept?: string;
  multiple?: boolean;
  /** Abre la cámara en móvil (fotos de obra). */
  capture?: 'environment' | 'user';
  onArchivos: (archivos: File[]) => void;
  children: (abrir: () => void) => React.ReactNode;
}> = ({ accept, multiple, capture, onArchivos, children }) => {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={ref}
        type="file"
        className="hidden"
        accept={accept}
        multiple={multiple}
        capture={capture}
        onChange={(e) => {
          const archivos = Array.from(e.target.files ?? []);
          e.target.value = '';
          if (archivos.length) onArchivos(archivos);
        }}
      />
      {children(() => ref.current?.click())}
    </>
  );
};
