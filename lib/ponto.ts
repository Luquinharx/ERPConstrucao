import type { ConfigPonto, EstadoPedidoPonto, PedidoPonto, Picagem, TipoPicagem } from "@/lib/types"
import { m, t } from "@/lib/i18n"
import { round2 } from "@/lib/utils"

/**
 * Picagem de ponto: regras sem dependencias do Firebase, para se poderem
 * testar e reutilizar no ecra do trabalhador e no do gestor.
 */

export const CONFIG_PONTO_PADRAO: ConfigPonto = {
  validacao: "livre",
  raioMetros: 300,
  horaLimiteEntrada: "09:30",
  diasFerias: 22,
  horasDia: 8,
}

export const NOMES_PICAGEM: Record<TipoPicagem, string> = {
  entrada: m("Entrada ao serviço"),
  pausa: m("Início de pausa"),
  retoma: m("Fim de pausa"),
  saida: m("Saída do serviço"),
}

/** Motivos de falta mais comuns (art. 249.o do Codigo do Trabalho). */
export const MOTIVOS_FALTA: Array<{ id: string; nome: string; justificada: boolean }> = [
  { id: "doenca", nome: m("Doença (baixa médica)"), justificada: true },
  { id: "consulta", nome: m("Consulta / exame médico"), justificada: true },
  { id: "parental", nome: m("Licença parental"), justificada: true },
  { id: "assistencia_familia", nome: m("Assistência à família"), justificada: true },
  { id: "falecimento", nome: m("Falecimento de familiar"), justificada: true },
  { id: "casamento", nome: m("Casamento"), justificada: true },
  { id: "escolar", nome: m("Trabalhador-estudante / escola dos filhos"), justificada: true },
  { id: "tribunal", nome: m("Obrigação legal (tribunal, etc.)"), justificada: true },
  { id: "acidente", nome: m("Acidente de trabalho"), justificada: true },
  { id: "autorizada", nome: m("Autorizada pela empresa"), justificada: true },
  { id: "injustificada", nome: m("Injustificada"), justificada: false },
]

export function nomeMotivoFalta(id?: string): string {
  const nome = MOTIVOS_FALTA.find((x) => x.id === id)?.nome
  return nome ? t(nome) : id || t("Falta")
}

// ------------------------------------------------------------ Acesso por numero + PIN

/** Numero do funcionario como chave: sem espacos, minusculas, sem zeros a esquerda. */
export function normalizarNumero(numero: string): string {
  const limpo = String(numero || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9-]/g, "")
  return limpo.replace(/^0+(?=.)/, "")
}

/**
 * Email interno da conta de picagem. Nunca recebe correio: serve so para o
 * Firebase. O sufixo aleatorio deixa trocar o PIN criando uma conta nova.
 */
export function emailDePonto(numero: string, sufixo: string): string {
  return `n${normalizarNumero(numero)}.${sufixo}@ponto.invalid`
}

/** O Firebase exige 6 caracteres; o PIN tem 4 a 6 digitos. */
export function senhaDoPin(pin: string): string {
  return `${pin}::ponto`
}

export function pinValido(pin: string): boolean {
  return /^\d{4,6}$/.test(pin)
}

// ------------------------------------------------------------ Dia de trabalho

export interface Segmento {
  inicio: Date
  /** null = ainda a decorrer (ou esqueceu-se de picar). */
  fim: Date | null
  tipo: "trabalho" | "pausa"
  orcamentoId?: string
  orcamentoNumero?: string
}

export type EstadoPonto = "fora" | "a_trabalhar" | "em_pausa" | "saiu"

export interface DiaDePonto {
  dia: string
  picagens: Picagem[]
  segmentos: Segmento[]
  estado: EstadoPonto
  minutosTrabalho: number
  minutosPausa: number
  primeiraEntrada: Date | null
  ultimaSaida: Date | null
  /** Ha um periodo sem fecho (falta picar saida ou fim de pausa). */
  incompleto: boolean
  /** Obra em que esta agora (ou a ultima). */
  obraAtual?: { orcamentoId?: string; orcamentoNumero?: string }
}

const minutos = (a: Date, b: Date) => Math.max(0, (b.getTime() - a.getTime()) / 60000)

