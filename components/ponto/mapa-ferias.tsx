"use client"

import { useMemo, useState } from "react"
import { ChevronLeft, ChevronRight, Printer } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { useConfiguracao } from "@/hooks/use-configuracao"
import { toast } from "@/hooks/use-toast"
import { COLUNAS_ANO, LETRAS_SEMANA, htmlMapaFerias, iniciais, mapaAnual, textoPeriodo, type DiaMapa, type LinhaMapa, type MarcaDia } from "@/lib/mapa-ferias"
import { NOMES_ESTADO, diaLocal, diasDoPeriodo, ehDiaUtil, feriadosPT, nomeMotivoFalta, pedidoNoDia, saldoFerias } from "@/lib/ponto"
import type { ConfigPonto, PedidoPonto, Picagem } from "@/lib/types"

import type { Pessoa } from "./gestor"

const TODOS = "__todos"

function corMarca(m: MarcaDia): string {
  if (m.tipo === "falta") return "bg-orange-500"
  return m.estado === "aprovado" ? "bg-emerald-600" : "bg-amber-500"
}

function fundoDia(d: DiaMapa, so: boolean): string {
  const ferias = d.marcas.filter((m) => m.tipo === "ferias")
  if (d.fimDeSemana) return "bg-stone-100 text-muted-foreground dark:bg-stone-900"
  if (d.feriado) return d.feriado.facultativo ? "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200" : "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-200"
  if (ferias.some((m) => m.estado === "aprovado")) return so ? "bg-emerald-500 text-white" : "bg-emerald-100 dark:bg-emerald-950"
  if (ferias.length) return so ? "bg-amber-400 text-amber-950" : "bg-amber-100 dark:bg-amber-950"
  if (d.marcas.length) return so ? "bg-orange-400 text-white" : "bg-orange-100 dark:bg-orange-950"
  return ""
}

function tituloDia(d: DiaMapa): string {
  const data = `${d.dia.slice(8, 10)}/${d.dia.slice(5, 7)}`
  const partes = [d.feriado?.nome, ...d.marcas.map((m) => `${m.nome}: ${m.tipo === "falta" ? m.motivo || "falta" : "ferias"}${m.estado === "pendente" ? " (por aprovar)" : ""}`)]
  return [data, ...partes.filter(Boolean)].join("\n")
}

/** Faixa do ano de um trabalhador: um traco por dia, meses separados. */
function FaixaAno({ linha, meses }: { linha: LinhaMapa; meses: ReturnType<typeof mapaAnual>["meses"] }) {
  return (
    <div className="flex h-4 min-w-[420px] overflow-hidden rounded-sm border">
      {meses.map((m) => (
        <div key={m.indice} className="flex flex-1 border-l first:border-l-0 border-border">
          {m.dias.map((d) => {
            const mk = linha.porDia.get(d.dia)
            const c = mk ? corMarca(mk) : d.fimDeSemana || d.feriado ? "bg-muted" : ""
            return <span key={d.dia} className={`flex-1 ${c}`} title={mk ? tituloDia({ ...d, marcas: [mk] }) : undefined} />
          })}
        </div>
      ))}
    </div>
  )
}

