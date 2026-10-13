import { useState } from 'react';
import { convertirAFormatoBackend, convertirDesdeBackend } from '@/shared/utils/fechas';
import { DateInput } from './DateInput';

interface FechaFiltroProps {
  /** Fecha `YYYY-MM-DD`. */
  value: string;
  onChange: (fechaISO: string) => void;
  label: string;
}

/**
 * Fecha de un filtro, siempre en DD/MM/AAAA. El `type="date"` del navegador
 * muestra el formato del sistema operativo (MM/DD/AAAA en una Mac en inglés).
 *
 * Trabaja en `YYYY-MM-DD` y solo avisa fechas completas y válidas: mientras se
 * tipea, el filtro no cambia.
 */
export function FechaFiltro({ value, onChange, label }: FechaFiltroProps) {
  const [texto, setTexto] = useState(() => convertirDesdeBackend(value));
  const [valorPrevio, setValorPrevio] = useState(value);

  // Si la fecha cambia desde afuera (un atajo de período), se muestra la nueva.
  if (value !== valorPrevio) {
    setValorPrevio(value);
    setTexto(convertirDesdeBackend(value));
  }

  function cambiar(nuevoTexto: string) {
    setTexto(nuevoTexto);
    const fechaISO = convertirAFormatoBackend(nuevoTexto);
    if (fechaISO && fechaISO !== value) onChange(fechaISO);
  }

  return <DateInput label={label} value={texto} onChange={cambiar} />;
}
