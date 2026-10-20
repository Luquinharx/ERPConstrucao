import type { Material } from "@/lib/types"

/**
 * Codigo das etiquetas proprias: um prefixo que nao se confunde com codigos
 * de barras de fabrica, mais o id do produto (que nunca muda).
 */
const PREFIXO = "ERP:P:"

export function codigoEtiqueta(produtoId: string): string {
  return `${PREFIXO}${produtoId}`
}

/**
 * Encontra o produto de um codigo lido: a nossa etiqueta (QR), o codigo de
 * barras de fabrica (EAN) ou o codigo interno escrito a mao.
 */
export function produtoDoCodigo(codigo: string, produtos: Material[]): Material | undefined {
  const lido = codigo.trim()
  if (!lido) return undefined
  if (lido.startsWith(PREFIXO)) return produtos.find((p) => p.id === lido.slice(PREFIXO.length))
  const igual = (a?: string) => !!a && a.trim().toLowerCase() === lido.toLowerCase()
  return produtos.find((p) => igual(p.codigoBarras)) || produtos.find((p) => igual(p.codigo))
}
