export interface ServiceCategoryPreset {
  id: string
  nome: string
}

export const SERVICE_CATEGORY_PRESETS: ServiceCategoryPreset[] = [
  { id: "pintura-interna", nome: "Pintura Interna" },
  { id: "pintura-externa", nome: "Pintura Externa" },
  { id: "preparacao-superficie", nome: "Preparacao de Superficie" },
  { id: "acabamentos", nome: "Acabamentos" },
  { id: "impermeabilizacao", nome: "Impermeabilizacao" },
  { id: "manutencao", nome: "Manutencao" },
  { id: "limpeza-tecnica", nome: "Limpeza Tecnica" },
  { id: "transporte-logistica", nome: "Transporte e Logistica" },
  { id: "outros", nome: "Outros" },
]

export function getServiceCategoryName(categoriaId?: string, categoriaNome?: string): string {
  if (categoriaNome?.trim()) return categoriaNome.trim()
  const found = SERVICE_CATEGORY_PRESETS.find((item) => item.id === categoriaId)
  return found?.nome || "Sem categoria"
}
