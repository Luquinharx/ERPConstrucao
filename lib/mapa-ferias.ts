import { diasDoPeriodo, diasUteis, diaLocal, feriadosFacultativos, feriadosNacionais, nomeMotivoFalta, type OpcoesFeriados } from "@/lib/ponto"
import { idiomaAtual, localeIntl, t } from "@/lib/i18n"
import type { PedidoPonto } from "@/lib/types"

/**
 * Mapa de ferias anual: calendario do ano (meses em linhas, dias alinhados
 * pelo dia da semana) e o mapa por trabalhador com os periodos. A versao de
 * impressao e o mapa que a lei manda afixar (art. 241.º, n.º 9, CT).
 */

/** Nomes dos meses no idioma atual ("Janeiro"... / "January"...). */
export function nomesMeses(): string[] {
  const f = new Intl.DateTimeFormat(localeIntl(), { month: "long" })
  return Array.from({ length: 12 }, (_, i) => {
    const nome = f.format(new Date(2024, i, 1))
    return nome.charAt(0).toUpperCase() + nome.slice(1)
  })
}
/** Iniciais dos dias, de segunda a domingo, no idioma atual ("S T Q Q S S D" / "M T W T F S S"). */
export function letrasSemana(): string[] {
  const f = new Intl.DateTimeFormat(localeIntl(), { weekday: "narrow" })
  // 2024-01-01 foi uma segunda-feira
  return Array.from({ length: 7 }, (_, i) => f.format(new Date(2024, 0, 1 + i)).toUpperCase())
}
/** Colunas do calendario: ate 6 dias de desvio + 31 dias. */
export const COLUNAS_ANO = 37

export interface PessoaMapa {
  funcionarioId: string
  nome: string
  numero?: string
}

export interface MarcaDia {
  funcionarioId: string
  nome: string
  tipo: "ferias" | "falta"
  estado: PedidoPonto["estado"]
  motivo?: string
}

export interface DiaMapa {
  dia: string
  numero: number
  fimDeSemana: boolean
  feriado?: { nome: string; facultativo: boolean }
  marcas: MarcaDia[]
}

export interface MesMapa {
  indice: number
  nome: string
  /** Colunas vazias antes do dia 1 (segunda = 0). */
  desvio: number
  dias: DiaMapa[]
}

export interface PeriodoMapa {
  inicio: string
  fim: string
  dias: number
  estado: PedidoPonto["estado"]
}

export interface LinhaMapa {
  pessoa: PessoaMapa
  periodos: PeriodoMapa[]
  /** Dias uteis de ferias aprovadas no ano. */
  aprovados: number
  pendentes: number
  saldo: number
  faltas: number
  /** Dia (yyyy-mm-dd) -> marca, para a faixa do ano. */
  porDia: Map<string, MarcaDia>
}

export interface MapaAnual {
  ano: number
  meses: MesMapa[]
  linhas: LinhaMapa[]
  /** Dia com mais pessoas ausentes. */
  pico: { dia: string; nomes: string[] } | null
  feriados: Array<{ dia: string; nome: string; facultativo: boolean }>
}

export interface OpcoesMapa {
  incluirPendentes: boolean
  incluirFaltas: boolean
  diasFerias: number
  feriados?: OpcoesFeriados
}

const ordemEstado = (e: PedidoPonto["estado"]) => (e === "aprovado" ? 0 : 1)

