import React, { useImperativeHandle, useRef } from 'react';

/**
 * Elegir archivos con un botón propio (DESIGN.md 5): el <input type="file">
 * queda oculto. `children` recibe la función que lo abre; o se abre desde
 * afuera con la ref (ref.current.click()).
 *
 *   <InputArchivo accept=".pdf" onArchivos={subir}>
 *     {(abrir) => <Button onClick={abrir}>Subir PDF</Button>}
 *   </InputArchivo>
 */
export const InputArchivo = React.forwardRef<
  HTMLInputElement | null,
  {
    accept?: string;
    multiple?: boolean;
    /** Abre la cámara en móvil (fotos de obra). */
    capture?: 'environment' | 'user';
    onArchivos: (archivos: File[]) => void;
    /** Nombre accesible del selector. */
    etiqueta?: string;
    'data-testid'?: string;
    children?: (abrir: () => void) => React.ReactNode;
  }
>(({ accept, multiple, capture, onArchivos, etiqueta, children, ...rest }, ref) => {
  const interno = useRef<HTMLInputElement>(null);
  useImperativeHandle(ref, () => interno.current as HTMLInputElement);
  return (
    <>
      <input
        ref={interno}
        type="file"
        className="hidden"
        accept={accept}
        multiple={multiple}
        capture={capture}
        aria-label={etiqueta}
        data-testid={rest['data-testid']}
        onChange={(e) => {
          const archivos = Array.from(e.target.files ?? []);
          e.target.value = '';
          if (archivos.length) onArchivos(archivos);
        }}
      />
      {children?.(() => interno.current?.click())}
    </>
  );
});
InputArchivo.displayName = 'InputArchivo';
