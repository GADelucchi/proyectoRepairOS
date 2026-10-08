import type { UsoDelPlan } from '@/shared/types';

/** Si el plan ya no admite otro usuario o sucursal activa. */
export function planLleno(uso: UsoDelPlan | null | undefined, recurso: keyof UsoDelPlan): boolean {
  const r = uso?.[recurso];
  return !!r && r.maximo !== null && r.usados >= r.maximo;
}
