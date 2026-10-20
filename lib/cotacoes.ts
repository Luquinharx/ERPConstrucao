import type { Cotacao } from "@/lib/types"
import { round2 } from "@/lib/utils"

/** Total de um fornecedor numa cotacao (so os itens a que respondeu). */
export function totalFornecedor(c: Cotacao, fornecedorId: string): number {
  const f = c.fornecedores.find((x) => x.id === fornecedorId)
  if (!f) return 0
  return round2(c.itens.reduce((s, i) => s + (Number(f.precos[i.id]) || 0) * (Number(i.quantidade) || 0), 0))
}

/** Fornecedor mais barato que respondeu a todos os itens. */
export function maisBarato(c: Cotacao): string | undefined {
  const completos = c.fornecedores.filter((f) => c.itens.every((i) => (Number(f.precos[i.id]) || 0) > 0))
  return completos.sort((a, b) => totalFornecedor(c, a.id) - totalFornecedor(c, b.id))[0]?.id
}
