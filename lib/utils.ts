import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

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

/** Numero formatado em pt-PT sempre com 2 casas decimais (sem simbolo de moeda). */
export function formatNumber2(value: number | string | null | undefined): string {
  return new Intl.NumberFormat("pt-PT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(round2(value))
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-PT", {
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
  const d = typeof date === "string" ? new Date(date) : date
  return d.toLocaleDateString("pt-PT")
}

export function generateUniqueId(): string {
  return Math.random().toString(36).substr(2, 9)
}