function CalendarioAno({ mapa, so, hoje }: { mapa: ReturnType<typeof mapaAnual>; so: boolean; hoje: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[980px] table-fixed border-separate border-spacing-[2px] text-xs" data-testid="calendario-ano">
        <thead>
          <tr>
            <th className="w-24" />
            {Array.from({ length: COLUNAS_ANO }, (_, i) => (
              <th key={i} className={`pb-1 text-center font-medium ${i % 7 >= 5 ? "text-muted-foreground/60" : "text-muted-foreground"}`}>
                {LETRAS_SEMANA[i % 7]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {mapa.meses.map((m) => (
            <tr key={m.indice}>
              <th className="whitespace-nowrap pr-2 text-left text-sm font-semibold">{m.nome}</th>
              {Array.from({ length: m.desvio }, (_, i) => (
                <td key={`a${i}`} />
              ))}
              {m.dias.map((d) => (
                <td
                  key={d.dia}
                  title={tituloDia(d)}
                  data-dia={d.dia}
                  data-ausentes={d.marcas.length || undefined}
                  className={`h-9 rounded-md border align-top ${fundoDia(d, so)} ${d.dia === hoje ? "ring-2 ring-primary" : ""}`}
                >
                  <div className="px-0.5 text-[10px] font-semibold leading-tight">{d.numero}</div>
                  {!so && d.marcas.length > 0 && !d.fimDeSemana && !d.feriado && (
                    <div className="flex flex-wrap gap-px px-px">
                      {d.marcas.slice(0, 2).map((mk) => (
                        <span key={mk.funcionarioId} className={`rounded-[3px] px-[2px] text-[8px] font-bold leading-[11px] text-white ${corMarca(mk)}`}>
                          {iniciais(mk.nome)}
                        </span>
                      ))}
                      {d.marcas.length > 2 && <span className="text-[8px] font-bold leading-[11px]">+{d.marcas.length - 2}</span>}
                    </div>
                  )}
                </td>
              ))}
              {Array.from({ length: COLUNAS_ANO - m.desvio - m.dias.length }, (_, i) => (
                <td key={`d${i}`} />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Legenda({ pendentes, faltas, facultativos }: { pendentes: boolean; faltas: boolean; facultativos: boolean }) {
  const item = (cor: string, texto: string) => (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-3 w-3 rounded-sm border ${cor}`} />
      {texto}
    </span>
  )
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {item("bg-emerald-500", "Ferias aprovadas")}
      {pendentes && item("bg-amber-400", "Por aprovar")}
      {faltas && item("bg-orange-400", "Falta")}
      {item("bg-rose-100", "Feriado nacional")}
      {facultativos && item("bg-violet-100", "Feriado dado pela empresa")}
      {item("bg-muted", "Fim de semana")}
    </div>
  )
}

export function MapaFerias({
  pessoas,
  pedidos,
  picagens,
  config,
  mes,
  setMes,
}: {
  pessoas: Pessoa[]
  pedidos: PedidoPonto[]
  picagens: Picagem[]
  config: ConfigPonto
  mes: string
  setMes: (m: string) => void
}) {
  const { configuracao } = useConfiguracao()
  const [vista, setVista] = useState<"ano" | "mes">("ano")
  const [ano, setAno] = useState(() => new Date().getFullYear())
  const [quem, setQuem] = useState(TODOS)
  const [pendentes, setPendentes] = useState(true)
  const [faltas, setFaltas] = useState(false)
  const hoje = diaLocal(new Date())

  // No mapa entram os funcionarios ativos e quem tem acesso ou pedidos
  const todas = useMemo(() => pessoas.filter((p) => p.funcionario || p.acesso || pedidos.some((x) => x.funcionarioId === p.funcionarioId)), [pessoas, pedidos])
  const escolhidas = useMemo(() => (quem === TODOS ? todas : todas.filter((p) => p.funcionarioId === quem)), [todas, quem])
  const so = quem !== TODOS

  const mapa = useMemo(
    () =>
      mapaAnual(
        ano,
        escolhidas.map((p) => ({ funcionarioId: p.funcionarioId, nome: p.nome || "(sem nome)", numero: p.numero })),
        pedidos,
        { incluirPendentes: pendentes, incluirFaltas: faltas, diasFerias: config.diasFerias, feriados: config },
      ),
    [ano, escolhidas, pedidos, pendentes, faltas, config],
  )

  const totalMarcados = mapa.linhas.reduce((s, l) => s + l.aprovados, 0)
  const totalPendentes = mapa.linhas.reduce((s, l) => s + l.pendentes, 0)
  const semMarcar = mapa.linhas.filter((l) => l.aprovados + l.pendentes === 0).length

  const imprimir = () => {
    const janela = window.open("", "_blank")
    if (!janela) return toast({ title: "O browser bloqueou a janela", description: "Permita janelas deste site para imprimir.", variant: "destructive" })
    const pessoa = so ? escolhidas[0]?.nome : ""
    janela.document.write(
      htmlMapaFerias(
        mapa,
        { nome: configuracao.razaoSocial || configuracao.nome, logoUrl: configuracao.logoUrl, morada: [configuracao.morada, configuracao.codigoPostal, configuracao.cidade].filter(Boolean).join(", "), nif: configuracao.nif },
        { incluirPendentes: pendentes, incluirFaltas: faltas, elaboradoEm: new Date(), titulo: so ? `Ferias ${ano}: ${pessoa}` : undefined },
      ),
    )
    janela.document.close()
    const imgs = Array.from(janela.document.images)
    Promise.all(imgs.map((i) => (i.complete ? null : new Promise((r) => ((i.onload = r), (i.onerror = r)))))).then(() => {
      janela.focus()
      janela.print()
    })
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-lg">Mapa de ferias</CardTitle>
            <CardDescription>
              {vista === "ano"
                ? "O ano inteiro da equipa. Por lei (art. 241.º CT) o mapa e feito ate 15 de abril e fica afixado ate 31 de outubro."
                : "Verde: aprovado · amarelo: por aprovar · laranja: falta · ponto: picou nesse dia."}
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-full border p-0.5" role="group" aria-label="Vista do mapa">
              {(["ano", "mes"] as const).map((v) => (
                <Button key={v} size="sm" variant={vista === v ? "default" : "ghost"} className="h-8 rounded-full px-4" onClick={() => setVista(v)} aria-pressed={vista === v}>
                  {v === "ano" ? "Ano" : "Mes"}
                </Button>
              ))}
            </div>
            {vista === "ano" ? (
              <>
                <div className="inline-flex items-center rounded-full border">
                  <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full" onClick={() => setAno(ano - 1)} aria-label="Ano anterior">
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="w-12 text-center text-sm font-semibold tabular-nums" data-testid="ano-mapa">
                    {ano}
                  </span>
                  <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full" onClick={() => setAno(ano + 1)} aria-label="Ano seguinte">
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
                <Button className="rounded-full" onClick={imprimir}>
                  <Printer className="mr-2 h-4 w-4" />
                  Imprimir para afixar
                </Button>
              </>
            ) : (
              <Input type="month" value={mes} onChange={(e) => e.target.value && setMes(e.target.value)} className="w-40" aria-label="Mes do mapa" />
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {vista === "mes" ? (
          <MapaMes pessoas={todas} pedidos={pedidos} picagens={picagens} config={config} mes={mes} />
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
              <Select value={quem} onValueChange={(v) => v && setQuem(v)}>
                <SelectTrigger className="w-64" aria-label="Trabalhador do mapa">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={TODOS}>Toda a equipa</SelectItem>
                  {todas.map((p) => (
                    <SelectItem key={p.funcionarioId} value={p.funcionarioId}>
                      {p.nome}
                      {p.numero ? ` (n.º ${p.numero})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex items-center gap-2">
                <Switch id="mapa-pendentes" checked={pendentes} onCheckedChange={setPendentes} />
                <Label htmlFor="mapa-pendentes" className="font-normal">
                  Mostrar por aprovar
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch id="mapa-faltas" checked={faltas} onCheckedChange={setFaltas} />
                <Label htmlFor="mapa-faltas" className="font-normal">
                  Mostrar faltas
                </Label>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" data-testid="resumo-mapa">
              <Resumo titulo="Dias aprovados" valor={String(totalMarcados)} nota={`${mapa.linhas.length} trabalhador(es)`} />
              <Resumo titulo="Por aprovar" valor={String(totalPendentes)} nota="dias uteis" destaque={totalPendentes > 0 ? "text-amber-600" : ""} />
              <Resumo titulo="Sem ferias marcadas" valor={String(semMarcar)} nota={semMarcar ? "falta marcar" : "todos marcados"} destaque={semMarcar ? "text-rose-600" : "text-emerald-600"} />
              <Resumo
                titulo="Mais gente fora"
                valor={mapa.pico ? `${mapa.pico.nomes.length}` : "0"}
                nota={mapa.pico ? `a ${mapa.pico.dia.slice(8, 10)}/${mapa.pico.dia.slice(5, 7)}: ${mapa.pico.nomes.map(iniciais).join(", ")}` : "ninguem marcado"}
              />
            </div>

            <CalendarioAno mapa={mapa} so={so} hoje={hoje} />
            <Legenda pendentes={pendentes} faltas={faltas} facultativos={mapa.feriados.some((f) => f.facultativo)} />

            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm" data-testid="mapa-ferias">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">Trabalhador</th>
                    <th className="py-2 pr-3 font-medium">Periodos de ferias</th>
                    <th className="py-2 pr-3 text-center font-medium">Dias</th>
                    <th className="py-2 pr-3 text-center font-medium">Saldo</th>
                    <th className="py-2 font-medium">
                      <div className="flex min-w-[420px]">
                        {mapa.meses.map((m) => (
                          <span key={m.indice} className="flex-1 text-center text-[10px]">
                            {m.nome.slice(0, 3)}
                          </span>
                        ))}
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {mapa.linhas.map((l) => (
                    <tr key={l.pessoa.funcionarioId} className="border-b last:border-0">
                      <td className="py-2 pr-3">
                        <div className="font-medium">{l.pessoa.nome}</div>
                        {l.pessoa.numero && <div className="text-xs text-muted-foreground">n.º {l.pessoa.numero}</div>}
                      </td>
                      <td className="py-2 pr-3">
                        {l.periodos.length === 0 ? (
                          <span className="text-xs text-muted-foreground">Sem ferias marcadas</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {l.periodos.map((p) => (
                              <span
                                key={p.inicio}
                                className={`rounded px-1.5 py-0.5 text-xs ${p.estado === "aprovado" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200" : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200"}`}
                              >
                                {textoPeriodo(p)} · {p.dias} d
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="py-2 pr-3 text-center tabular-nums">
                        {l.aprovados}
                        {l.pendentes ? <span className="text-amber-600"> +{l.pendentes}</span> : null}
                      </td>
                      <td className={`py-2 pr-3 text-center font-semibold tabular-nums ${l.saldo < 0 ? "text-rose-600" : ""}`}>
                        {l.saldo}/{config.diasFerias}
                      </td>
                      <td className="py-2">
                        <FaixaAno linha={l} meses={mapa.meses} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {mapa.linhas.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Sem trabalhadores.</p>}
            </div>

            <details className="text-sm">
              <summary className="cursor-pointer text-muted-foreground">Feriados de {ano}</summary>
              <ul className="mt-2 grid gap-x-6 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
                {mapa.feriados.map((f) => (
                  <li key={f.dia}>
                    <span className="font-medium tabular-nums">
                      {f.dia.slice(8, 10)}/{f.dia.slice(5, 7)}
                    </span>{" "}
                    {f.nome}
                    {f.facultativo && <span className="text-violet-600"> (empresa)</span>}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-muted-foreground">Carnaval e feriado municipal so contam se a empresa os der: ative-os em Configuracao.</p>
            </details>
          </>
        )}
      </CardContent>
    </Card>
  )
}

function Resumo({ titulo, valor, nota, destaque = "" }: { titulo: string; valor: string; nota: string; destaque?: string }) {
  return (
    <div className="rounded-xl border p-3">
      <div className="text-xs text-muted-foreground">{titulo}</div>
      <div className={`text-2xl font-bold tabular-nums ${destaque}`}>{valor}</div>
      <div className="truncate text-xs text-muted-foreground" title={nota}>
        {nota}
      </div>
    </div>
  )
}

/** Vista de um mes, dia a dia, com as picagens (a vista antiga). */
function MapaMes({ pessoas, pedidos, picagens, config, mes }: { pessoas: Pessoa[]; pedidos: PedidoPonto[]; picagens: Picagem[]; config: ConfigPonto; mes: string }) {
  const dias = diasDoPeriodo(`${mes}-01`, `${mes}-31`).filter((d) => d.startsWith(mes))
  const ano = Number(mes.slice(0, 4))
  const feriados = feriadosPT(ano, config)
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-xs" data-testid="mapa-mes">
        <thead>
          <tr>
            <th className="sticky left-0 bg-background p-1 text-left">Trabalhador</th>
            <th className="p-1 text-left">Saldo {ano}</th>
            {dias.map((d) => (
              <th key={d} className={`w-6 p-0.5 text-center font-normal ${!ehDiaUtil(d, config) ? "text-muted-foreground" : ""}`} title={feriados.get(d) || ""}>
                {Number(d.slice(8))}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {pessoas.map((p) => {
            const dele = pedidos.filter((x) => x.funcionarioId === p.funcionarioId)
            const saldo = saldoFerias(dele, ano, config.diasFerias)
            return (
              <tr key={p.funcionarioId} className="border-t">
                <td className="sticky left-0 whitespace-nowrap bg-background p-1">{p.nome}</td>
                <td className="whitespace-nowrap p-1">
                  {saldo.disponiveis}/{saldo.direito}
                  {saldo.pendentes ? ` (+${saldo.pendentes}?)` : ""}
                </td>
                {dias.map((d) => {
                  const pedido = pedidoNoDia(dele, d)
                  const picou = picagens.some((x) => x.funcionarioId === p.funcionarioId && x.dia === d && x.origem !== "anulacao")
                  const util = ehDiaUtil(d, config)
                  const cor = pedido
                    ? pedido.tipo === "ferias"
                      ? pedido.estado === "aprovado"
                        ? "bg-emerald-400"
                        : "bg-amber-300"
                      : pedido.estado === "aprovado"
                        ? "bg-orange-400"
                        : "bg-orange-200"
                    : !util
                      ? feriados.has(d)
                        ? "bg-rose-100"
                        : "bg-muted"
                      : ""
                  return (
                    <td
                      key={d}
                      className={`h-6 border text-center ${cor}`}
                      title={pedido ? `${pedido.tipo === "ferias" ? "Ferias" : nomeMotivoFalta(pedido.motivoFalta)} (${NOMES_ESTADO[pedido.estado]})` : feriados.get(d) || ""}
                    >
                      {picou ? "•" : ""}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
      {pessoas.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Sem trabalhadores.</p>}
    </div>
  )
}
