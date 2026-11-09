/**
 * IDIOMAS DO SISTEMA: Português (Portugal), Português (Brasil) e English.
 *
 * O texto de origem no código é sempre o português de Portugal, já com a
 * ortografia correta. É ele a chave do dicionário:
 *
 *   t("Guardar")                       -> "Guardar" | "Salvar" | "Save"
 *   t("Olá, {nome}", { nome: "Ana" })  -> "Olá, Ana" | ... | "Hello, Ana"
 *
 * Textos definidos em constantes (rótulos de tabelas, listas de opções) marcam-se
 * com m("..."), que devolve o próprio texto, e traduzem-se onde aparecem com
 * t(valor). Assim nada fica preso no idioma em que o módulo foi carregado.
 *
 * O teste scripts/verificar-traducoes.ts confirma que cada t("...") e m("...")
 * tem tradução nos três idiomas: não pode faltar nenhuma.
 */
import { TEXTOS } from "./textos"

export type Idioma = "pt-PT" | "pt-BR" | "en"

export const IDIOMAS: Array<{ id: Idioma; nome: string; curto: string; bandeira: string }> = [
  { id: "pt-PT", nome: "Português (Portugal)", curto: "PT", bandeira: "🇵🇹" },
  { id: "pt-BR", nome: "Português (Brasil)", curto: "BR", bandeira: "🇧🇷" },
  { id: "en", nome: "English", curto: "EN", bandeira: "🌐" },
]

export const IDIOMA_PADRAO: Idioma = "pt-PT"
export const COOKIE_IDIOMA = "erp_idioma"

export function ehIdioma(valor: unknown): valor is Idioma {
  return valor === "pt-PT" || valor === "pt-BR" || valor === "en"
}

/** Idioma de um código do browser (navigator.language / Accept-Language). */
export function idiomaDoNavegador(codigo: string | null | undefined): Idioma {
  const c = (codigo || "").toLowerCase()
  if (c.startsWith("pt-br")) return "pt-BR"
  if (c.startsWith("pt")) return "pt-PT"
  if (c) return "en"
  return IDIOMA_PADRAO
}

let atual: Idioma = IDIOMA_PADRAO

export function idiomaAtual(): Idioma {
  return atual
}

/** Muda o idioma usado por t() e pelos formatos de número e data. */
export function definirIdiomaGlobal(idioma: Idioma): void {
  atual = idioma
}

/** Locale para Intl (números, moeda, datas). O inglês segue o formato internacional (dd/mm/aaaa). */
export function localeIntl(idioma: Idioma = atual): string {
  return idioma === "en" ? "en-GB" : idioma
}

function interpolar(texto: string, vars?: Record<string, string | number | null | undefined>): string {
  if (!vars) return texto
  return texto.replace(/\{(\w+)\}/g, (inteiro, nome) => (nome in vars ? String(vars[nome] ?? "") : inteiro))
}

/** Traduz um texto (escrito em português de Portugal) para o idioma atual. */
export function t(texto: string, vars?: Record<string, string | number | null | undefined>, idioma: Idioma = atual): string {
  if (idioma === "pt-PT") return interpolar(texto, vars)
  const entrada = TEXTOS[texto]
  const traduzido = entrada?.[idioma]
  if (traduzido === undefined && process.env.NODE_ENV !== "production") {
    console.warn(`[i18n] Sem tradução ${idioma}: ${JSON.stringify(texto)}`)
  }
  return interpolar(traduzido ?? texto, vars)
}

/** Marca um texto para tradução sem o traduzir já (usar em constantes). */
export function m<T extends string>(texto: T): T {
  return texto
}