/** Monta o mapa do ano. Pedidos recusados e cancelados nunca entram. */
export function mapaAnual(ano: number, pessoas: PessoaMapa[], pedidos: PedidoPonto[], opcoes: OpcoesMapa): MapaAnual {
  const inicioAno = `${ano}-01-01`
  const fimAno = `${ano}-12-31`
  const nacionais = feriadosNacionais(ano)
  const facultativos = feriadosFacultativos(ano, opcoes.feriados)
  const nomePorId = new Map(pessoas.map((p) => [p.funcionarioId, p.nome]))

  const validos = pedidos.filter(
    (p) =>
      (p.tipo === "ferias" || (p.tipo === "falta" && opcoes.incluirFaltas)) &&
      (p.estado === "aprovado" || (p.estado === "pendente" && opcoes.incluirPendentes)) &&
      !!p.inicio &&
      p.inicio <= fimAno &&
      (p.fim || p.inicio) >= inicioAno &&
      nomePorId.has(p.funcionarioId),
  )

  // Marcas por dia: ferias aprovadas primeiro, depois o resto
  const marcasPorDia = new Map<string, MarcaDia[]>()
  for (const p of [...validos].sort((a, b) => ordemEstado(a.estado) - ordemEstado(b.estado))) {
    const de = p.inicio! < inicioAno ? inicioAno : p.inicio!
    const ate = (p.fim || p.inicio)! > fimAno ? fimAno : (p.fim || p.inicio)!
    for (const dia of diasDoPeriodo(de, ate)) {
      const lista = marcasPorDia.get(dia) || []
      if (lista.some((m) => m.funcionarioId === p.funcionarioId)) continue
      lista.push({
        funcionarioId: p.funcionarioId,
        nome: nomePorId.get(p.funcionarioId) || p.funcionarioNome,
        tipo: p.tipo as "ferias" | "falta",
        estado: p.estado,
        motivo: p.tipo === "falta" ? nomeMotivoFalta(p.motivoFalta) : undefined,
      })
      marcasPorDia.set(dia, lista)
    }
  }

  const meses: MesMapa[] = nomesMeses().map((nome, indice) => {
    const primeiro = new Date(ano, indice, 1)
    const total = new Date(ano, indice + 1, 0).getDate()
    const dias: DiaMapa[] = []
    for (let n = 1; n <= total; n++) {
      const data = new Date(ano, indice, n)
      const dia = diaLocal(data)
      const semana = data.getDay()
      const nomeNacional = nacionais.get(dia)
      const nomeFacultativo = facultativos.get(dia)
      dias.push({
        dia,
        numero: n,
        fimDeSemana: semana === 0 || semana === 6,
        feriado: nomeNacional ? { nome: nomeNacional, facultativo: false } : nomeFacultativo ? { nome: nomeFacultativo, facultativo: true } : undefined,
        marcas: marcasPorDia.get(dia) || [],
      })
    }
    return { indice, nome, desvio: (primeiro.getDay() + 6) % 7, dias }
  })

  // Ausencias so contam em dias de trabalho
  const trabalha = (d: DiaMapa) => !d.fimDeSemana && !d.feriado
  let pico: MapaAnual["pico"] = null
  for (const m of meses)
    for (const d of m.dias) {
      if (!trabalha(d) || d.marcas.length === 0) continue
      if (!pico || d.marcas.length > pico.nomes.length) pico = { dia: d.dia, nomes: d.marcas.map((x) => x.nome) }
    }

  const linhas: LinhaMapa[] = pessoas.map((pessoa) => {
    const dele = validos.filter((p) => p.funcionarioId === pessoa.funcionarioId)
    const ferias = dele.filter((p) => p.tipo === "ferias").sort((a, b) => a.inicio!.localeCompare(b.inicio!))
    const periodos = ferias.map((p) => {
      const de = p.inicio! < inicioAno ? inicioAno : p.inicio!
      const ate = (p.fim || p.inicio)! > fimAno ? fimAno : (p.fim || p.inicio)!
      return { inicio: de, fim: ate, dias: diasUteis(de, ate, opcoes.feriados), estado: p.estado }
    })
    // O saldo conta como no resto do sistema: ferias que comecam neste ano
    const doAno = pedidos.filter((p) => p.funcionarioId === pessoa.funcionarioId && p.tipo === "ferias" && (p.inicio || "").startsWith(String(ano)))
    const soma = (estado: PedidoPonto["estado"]) =>
      doAno.filter((p) => p.estado === estado).reduce((s, p) => s + (p.diasUteis ?? diasUteis(p.inicio!, p.fim || p.inicio!, opcoes.feriados)), 0)
    const aprovados = soma("aprovado")
    const porDia = new Map<string, MarcaDia>()
    for (const [dia, lista] of marcasPorDia) {
      const m = lista.find((x) => x.funcionarioId === pessoa.funcionarioId)
      if (m) porDia.set(dia, m)
    }
    return {
      pessoa,
      periodos,
      aprovados,
      pendentes: soma("pendente"),
      saldo: opcoes.diasFerias - aprovados,
      faltas: dele.filter((p) => p.tipo === "falta").length,
      porDia,
    }
  })

  const feriados = [
    ...[...nacionais].map(([dia, nome]) => ({ dia, nome, facultativo: false })),
    ...[...facultativos].filter(([dia]) => !nacionais.has(dia)).map(([dia, nome]) => ({ dia, nome, facultativo: true })),
  ]
    .sort((a, b) => a.dia.localeCompare(b.dia))

  return { ano, meses, linhas, pico, feriados }
}