/** Picagens validas: tira as anuladas e as proprias anulacoes. */
export function picagensValidas(picagens: Picagem[]): Picagem[] {
  const anuladas = new Set(picagens.filter((p) => p.origem === "anulacao" && p.anulaId).map((p) => p.anulaId))
  return picagens
    .filter((p) => p.origem !== "anulacao" && !anuladas.has(p.id))
    .sort((a, b) => a.hora.getTime() - b.hora.getTime())
}

/**
 * Le um dia de picagens.
 * - entrada abre trabalho; outra entrada com obra diferente muda de obra.
 * - pausa fecha o trabalho e abre a pausa; retoma fecha a pausa.
 * - saida fecha o que estiver aberto.
 *
 * @param agora para contar o periodo ainda aberto (ecra do dia). Sem ele, o
 *   periodo aberto nao conta horas (relatorios de dias passados).
 */
export function lerDia(dia: string, todas: Picagem[], agora?: Date): DiaDePonto {
  const picagens = picagensValidas(todas.filter((p) => p.dia === dia))
  const segmentos: Segmento[] = []
  let aberto: Segmento | null = null
  let obra: { orcamentoId?: string; orcamentoNumero?: string } | undefined
  let estado: EstadoPonto = "fora"

  const fechar = (quando: Date) => {
    if (aberto) {
      aberto.fim = quando
      segmentos.push(aberto)
      aberto = null
    }
  }

  for (const p of picagens) {
    if (p.tipo === "entrada") {
      fechar(p.hora)
      obra = { orcamentoId: p.orcamentoId, orcamentoNumero: p.orcamentoNumero }
      aberto = { inicio: p.hora, fim: null, tipo: "trabalho", ...obra }
      estado = "a_trabalhar"
    } else if (p.tipo === "pausa") {
      fechar(p.hora)
      aberto = { inicio: p.hora, fim: null, tipo: "pausa" }
      estado = "em_pausa"
    } else if (p.tipo === "retoma") {
      fechar(p.hora)
      aberto = { inicio: p.hora, fim: null, tipo: "trabalho", ...obra }
      estado = "a_trabalhar"
    } else if (p.tipo === "saida") {
      fechar(p.hora)
      estado = "saiu"
    }
  }
  const incompleto = !!aberto
  if (aberto) segmentos.push(aberto)

  const conta = (tipo: Segmento["tipo"]) =>
    Math.round(
      segmentos
        .filter((s) => s.tipo === tipo)
        .reduce((soma, s) => soma + (s.fim ? minutos(s.inicio, s.fim) : agora ? minutos(s.inicio, agora) : 0), 0),
    )

  const entradas = picagens.filter((p) => p.tipo === "entrada")
  const saidas = picagens.filter((p) => p.tipo === "saida")
  return {
    dia,
    picagens,
    segmentos,
    estado,
    minutosTrabalho: conta("trabalho"),
    minutosPausa: conta("pausa"),
    primeiraEntrada: entradas[0]?.hora || null,
    ultimaSaida: saidas[saidas.length - 1]?.hora || null,
    incompleto,
    obraAtual: obra,
  }
}

/** Qual o proximo passo valido, para mostrar so os botoes que fazem sentido. */
export function acoesPossiveis(estado: EstadoPonto): TipoPicagem[] {
  if (estado === "a_trabalhar") return ["pausa", "saida", "entrada"]
  if (estado === "em_pausa") return ["retoma", "saida"]
  return ["entrada"]
}

/** Horas de trabalho por obra num dia (periodos fechados). */
export function horasPorObra(diaLido: DiaDePonto): Array<{ orcamentoId: string; orcamentoNumero: string; horas: number }> {
  const mapa = new Map<string, { orcamentoNumero: string; minutos: number }>()
  for (const s of diaLido.segmentos) {
    if (s.tipo !== "trabalho" || !s.fim || !s.orcamentoId) continue
    const atual = mapa.get(s.orcamentoId) || { orcamentoNumero: s.orcamentoNumero || "", minutos: 0 }
    atual.minutos += minutos(s.inicio, s.fim)
    mapa.set(s.orcamentoId, atual)
  }
  return [...mapa.entries()].map(([orcamentoId, v]) => ({ orcamentoId, orcamentoNumero: v.orcamentoNumero, horas: round2(v.minutos / 60) }))
}

export function formatarMinutos(total: number): string {
  const m = Math.max(0, Math.round(total))
  return `${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}`
}

export function formatarHora(d: Date | null | undefined): string {
  if (!d) return "--:--"
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
}

