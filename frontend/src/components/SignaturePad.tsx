import { useEffect, useRef, useState } from 'react';
import { Button, Stack } from 'react-bootstrap';

interface SignaturePadProps {
  onGuardar: (dataUrl: string) => void;
  disabled?: boolean;
}

/** Componente simple de firma manuscrita sobre un canvas (mouse, lápiz o dedo). */
export function SignaturePad({ onGuardar, disabled }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dibujando = useRef(false);
  const [vacio, setVacio] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
  }, []);

  function getPos(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height
    };
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (disabled) return;
    dibujando.current = true;
    const ctx = canvasRef.current!.getContext('2d')!;
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!dibujando.current || disabled) return;
    const ctx = canvasRef.current!.getContext('2d')!;
    const { x, y } = getPos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    setVacio(false);
  }

  function handlePointerUp() {
    dibujando.current = false;
  }

  function limpiar() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setVacio(true);
  }

  function guardar() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    onGuardar(canvas.toDataURL('image/png'));
  }

  return (
    <Stack gap={2}>
      <canvas
        ref={canvasRef}
        width={500}
        height={200}
        style={{
          border: '1px solid #ced4da',
          borderRadius: 4,
          touchAction: 'none',
          width: '100%',
          maxWidth: 500
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      />
      <Stack direction="horizontal" gap={2}>
        <Button variant="outline-secondary" size="sm" onClick={limpiar} disabled={disabled}>
          Limpiar
        </Button>
        <Button variant="primary" size="sm" onClick={guardar} disabled={disabled || vacio}>
          Guardar firma
        </Button>
      </Stack>
    </Stack>
  );
}
