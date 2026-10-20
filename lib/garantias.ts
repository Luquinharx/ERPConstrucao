import { diasAte } from "@/lib/obra"
import type { Garantia } from "@/lib/types"

/** Fim da garantia (ISO): data de entrega + anos. */
export function fimGarantia(g: Pick<Garantia, "dataEntrega" | "anos">): string {
  const [a, m, d] = g.dataEntrega.split("-").map(Number)
  const fim = new Date(a + (Number(g.anos) || 0), m - 1, d)
  return `${fim.getFullYear()}-${String(fim.getMonth() + 1).padStart(2, "0")}-${String(fim.getDate()).padStart(2, "0")}`
}

export type EstadoGarantia = "em_garantia" | "a_expirar" | "expirada"

/** A expirar = faltam 90 dias ou menos. */
export function estadoGarantia(g: Pick<Garantia, "dataEntrega" | "anos">): EstadoGarantia {
  const dias = diasAte(fimGarantia(g))
  if (dias < 0) return "expirada"
  if (dias <= 90) return "a_expirar"
  return "em_garantia"
}

export const ESTADOS_GARANTIA: Record<EstadoGarantia, { nome: string; cor: string }> = {
  em_garantia: { nome: "Em garantia", cor: "border-emerald-500/40 text-emerald-700" },
  a_expirar: { nome: "A expirar", cor: "border-amber-500/40 text-amber-700" },
  expirada: { nome: "Expirada", cor: "border-slate-500/40 text-slate-600" },
}