/** "04/01" ou "04/01 a 06/01". */
export function textoPeriodo(p: { inicio: string; fim: string }): string {
  const f = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`
  return p.inicio === p.fim ? f(p.inicio) : t("{inicio} a {fim}", { inicio: f(p.inicio), fim: f(p.fim) })
}

/** Iniciais para caber numa celula: "Ana Maria Costa" -> "AC". */
export function iniciais(nome: string): string {
  const partes = nome.replace(/^DEMO\s+/i, "").trim().split(/\s+/).filter(Boolean)
  if (partes.length === 0) return "?"
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase()
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase()
}

// ------------------------------------------------------------ Impressao

export interface EmpresaMapa {
  nome: string
  logoUrl?: string
  morada?: string
  nif?: string
}

const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")

/**
 * Pagina A4 na horizontal para afixar: calendario do ano com quem esta de
 * ferias em cada dia, mapa por trabalhador com os periodos e a faixa do ano,
 * feriados, e a nota legal com espaco para a assinatura.
 */
export function htmlMapaFerias(mapa: MapaAnual, empresa: EmpresaMapa, opcoes: { incluirPendentes: boolean; incluirFaltas: boolean; elaboradoEm: Date; titulo?: string }): string {
  const so = mapa.linhas.length === 1
  const celula = (d: DiaMapa) => {
    const cls = ["d"]
    if (d.fimDeSemana) cls.push("fds")
    if (d.feriado) cls.push(d.feriado.facultativo ? "fac" : "fer")
    const fer = d.marcas.filter((m) => m.tipo === "ferias")
    if (fer.some((m) => m.estado === "aprovado")) cls.push("ok")
    else if (fer.length) cls.push("pend")
    else if (d.marcas.length) cls.push("falta")
    const quem = so ? "" : d.marcas.map((m) => `<i class="${m.tipo === "falta" ? "f" : m.estado === "aprovado" ? "a" : "p"}">${esc(iniciais(m.nome))}</i>`).join("")
    const titulo = [d.feriado?.nome, ...d.marcas.map((m) => m.nome)].filter(Boolean).join(", ")
    return `<td class="${cls.join(" ")}" title="${esc(titulo)}"><b>${d.numero}</b>${quem ? `<span class="q">${quem}</span>` : ""}</td>`
  }
  const letras = letrasSemana()
  const cabecalhoSemana = Array.from({ length: COLUNAS_ANO }, (_, i) => `<th class="${i % 7 >= 5 ? "fds" : ""}">${letras[i % 7]}</th>`).join("")
  const linhasMeses = mapa.meses
    .map((m) => {
      const vazias = Array.from({ length: m.desvio }, () => `<td class="v"></td>`).join("")
      const depois = Array.from({ length: COLUNAS_ANO - m.desvio - m.dias.length }, () => `<td class="v"></td>`).join("")
      return `<tr><th class="mes">${m.nome}</th>${vazias}${m.dias.map(celula).join("")}${depois}</tr>`
    })
    .join("")

  const faixa = (l: LinhaMapa) =>
    `<div class="faixa">${mapa.meses
      .map(
        (m) =>
          `<span class="fm">${m.dias
            .map((d) => {
              const mk = l.porDia.get(d.dia)
              const c = mk ? (mk.tipo === "falta" ? "f" : mk.estado === "aprovado" ? "a" : "p") : d.fimDeSemana || d.feriado ? "x" : ""
              return `<span class="${c}"></span>`
            })
            .join("")}</span>`,
      )
      .join("")}</div>`
  const meses3 = `<div class="faixa cab">${mapa.meses.map((m) => `<span class="fm">${m.nome.slice(0, 3)}</span>`).join("")}</div>`
  const linhasPessoas = mapa.linhas
    .map(
      (l) => `<tr>
  <td class="nome">${esc(l.pessoa.nome)}${l.pessoa.numero ? `<small>${esc(t("n.º {numero}", { numero: l.pessoa.numero }))}</small>` : ""}</td>
  <td class="per">${l.periodos.length ? l.periodos.map((p) => `<span class="${p.estado === "aprovado" ? "pa" : "pp"}">${textoPeriodo(p)} <small>(${esc(t("{n} d", { n: p.dias }))})</small></span>`).join(" ") : `<span class="sem">${esc(t("Sem férias marcadas"))}</span>`}</td>
  <td class="num">${l.aprovados}</td>
  <td class="num">${l.saldo}</td>
  <td>${faixa(l)}</td>
</tr>`,
    )
    .join("")

  const feriados = mapa.feriados
    .map((f) => `<li><b>${f.dia.slice(8, 10)}/${f.dia.slice(5, 7)}</b> ${esc(f.nome)}${f.facultativo ? ` <small>(${esc(t("empresa"))})</small>` : ""}</li>`)
    .join("")
  const elaborado = opcoes.elaboradoEm.toLocaleDateString(localeIntl())
  const titulo = opcoes.titulo || t("Mapa de férias {ano}", { ano: mapa.ano })
  const dadosEmpresa = [empresa.morada, empresa.nif ? t("NIF {nif}", { nif: empresa.nif }) : ""].filter((x): x is string => !!x).map(esc).join(" · ")

  return `<!doctype html>
<html lang="${idiomaAtual()}"><head><meta charset="utf-8"><title>${esc(titulo)}</title>
<style>
@page { size: A4 landscape; margin: 9mm; }
* { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { margin: 0; font: 9px/1.25 "Segoe UI", Roboto, Arial, sans-serif; color: #1c1917; background: #fff; }
.folha { padding: 4mm 2mm; }
header { display: flex; align-items: center; gap: 12px; border-bottom: 2px solid #ea580c; padding-bottom: 6px; margin-bottom: 8px; }
header img { height: 34px; }
header .t { flex: 1; }
header h1 { margin: 0; font-size: 19px; letter-spacing: -.01em; }
header p { margin: 1px 0 0; color: #57534e; font-size: 9.5px; }
header .el { text-align: right; color: #57534e; font-size: 9px; }
h2 { font-size: 11px; margin: 10px 0 4px; text-transform: uppercase; letter-spacing: .06em; color: #9a3412; }
table { border-collapse: collapse; width: 100%; }
.cal { table-layout: fixed; }
.cal th { font-weight: 600; color: #78716c; font-size: 8px; padding: 1px 0; }
.cal th.fds { color: #a8a29e; }
.cal th.mes { text-align: left; color: #1c1917; font-size: 9.5px; padding-right: 6px; width: 64px; }
.cal td { border: 1px solid #e7e5e4; height: 26px; vertical-align: top; padding: 1px 1px 0; width: 2.5%; }
.cal td.v { border: 0; background: transparent; }
.cal td b { display: block; font-size: 8.5px; font-weight: 600; color: #44403c; }
.cal td.fds { background: #f5f5f4; }
.cal td.fds b { color: #a8a29e; }
.cal td.fer { background: #fee2e2; }
.cal td.fer b { color: #b91c1c; }
.cal td.fac { background: #ede9fe; }
.cal td.fac b { color: #6d28d9; }
.cal td.ok { background: #d1fae5; }
.cal td.pend { background: #fef3c7; }
.cal td.falta { background: #ffedd5; }
.cal td.ok.fds, .cal td.pend.fds { background: #f5f5f4; }
.q { display: flex; flex-wrap: wrap; gap: 1px; }
.q i { font-style: normal; font-size: 6.5px; font-weight: 700; line-height: 1; padding: 1px 1.5px; border-radius: 2px; color: #fff; background: #059669; }
.q i.p { background: #d97706; }
.q i.f { background: #ea580c; }
.leg { display: flex; flex-wrap: wrap; gap: 12px; margin: 5px 0 0; color: #57534e; }
.leg span::before { content: ""; display: inline-block; width: 10px; height: 10px; border-radius: 2px; margin-right: 4px; vertical-align: -1px; border: 1px solid #d6d3d1; background: var(--c); }
.pessoas { margin-top: 2px; }
.pessoas th { text-align: left; font-size: 8px; text-transform: uppercase; letter-spacing: .05em; color: #78716c; border-bottom: 1px solid #d6d3d1; padding: 3px 4px; }
.pessoas td { border-bottom: 1px solid #e7e5e4; padding: 4px; vertical-align: middle; }
.pessoas td.nome { font-weight: 600; width: 16%; }
.pessoas td.nome small { display: block; font-weight: 400; color: #78716c; }
.pessoas td.per { width: 30%; }
.pessoas td.num { text-align: center; width: 5%; font-weight: 600; }
.pa, .pp { display: inline-block; padding: 1px 5px; border-radius: 3px; margin: 1px 2px 1px 0; background: #d1fae5; color: #065f46; }
.pp { background: #fef3c7; color: #92400e; }
.sem { color: #a8a29e; }
.faixa { display: flex; height: 12px; border: 1px solid #d6d3d1; border-radius: 2px; overflow: hidden; }
.faixa .fm { flex: 1; display: flex; border-left: 1px solid #a8a29e; }
.faixa .fm:first-child { border-left: 0; }
.faixa .fm span { flex: 1; }
.faixa .x { background: #f5f5f4; }
.faixa .a { background: #10b981; }
.faixa .p { background: #f59e0b; }
.faixa .f { background: #f97316; }
.faixa.cab { height: auto; border: 0; }
.faixa.cab .fm { border-left: 0; justify-content: center; color: #78716c; font-size: 7.5px; text-transform: uppercase; }
.rodape { display: grid; grid-template-columns: 1.4fr 1fr; gap: 16px; margin-top: 10px; break-inside: avoid; }
.rodape ul { columns: 3; margin: 0; padding: 0; list-style: none; color: #44403c; }
.rodape li { margin-bottom: 1px; }
.rodape li small { color: #6d28d9; }
.legal { color: #57534e; }
.assina { margin-top: 22px; display: flex; gap: 30px; }
.assina div { flex: 1; border-top: 1px solid #44403c; padding-top: 2px; color: #57534e; }
.quebra { break-before: page; }
@media screen { body { background: #e7e5e4; } .folha { background: #fff; max-width: 287mm; margin: 12px auto; padding: 9mm; box-shadow: 0 2px 12px rgba(0,0,0,.15); } }
</style></head><body>
<div class="folha">
<header>
  ${empresa.logoUrl ? `<img src="${esc(empresa.logoUrl)}" alt="">` : ""}
  <div class="t"><h1>${esc(titulo)}</h1><p>${esc(empresa.nome)}${dadosEmpresa ? ` · ${dadosEmpresa}` : ""}</p></div>
  <div class="el">${esc(t("Elaborado em {data}", { data: elaborado }))}${opcoes.incluirPendentes ? `<br>${esc(t("Inclui pedidos por aprovar"))}` : ""}</div>
</header>
<table class="cal"><thead><tr><th class="mes"></th>${cabecalhoSemana}</tr></thead><tbody>${linhasMeses}</tbody></table>
<div class="leg">
  <span style="--c:#d1fae5">${esc(t("Férias aprovadas"))}</span>
  ${opcoes.incluirPendentes ? `<span style="--c:#fef3c7">${esc(t("Por aprovar"))}</span>` : ""}
  ${opcoes.incluirFaltas ? `<span style="--c:#ffedd5">${esc(t("Falta"))}</span>` : ""}
  <span style="--c:#fee2e2">${esc(t("Feriado nacional"))}</span>
  ${mapa.feriados.some((f) => f.facultativo) ? `<span style="--c:#ede9fe">${esc(t("Feriado dado pela empresa"))}</span>` : ""}
  <span style="--c:#f5f5f4">${esc(t("Fim de semana"))}</span>
  ${so ? "" : `<span style="--c:#059669">${esc(t("Iniciais de quem está ausente"))}</span>`}
</div>
</div>
<div class="folha quebra">
<header><div class="t"><h1>${esc(t("{titulo}: por trabalhador", { titulo }))}</h1><p>${esc(t("Início e termo dos períodos de férias de cada trabalhador (dias úteis)."))}</p></div><div class="el">${esc(t("Elaborado em {data}", { data: elaborado }))}</div></header>
<table class="pessoas"><thead><tr><th>${esc(t("Trabalhador"))}</th><th>${esc(t("Períodos de férias"))}</th><th>${esc(t("Dias"))}</th><th>${esc(t("Saldo"))}</th><th>${meses3}</th></tr></thead><tbody>${linhasPessoas}</tbody></table>
<div class="rodape">
  <div><h2>${esc(t("Feriados {ano}", { ano: mapa.ano }))}</h2><ul>${feriados}</ul></div>
  <div class="legal"><h2>${esc(t("Nota"))}</h2>
    ${esc(t("Mapa de férias elaborado nos termos do art. 241.º, n.º 9, do Código do Trabalho: elaborado até 15 de abril e afixado nos locais de trabalho entre essa data e 31 de outubro. Alterações posteriores são registadas no sistema."))}
    <div class="assina"><div>${esc(t("A gerência"))}</div><div>${esc(t("Data"))}</div></div>
  </div>
</div>
</div>
</body></html>`
}
