/**
 * IMEI: 15 dígitos, el último es de control (algoritmo de Luhn).
 *
 * El control importa porque la caja de un celular trae varios códigos de barras
 * (EAN, serial, IMEI 1 y 2): un número que no lo cumple no es un IMEI, y así se
 * descarta el código equivocado o un dígito mal leído.
 */

/** Deja solo los dígitos: el IMEI suele venir impreso con espacios o barras. */
export function normalizarImei(valor: string): string {
  return valor.replace(/\D/g, '');
}

export function esImeiValido(imei: string): boolean {
  if (!/^\d{15}$/.test(imei)) return false;
  let suma = 0;
  for (let i = 0; i < 15; i++) {
    let digito = Number(imei[i]);
    // De izquierda a derecha, se duplica uno sí y uno no empezando por el segundo.
    if (i % 2 === 1) {
      digito *= 2;
      if (digito > 9) digito -= 9;
    }
    suma += digito;
  }
  return suma % 10 === 0;
}