export function diaLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

/** "2026-11-04" + "08:30" -> Date local. */
export function dataHora(dia: string, hora: string): Date {
  const [a, m, d] = dia.split("-").map(Number)
  const [h, min] = hora.split(":").map(Number)
  return new Date(a, m - 1, d, h || 0, min || 0)
}

// ------------------------------------------------------------ Feriados e dias uteis

/** Domingo de Pascoa (algoritmo de Meeus/Jones/Butcher). */
function pascoa(ano: number): Date {
  const a = ano % 19
  const b = Math.floor(ano / 100)
  const c = ano % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const mes = Math.floor((h + l - 7 * m + 114) / 31)
  const dia = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(ano, mes - 1, dia)
}

/** Feriados facultativos que a empresa da (art. 235.º CT). Vem da configuracao do ponto. */
export type OpcoesFeriados = Pick<ConfigPonto, "carnaval" | "feriadoMunicipal" | "nomeFeriadoMunicipal">

/** Carnaval e feriado municipal, quando a empresa os da. */
export function feriadosFacultativos(ano: number, opcoes?: OpcoesFeriados): Map<string, string> {
  const mapa = new Map<string, string>()
  if (opcoes?.carnaval) {
    const p = pascoa(ano)
    mapa.set(diaLocal(new Date(p.getFullYear(), p.getMonth(), p.getDate() - 47)), t("Carnaval"))
  }
  if (opcoes?.feriadoMunicipal && /^\d{2}-\d{2}$/.test(opcoes.feriadoMunicipal)) {
    mapa.set(`${ano}-${opcoes.feriadoMunicipal}`, opcoes.nomeFeriadoMunicipal?.trim() || t("Feriado municipal"))
  }
  return mapa
}

/** Le "13/06", "13-06" ou "06-13" (ja gravado) e devolve "MM-DD"; vazio se invalido. */
export function lerDiaMes(texto: string): string {
  const t = texto.trim()
  if (/^\d{2}-\d{2}$/.test(t)) return t
  const m = t.match(/^(\d{1,2})[/.](\d{1,2})$/)
  if (!m) return ""
  const dia = Number(m[1])
  const mes = Number(m[2])
  if (mes < 1 || mes > 12 || dia < 1 || dia > new Date(2024, mes, 0).getDate()) return ""
  return `${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`
}

/**
 * Feriados de Portugal: os nacionais obrigatorios e, se a empresa os der,
 * o Carnaval e o feriado municipal.
 */
export function feriadosPT(ano: number, opcoes?: OpcoesFeriados): Map<string, string> {
  const mapa = feriadosNacionais(ano)
  for (const [dia, nome] of feriadosFacultativos(ano, opcoes)) if (!mapa.has(dia)) mapa.set(dia, nome)
  return mapa
}

/** Feriados nacionais obrigatorios (art. 234.º CT). */
export function feriadosNacionais(ano: number): Map<string, string> {
  const p = pascoa(ano)
  const mais = (dias: number) => diaLocal(new Date(p.getFullYear(), p.getMonth(), p.getDate() + dias))
  const fixos: Array<[string, string]> = [
    ["01-01", t("Ano Novo")],
    ["04-25", t("Dia da Liberdade")],
    ["05-01", t("Dia do Trabalhador")],
    ["06-10", t("Dia de Portugal")],
    ["08-15", t("Assunção de Nossa Senhora")],
    ["10-05", t("Implantação da República")],
    ["11-01", t("Todos os Santos")],
    ["12-01", t("Restauração da Independência")],
    ["12-08", t("Imaculada Conceição")],
    ["12-25", t("Natal")],
  ]
  const mapa = new Map<string, string>(fixos.map(([md, nome]) => [`${ano}-${md}`, nome]))
  mapa.set(mais(-2), t("Sexta-feira Santa"))
  mapa.set(diaLocal(p), t("Páscoa"))
  mapa.set(mais(60), t("Corpo de Deus"))
  return mapa
}

/** Dia util: nem fim de semana nem feriado (nacional ou facultativo dado pela empresa). */
export function ehDiaUtil(dia: string, opcoes?: OpcoesFeriados): boolean {
  const [a, m, d] = dia.split("-").map(Number)
  const data = new Date(a, m - 1, d)
  const semana = data.getDay()
  if (semana === 0 || semana === 6) return false
  return !feriadosPT(a, opcoes).has(dia)
}

