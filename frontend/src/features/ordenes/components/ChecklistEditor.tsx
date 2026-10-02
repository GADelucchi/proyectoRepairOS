import { useState } from 'react';
import { Button, Form, InputGroup, Table } from 'react-bootstrap';
import { ChequeoItem, OPCIONES_POR_DEFECTO } from '../checklist';

interface ChecklistEditorProps {
  value: ChequeoItem[];
  onChange: (items: ChequeoItem[]) => void;
  disabled?: boolean;
  /** Oculta el campo para sumar ítems sueltos (útil al editar una orden ya creada). */
  permitirAgregar?: boolean;
}

/**
 * Checklist de recepción.
 *
 * Cada ítem ofrece las opciones que se configuraron para ese tipo de equipo, no
 * un Sí/No/N/A fijo: es lo que hace que las opciones definidas en Configuración
 * sirvan para algo.
 */
export function ChecklistEditor({ value, onChange, disabled, permitirAgregar = true }: ChecklistEditorProps) {
  const [nuevoItem, setNuevoItem] = useState('');

  function agregar() {
    const nombre = nuevoItem.trim();
    if (!nombre) return;
    onChange([
      ...value,
      { item: nombre, resultado: null, opciones: OPCIONES_POR_DEFECTO, orden: value.length }
    ]);
    setNuevoItem('');
  }

  function actualizarResultado(index: number, resultado: string) {
    onChange(
      value.map((c, i) =>
        // Volver a tocar la opción elegida la deselecciona.
        i === index ? { ...c, resultado: c.resultado === resultado ? null : resultado } : c
      )
    );
  }

  function eliminar(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  return (
    <div>
      {permitirAgregar && (
        <InputGroup className="mb-2">
          <Form.Control
            placeholder='Agregar chequeo suelto (ej: "Trae cargador")'
            value={nuevoItem}
            disabled={disabled}
            onChange={(e) => setNuevoItem(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                agregar();
              }
            }}
          />
          <Button variant="outline-primary" onClick={agregar} disabled={disabled} type="button">
            Agregar
          </Button>
        </InputGroup>
      )}

      {value.length > 0 && (
        <Table size="sm" bordered responsive>
          <thead>
            <tr>
              <th>Ítem</th>
              <th style={{ minWidth: 240 }}>Resultado</th>
              <th style={{ width: 60 }}></th>
            </tr>
          </thead>
          <tbody>
            {value.map((c, index) => {
              const opciones = c.opciones?.length ? c.opciones : OPCIONES_POR_DEFECTO;
              return (
                <tr key={`${c.item}-${index}`}>
                  <td>{c.item}</td>
                  <td>
                    <div className="d-flex flex-wrap gap-1">
                      {opciones.map((opcion) => (
                        <Button
                          key={opcion.etiqueta}
                          size="sm"
                          variant={c.resultado === opcion.etiqueta ? 'primary' : 'outline-primary'}
                          onClick={() => actualizarResultado(index, opcion.etiqueta)}
                          disabled={disabled}
                          type="button"
                        >
                          {opcion.etiqueta}
                        </Button>
                      ))}
                    </div>
                  </td>
                  <td>
                    <Button
                      variant="outline-danger"
                      size="sm"
                      onClick={() => eliminar(index)}
                      disabled={disabled}
                      type="button"
                      aria-label={`Quitar ${c.item}`}
                    >
                      ✕
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
    </div>
  );
}
