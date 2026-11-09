import { m, t } from "@/lib/i18n"

export interface ServiceCategoryPreset {
  id: string
  nome: string
}

export const SERVICE_CATEGORY_PRESETS: ServiceCategoryPreset[] = [
  { id: "pintura-interna", nome: m("Pintura Interior") },
  { id: "pintura-externa", nome: m("Pintura Exterior") },
  { id: "preparacao-superficie", nome: m("Preparação de Superfície") },
  { id: "acabamentos", nome: m("Acabamentos") },
  { id: "impermeabilizacao", nome: m("Impermeabilização") },
  { id: "manutencao", nome: m("Manutenção") },
  { id: "limpeza-tecnica", nome: m("Limpeza Técnica") },
  { id: "transporte-logistica", nome: m("Transporte e Logística") },
  // Escolher esta opção abre o campo para escrever o nome da categoria
  { id: "outros", nome: m("Outra categoria") },
]

export function getServiceCategoryName(categoriaId?: string, categoriaNome?: string): string {
  // Categoria predefinida: o nome segue o idioma (o nome gravado é só uma cópia)
  const found = SERVICE_CATEGORY_PRESETS.find((item) => item.id === categoriaId)
  if (found && found.id !== "outros") return t(found.nome)
  if (categoriaNome?.trim()) return categoriaNome.trim()
  return found ? t(found.nome) : t("Sem categoria")
}