/** Dias do periodo (inclusivo), em yyyy-mm-dd. */
export function diasDoPeriodo(inicio: string, fim: string): string[] {
  if (!inicio || !fim || fim < inicio) return []
  const [a, m, d] = inicio.split("-").map(Number)
  const lista: string[] = []
  for (let data = new Date(a, m - 1, d); diaLocal(data) <= fim; data.setDate(data.getDate() + 1)) {
    lista.push(diaLocal(data))
    if (lista.length > 400) break
  }
  return lista
}

export function diasUteis(inicio: string, fim: string, opcoes?: OpcoesFeriados): number {
  return diasDoPeriodo(inicio, fim).filter((d) => ehDiaUtil(d, opcoes)).length
}

export interface SaldoFerias {
  direito: number
  aprovados: number
  pendentes: number
  disponiveis: number
}

/** Saldo de ferias do ano: direito menos aprovados (os pendentes mostram-se a parte). */
export function saldoFerias(pedidos: PedidoPonto[], ano: number, direito: number): SaldoFerias {
  const doAno = pedidos.filter((p) => p.tipo === "ferias" && (p.inicio || "").startsWith(String(ano)))
  const soma = (estado: PedidoPonto["estado"]) =>
    doAno.filter((p) => p.estado === estado).reduce((s, p) => s + (p.diasUteis ?? diasUteis(p.inicio!, p.fim!)), 0)
  const aprovados = soma("aprovado")
  const pendentes = soma("pendente")
  return { direito, aprovados, pendentes, disponiveis: direito - aprovados }
}

/** O pedido (ferias ou falta) cobre este dia? */
export function pedidoNoDia(pedidos: PedidoPonto[], dia: string): PedidoPonto | undefined {
  return pedidos.find(
    (p) => (p.tipo === "ferias" || p.tipo === "falta") && p.estado !== "cancelado" && p.estado !== "recusado" && !!p.inicio && p.inicio <= dia && (p.fim || p.inicio) >= dia,
  )
}

// ------------------------------------------------------------ Local da picagem

/** Distancia em metros entre dois pontos (haversine). */
export function distanciaMetros(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000
  const rad = (x: number) => (x * Math.PI) / 180
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return Math.round(2 * R * Math.asin(Math.sqrt(h)))
}

const PREFIXO_QR = "PONTO:"

/** Texto do QR afixado na obra. */
export function codigoQRObra(obraId: string, token: string): string {
  return `${PREFIXO_QR}${obraId}:${token}`
}

export function lerCodigoQRObra(texto: string): { obraId: string; token: string } | null {
  const t = (texto || "").trim()
  if (!t.startsWith(PREFIXO_QR)) return null
  const [obraId, token] = t.slice(PREFIXO_QR.length).split(":")
  return obraId && token ? { obraId, token } : null
}

export function novoToken(tamanho = 12): string {
  const letras = "abcdefghijkmnpqrstuvwxyz23456789"
  let s = ""
  const aleatorio = typeof crypto !== "undefined" && crypto.getRandomValues ? crypto.getRandomValues(new Uint32Array(tamanho)) : null
  for (let i = 0; i < tamanho; i++) s += letras[(aleatorio ? aleatorio[i] : Math.floor(Math.random() * 1e9)) % letras.length]
  return s
}

/** Aceita "38.7223, -9.1393" ou um link do Google Maps com @lat,lng. */
export function lerCoordenadas(texto: string): { lat: number; lng: number } | null {
  const m = (texto || "").match(/(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)/)
  if (!m) return null
  const lat = Number(m[1])
  const lng = Number(m[2])
  return Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null
}

// ------------------------------------------------------------ Estados dos pedidos

export const CORES_ESTADO: Record<EstadoPedidoPonto, string> = {
  pendente: "border-amber-400 bg-amber-50 text-amber-800",
  aprovado: "border-emerald-400 bg-emerald-50 text-emerald-800",
  recusado: "border-rose-400 bg-rose-50 text-rose-800",
  cancelado: "border-slate-300 bg-slate-50 text-slate-500",
}
export const NOMES_ESTADO: Record<EstadoPedidoPonto, string> = {
  pendente: m("Pendente"),
  aprovado: m("Aprovado"),
  recusado: m("Recusado"),
  cancelado: m("Cancelado"),
}

