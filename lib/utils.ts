import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { idiomaAtual, localeIntl } from "./i18n"
import { ptBR, pt, enGB } from "date-fns/locale"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Arredonda para 2 casas decimais evitando erros de virgula flutuante
 * (ex.: 1.005 -> 1.01 em vez de 1.00).
 */
export function round2(value: number | string | null | undefined): number {
  const numeric = typeof value === "string" ? Number.parseFloat(value) : Number(value)
  if (!Number.isFinite(numeric)) return 0
  return Math.round((numeric + Number.EPSILON) * 100) / 100
}

/** Numero sempre com 2 casas decimais, como string (para inputs e documentos). */
export function toFixed2(value: number | string | null | undefined): string {
  return round2(value).toFixed(2)
}

/** Número no formato do idioma escolhido, sempre com 2 casas decimais (sem símbolo de moeda). */
export function formatNumber2(value: number | string | null | undefined): string {
  return new Intl.NumberFormat(localeIntl(), {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(round2(value))
}

/** Valor em euros, no formato do idioma escolhido (1 234,56 € · € 1.234,56 · €1,234.56). */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat(localeIntl(), {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(round2(value))
}

/** Normaliza texto para busca: minusculas e sem acentos. */
export function normalizeSearch(value: string | null | undefined): string {
  return (value || "")
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
}

/** Verifica se algum dos campos contem o termo pesquisado (ignorando acentos). */
export function matchesSearch(term: string, fields: Array<string | number | null | undefined>): boolean {
  const query = normalizeSearch(term)
  if (!query) return true
  return fields.some((field) => normalizeSearch(field?.toString()).includes(query))
}

export function formatDate(date: string | Date): string {
  // "2026-10-06" sozinho e lido como meia-noite UTC: a oeste de Greenwich
  // (ex.: Brasil) aparecia o dia anterior. Data sem hora = data local.
  const soData = typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)
  const d = soData ? new Date(`${date}T00:00:00`) : typeof date === "string" ? new Date(date) : date
  return d.toLocaleDateString(localeIntl())
}

/** Locale do date-fns para o idioma escolhido (format(data, "...", { locale: localeDateFns() })). */
export function localeDateFns() {
  const i = idiomaAtual()
  return i === "pt-BR" ? ptBR : i === "en" ? enGB : pt
}

/** Data e hora no formato do idioma escolhido. */
export function formatDateTime(date: Date, opcoes: Intl.DateTimeFormatOptions = { dateStyle: "short", timeStyle: "short" }): string {
  return new Intl.DateTimeFormat(localeIntl(), opcoes).format(date)
}

export function generateUniqueId(): string {
  return Math.random().toString(36).substr(2, 9)
}

/** Data de hoje (yyyy-mm-dd) no fuso de quem usa, e nao em UTC. */
export function hojeLocal(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}
