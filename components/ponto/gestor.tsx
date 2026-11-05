"use client"

import { Fragment, useMemo, useState } from "react"
import QRCode from "qrcode"
import { Ban, Check, Copy, Download, KeyRound, LocateFixed, Plus, Printer, QrCode, Send, X } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { toast } from "@/hooks/use-toast"
import {
  CORES_ESTADO,
  NOMES_ESTADO,
  NOMES_PICAGEM,
  codigoQRObra,
  dataHora,
  diaLocal,
  diasDoPeriodo,
  ehDiaUtil,
  feriadosPT,
  formatarHora,
  formatarMinutos,
  horasPorObra,
  lerCoordenadas,
  lerDiaMes,
  lerDia,
  nomeMotivoFalta,
  normalizarNumero,
  novoToken,
  pedidoNoDia,
  saldoFerias,
  type DiaDePonto,
} from "@/lib/ponto"
import {
  anularPicagem,
  corrigirPicagem,
  criarAcessoPonto,
  decidirPedido,
  desativarAcessoPonto,
  enviarParaLivroDePonto,
  guardarConfigPonto,
  guardarObraPonto,
  reativarAcessoPonto,
} from "@/lib/ponto-service"
import { custoHoraFuncionario } from "@/lib/produto-calculos"
import type { AcessoPonto, ConfigPonto, Funcionario, ObraPonto, PedidoPonto, Picagem, TipoPicagem } from "@/lib/types"
import { formatDate, round2 } from "@/lib/utils"

export interface Gestor {
  uid: string
  email: string
}

/** Pessoa do ponto: o funcionario (se o gestor o pode ler) e o seu acesso. */
export interface Pessoa {
  funcionarioId: string
  nome: string
  numero: string
  acesso?: AcessoPonto
  funcionario?: Funcionario
}

const rotuloEstado = (d: DiaDePonto) =>
  d.estado === "a_trabalhar" ? "A trabalhar" : d.estado === "em_pausa" ? "Em pausa" : d.estado === "saiu" ? "Saiu" : "Sem picagem"

// ------------------------------------------------------------ Hoje

export function PainelHoje({
  pessoas,
  picagens,
  pedidos,
  config,
  agora,
}: {
  pessoas: Pessoa[]
  picagens: Picagem[]
  pedidos: PedidoPonto[]
  config: ConfigPonto
  agora: Date
}) {
  const hoje = diaLocal(agora)
  const util = ehDiaUtil(hoje, config)
  const passouLimite = agora >= dataHora(hoje, config.horaLimiteEntrada)
  const linhas = pessoas
    .filter((p) => p.acesso?.ativo || picagens.some((x) => x.funcionarioId === p.funcionarioId && x.dia === hoje))
    .map((p) => {
      const dia = lerDia(hoje, picagens.filter((x) => x.funcionarioId === p.funcionarioId), agora)
      const pedido = pedidoNoDia(pedidos.filter((x) => x.funcionarioId === p.funcionarioId), hoje)
      const emFalta = util && passouLimite && dia.picagens.length === 0 && !pedido
      return { p, dia, pedido, emFalta }
    })
    .sort((a, b) => Number(b.emFalta) - Number(a.emFalta) || a.p.nome.localeCompare(b.p.nome))

  const conta = (f: (l: (typeof linhas)[number]) => boolean) => linhas.filter(f).length
  const resumo: Array<[string, number, string]> = [
    ["A trabalhar", conta((l) => l.dia.estado === "a_trabalhar"), "text-emerald-700"],
    ["Em pausa", conta((l) => l.dia.estado === "em_pausa"), "text-amber-700"],
    ["Ja sairam", conta((l) => l.dia.estado === "saiu"), ""],
    ["Ferias / falta", conta((l) => !!l.pedido), ""],
    [`Sem picagem${passouLimite ? "" : ` (depois das ${config.horaLimiteEntrada})`}`, conta((l) => l.emFalta), "text-rose-700"],
  ]

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5" data-testid="resumo-hoje">
        {resumo.map(([nome, n, cor]) => (
          <Card key={nome}>
            <CardHeader className="pb-1">
              <CardDescription>{nome}</CardDescription>
            </CardHeader>
            <CardContent className={`text-2xl font-bold ${cor}`}>{n}</CardContent>
          </Card>
        ))}
      </div>
      {!util && <p className="text-sm text-muted-foreground">Hoje nao e dia util{feriadosPT(agora.getFullYear(), config).get(hoje) ? ` (${feriadosPT(agora.getFullYear(), config).get(hoje)})` : ""}: ninguem fica em falta.</p>}
      <Card>
        <CardContent className="pt-4">
          <Table data-testid="tabela-hoje">
            <TableHeader>
              <TableRow>
                <TableHead>Trabalhador</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Entrada</TableHead>
                <TableHead>Obra</TableHead>
                <TableHead className="text-right">Trabalho</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {linhas.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                    Ninguem com acesso a picagem. Crie os acessos no separador Acessos.
                  </TableCell>
                </TableRow>
              )}
              {linhas.map(({ p, dia, pedido, emFalta }) => (
                <TableRow key={p.funcionarioId} className={emFalta ? "bg-rose-50 dark:bg-rose-950/30" : ""}>
                  <TableCell>
                    <div className="font-medium">{p.nome}</div>
                    <div className="text-xs text-muted-foreground">n.º {p.numero || "-"}</div>
                  </TableCell>
                  <TableCell className="space-x-1">
                    {/* Uma falta de parte do dia (consulta) nao esconde que esta a trabalhar */}
                    {pedido && (
                      <Badge variant="outline" className={CORES_ESTADO[pedido.estado]}>
                        {pedido.tipo === "ferias" ? "Ferias" : nomeMotivoFalta(pedido.motivoFalta)}
                        {pedido.estado === "pendente" ? " (por aprovar)" : ""}
                      </Badge>
                    )}
                    {(!pedido || dia.picagens.length > 0) && (
                      <Badge
                        variant="outline"
                        className={
                          emFalta
                            ? "border-rose-400 text-rose-700"
                            : dia.estado === "a_trabalhar"
                              ? "border-emerald-400 text-emerald-700"
                              : dia.estado === "em_pausa"
                                ? "border-amber-400 text-amber-700"
                                : ""
                        }
                      >
                        {emFalta ? "Em falta" : rotuloEstado(dia)}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="tabular-nums">{formatarHora(dia.primeiraEntrada)}</TableCell>
                  <TableCell>{dia.obraAtual?.orcamentoNumero || "-"}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatarMinutos(dia.minutosTrabalho)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

// ------------------------------------------------------------ Pedidos

export function PainelPedidos({ pedidos, gestor, aoMudar }: { pedidos: PedidoPonto[]; gestor: Gestor; aoMudar: () => Promise<void> }) {
  const [resposta, setResposta] = useState<Record<string, string>>({})
  const [aDecidir, setADecidir] = useState("")
  const pendentes = pedidos.filter((p) => p.estado === "pendente").sort((a, b) => (a.createdAt?.getTime() || 0) - (b.createdAt?.getTime() || 0))
  const outros = pedidos
    .filter((p) => p.estado !== "pendente")
    .sort((a, b) => (b.decididoEm?.getTime() || b.createdAt?.getTime() || 0) - (a.decididoEm?.getTime() || a.createdAt?.getTime() || 0))
    .slice(0, 40)

  const decidir = async (p: PedidoPonto, aprovar: boolean) => {
    setADecidir(p.id!)
    try {
      await decidirPedido(p, aprovar, gestor, (resposta[p.id!] || "").trim())
      toast({ title: aprovar ? "Pedido aprovado" : "Pedido recusado" })
      await aoMudar()
    } catch (e) {
      toast({ title: "Nao foi possivel gravar", description: e instanceof Error ? e.message : String(e), variant: "destructive" })
    } finally {
      setADecidir("")
    }
  }

  const descricao = (p: PedidoPonto) => {
    if (p.tipo === "correcao" && p.correcao)
      return `Correcao: ${NOMES_PICAGEM[p.correcao.tipo]} as ${p.correcao.hora} de ${formatDate(p.correcao.dia)}${p.correcao.orcamentoNumero ? ` (${p.correcao.orcamentoNumero})` : ""}`
    const periodo = `${formatDate(p.inicio!)}${p.fim && p.fim !== p.inicio ? ` a ${formatDate(p.fim)}` : ""}`
    if (p.tipo === "ferias") return `Ferias: ${periodo} · ${p.diasUteis} dia(s) uteis`
    return `Falta: ${nomeMotivoFalta(p.motivoFalta)} · ${periodo}${p.horas ? ` · ${p.horas} h` : ""}`
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Por decidir ({pendentes.length})</CardTitle>
          <CardDescription>Aprovado fica verde na app do trabalhador. Uma correcao aprovada cria a picagem em falta.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2" data-testid="pedidos-pendentes">
          {pendentes.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">Nada por decidir.</p>}
          {pendentes.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center gap-3 rounded-lg border p-3">
              <div className="min-w-[220px] flex-1">
                <div className="font-medium">{p.funcionarioNome}</div>
                <div className="text-sm">{descricao(p)}</div>
                {p.observacoes && <div className="text-xs text-muted-foreground">&ldquo;{p.observacoes}&rdquo;</div>}
              </div>
              <Input
                placeholder="Resposta (opcional)"
                value={resposta[p.id!] || ""}
                onChange={(e) => setResposta({ ...resposta, [p.id!]: e.target.value })}
                className="w-56"
              />
              <Button size="sm" className="rounded-full" disabled={aDecidir === p.id} onClick={() => decidir(p, true)}>
                <Check className="mr-1 h-3 w-3" />
                Aprovar
              </Button>
              <Button size="sm" variant="outline" className="rounded-full" disabled={aDecidir === p.id} onClick={() => decidir(p, false)}>
                <X className="mr-1 h-3 w-3" />
                Recusar
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Decididos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {outros.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">Ainda nenhum.</p>}
          {outros.map((p) => (
            <div key={p.id} className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border p-2 text-sm ${CORES_ESTADO[p.estado]}`}>
              <span>
                <span className="font-medium">{p.funcionarioNome}</span> · {descricao(p)}
              </span>
              <span className="text-xs">
                {NOMES_ESTADO[p.estado]}
                {p.decididoPor ? ` por ${p.decididoPor}` : ""}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

// ------------------------------------------------------------ Registos do mes

export function PainelRegistos({
  pessoas,
  picagens,
  pedidos,
  obras,
  mes,
  setMes,
  gestor,
  custoFixoHora,
  podeEnviarHoras,
  config,
  aoMudar,
}: {
  pessoas: Pessoa[]
  picagens: Picagem[]
  pedidos: PedidoPonto[]
  obras: ObraPonto[]
  mes: string
  setMes: (m: string) => void
  gestor: Gestor
  custoFixoHora: number
  podeEnviarHoras: boolean
  config?: ConfigPonto
  aoMudar: () => Promise<void>
}) {
  const [quem, setQuem] = useState(pessoas[0]?.funcionarioId || "")
  const [aberto, setAberto] = useState("")
  const [corrigir, setCorrigir] = useState<{ dia: string } | null>(null)
  const [aEnviar, setAEnviar] = useState(false)
  const agora = new Date()
  const hoje = diaLocal(agora)
  const dias = diasDoPeriodo(`${mes}-01`, `${mes}-31`).filter((d) => d.startsWith(mes) && d <= hoje)
  const pessoa = pessoas.find((p) => p.funcionarioId === quem)

  const lidosDe = (funcionarioId: string) => {
    const doFunc = picagens.filter((p) => p.funcionarioId === funcionarioId)
    return dias.map((d) => lerDia(d, doFunc, d === hoje ? agora : undefined))
  }
  const lidos = useMemo(() => (quem ? lidosDe(quem) : []), [quem, picagens, mes]) // eslint-disable-line react-hooks/exhaustive-deps
  const total = lidos.reduce((s, d) => s + d.minutosTrabalho, 0)
  const seusPedidos = pedidos.filter((p) => p.funcionarioId === quem)

  const exportarCSV = () => {
    const linhas = [["Trabalhador", "N.º", "Dia", "Entrada", "Saida", "Pausa", "Trabalho (h)", "Obras", "Ocorrencias"]]
    for (const p of pessoas) {
      const pedidosDele = pedidos.filter((x) => x.funcionarioId === p.funcionarioId)
      for (const d of lidosDe(p.funcionarioId)) {
        const pedido = pedidoNoDia(pedidosDele, d.dia)
        if (d.picagens.length === 0 && !pedido) continue
        const ocorrencias = [
          d.incompleto && d.dia !== hoje ? "Falta picar" : "",
          d.picagens.some((x) => x.origem === "correcao") ? "Corrigida" : "",
          pedido ? `${pedido.tipo === "ferias" ? "Ferias" : nomeMotivoFalta(pedido.motivoFalta)} (${NOMES_ESTADO[pedido.estado]})` : "",
        ].filter(Boolean)
        linhas.push([
          p.nome,
          p.numero,
          formatDate(d.dia),
          formatarHora(d.primeiraEntrada),
          formatarHora(d.ultimaSaida),
          formatarMinutos(d.minutosPausa),
          String(round2(d.minutosTrabalho / 60)).replace(".", ","),
          [...new Set(d.segmentos.map((s) => s.orcamentoNumero).filter(Boolean))].join(" "),
          ocorrencias.join(" / "),
        ])
      }
    }
    const csv = "﻿" + linhas.map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\r\n")
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }))
    const a = document.createElement("a")
    a.href = url
    a.download = `registo-tempos-${mes}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  /** Horas por obra de todos os dias fechados do mes -> livro de ponto (custo da obra). */
  const enviarHoras = async () => {
    const linhas: Parameters<typeof enviarParaLivroDePonto>[0] = []
    for (const p of pessoas) {
      if (!p.funcionario) continue
      for (const d of lidosDe(p.funcionarioId)) {
        if (d.dia === hoje) continue
        for (const h of horasPorObra(d)) {
          if (h.horas <= 0) continue
          linhas.push({
            funcionarioId: p.funcionarioId,
            funcionarioNome: p.nome,
            orcamentoId: h.orcamentoId,
            orcamentoNumero: h.orcamentoNumero,
            data: d.dia,
            horas: h.horas,
            custoHora: custoHoraFuncionario(p.funcionario),
            custoFixoHora: round2(custoFixoHora),
            estado: "pendente",
            userId: gestor.uid,
            observacoes: "Vindo das picagens",
          })
        }
      }
    }
    if (linhas.length === 0) return toast({ title: "Nada para enviar", description: "Nao ha dias fechados com obra neste mes." })
    setAEnviar(true)
    try {
      const r = await enviarParaLivroDePonto(linhas)
      toast({
        title: `${r.criados} registo(s) enviados para o Livro de ponto`,
        description: `${r.ignorados ? `${r.ignorados} ja estavam aprovados e nao mudaram. ` : ""}Ficam pendentes ate serem aprovados.`,
      })
    } catch (e) {
      toast({ title: "Nao foi possivel enviar", description: e instanceof Error ? e.message : String(e), variant: "destructive" })
    } finally {
      setAEnviar(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="text-lg">Registo de tempos</CardTitle>
            <CardDescription>
              Art. 202.º do Codigo do Trabalho: inicio, fim e intervalos de cada dia. As picagens nao se apagam: corrige-se ou anula-se, com motivo.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2 print:hidden">
            <Input type="month" value={mes} onChange={(e) => e.target.value && setMes(e.target.value)} className="w-40" aria-label="Mes dos registos" />
            <Button variant="outline" className="rounded-full" onClick={exportarCSV}>
              <Download className="mr-2 h-4 w-4" />
              Exportar mes (CSV)
            </Button>
            <Button variant="outline" className="rounded-full" onClick={() => window.print()}>
              <Printer className="mr-2 h-4 w-4" />
              Imprimir
            </Button>
            {podeEnviarHoras && (
              <Button className="rounded-full" onClick={enviarHoras} disabled={aEnviar}>
                <Send className="mr-2 h-4 w-4" />
                Enviar horas para o Livro de ponto
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-3 print:hidden">
          <Select value={quem} onValueChange={setQuem}>
            <SelectTrigger className="w-72" aria-label="Trabalhador">
              <SelectValue placeholder="Trabalhador" />
            </SelectTrigger>
            <SelectContent>
              {pessoas.map((p) => (
                <SelectItem key={p.funcionarioId} value={p.funcionarioId}>
                  {p.nome}
                  {p.numero ? ` (n.º ${p.numero})` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-sm">
            Total do mes: <strong>{formatarMinutos(total)}</strong>
          </span>
        </div>
        <div className="hidden print:block">
          <strong>{pessoa?.nome}</strong> · n.º {pessoa?.numero} · {mes} · total {formatarMinutos(total)}
        </div>
        <Table data-testid="tabela-registos">
          <TableHeader>
            <TableRow>
              <TableHead>Dia</TableHead>
              <TableHead>Entrada</TableHead>
              <TableHead>Saida</TableHead>
              <TableHead>Pausa</TableHead>
              <TableHead>Trabalho</TableHead>
              <TableHead>Obras</TableHead>
              <TableHead>Ocorrencias</TableHead>
              <TableHead className="print:hidden" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...lidos].reverse().map((d) => {
              const pedido = pedidoNoDia(seusPedidos, d.dia)
              const util = ehDiaUtil(d.dia, config)
              if (!util && d.picagens.length === 0 && !pedido) return null
              const todasDoDia = picagens.filter((p) => p.funcionarioId === quem && p.dia === d.dia).sort((a, b) => a.hora.getTime() - b.hora.getTime())
              const anuladas = new Set(todasDoDia.filter((p) => p.origem === "anulacao").map((p) => p.anulaId))
              return (
                <Fragment key={d.dia}>
                  <TableRow className={!util ? "text-muted-foreground" : ""}>
                    <TableCell className="whitespace-nowrap">{formatDate(d.dia)}</TableCell>
                    <TableCell className="tabular-nums">{formatarHora(d.primeiraEntrada)}</TableCell>
                    <TableCell className="tabular-nums">{formatarHora(d.ultimaSaida)}</TableCell>
                    <TableCell className="tabular-nums">{d.minutosPausa ? formatarMinutos(d.minutosPausa) : "-"}</TableCell>
                    <TableCell className="tabular-nums font-medium">{formatarMinutos(d.minutosTrabalho)}</TableCell>
                    <TableCell className="text-xs">{[...new Set(d.segmentos.map((s) => s.orcamentoNumero).filter(Boolean))].join(", ") || "-"}</TableCell>
                    <TableCell className="space-x-1 text-xs">
                      {d.incompleto && d.dia !== hoje && <Badge variant="outline" className="border-rose-300 text-rose-700">Falta picar</Badge>}
                      {d.picagens.some((p) => p.origem === "correcao") && <Badge variant="outline">Corrigida</Badge>}
                      {pedido && (
                        <Badge variant="outline" className={CORES_ESTADO[pedido.estado]}>
                          {pedido.tipo === "ferias" ? "Ferias" : nomeMotivoFalta(pedido.motivoFalta)}
                        </Badge>
                      )}
                      {util && d.picagens.length === 0 && !pedido && d.dia !== hoje && <Badge variant="outline" className="border-rose-300 text-rose-700">Sem registo</Badge>}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-right print:hidden">
                      <Button size="sm" variant="ghost" onClick={() => setAberto(aberto === d.dia ? "" : d.dia)}>
                        {aberto === d.dia ? "Fechar" : "Detalhe"}
                      </Button>
                    </TableCell>
                  </TableRow>
                  {aberto === d.dia && (
                    <TableRow className="bg-muted/40 print:hidden">
                      <TableCell colSpan={8}>
                        <ul className="space-y-1 text-sm">
                          {todasDoDia.map((p) => (
                            <li key={p.id} className={`flex items-center justify-between gap-2 ${anuladas.has(p.id) ? "line-through opacity-60" : ""}`}>
                              <span>
                                <span className="tabular-nums font-medium">{formatarHora(p.hora)}</span> ·{" "}
                                {p.origem === "anulacao" ? `Anulacao (${p.motivo})` : NOMES_PICAGEM[p.tipo]}
                                {p.orcamentoNumero ? ` · ${p.orcamentoNumero}` : ""}
                                <span className="text-xs text-muted-foreground">
                                  {p.origem === "correcao" ? ` · correcao de ${p.feitaPor}: ${p.motivo}` : ""}
                                  {p.origem === "app" ? ` · app${p.metodo === "qr" ? " (QR)" : p.metodo === "gps" ? ` (GPS a ${p.gps?.distancia ?? "?"} m)` : ""}` : ""}
                                </span>
                              </span>
                              {p.origem !== "anulacao" && !anuladas.has(p.id) && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-destructive"
                                  onClick={async () => {
                                    const motivo = prompt("Motivo da anulacao (fica no registo):")
                                    if (!motivo?.trim()) return
                                    await anularPicagem(p, motivo.trim(), gestor)
                                    await aoMudar()
                                  }}
                                >
                                  <Ban className="mr-1 h-3 w-3" />
                                  Anular
                                </Button>
                              )}
                            </li>
                          ))}
                        </ul>
                        <Button size="sm" variant="outline" className="mt-2 rounded-full" onClick={() => setCorrigir({ dia: d.dia })}>
                          <Plus className="mr-1 h-3 w-3" />
                          Acrescentar picagem
                        </Button>
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              )
            })}
          </TableBody>
        </Table>
      </CardContent>
      <DialogCorrecao
        dia={corrigir?.dia}
        pessoa={pessoa}
        uidTrabalhador={pessoa?.acesso?.uid || picagens.find((p) => p.funcionarioId === quem)?.uid || ""}
        obras={obras}
        gestor={gestor}
        aoFechar={() => setCorrigir(null)}
        aoGravar={aoMudar}
      />
    </Card>
  )
}

function DialogCorrecao({
  dia,
  pessoa,
  uidTrabalhador,
  obras,
  gestor,
  aoFechar,
  aoGravar,
}: {
  dia?: string
  pessoa?: Pessoa
  uidTrabalhador: string
  obras: ObraPonto[]
  gestor: Gestor
  aoFechar: () => void
  aoGravar: () => Promise<void>
}) {
  const [tipo, setTipo] = useState<TipoPicagem>("saida")
  const [hora, setHora] = useState("")
  const [obraId, setObraId] = useState("")
  const [motivo, setMotivo] = useState("")
  const gravar = async () => {
    if (!dia || !pessoa || !hora || !motivo.trim()) return toast({ title: "Indique a hora e o motivo", variant: "destructive" })
    if (!uidTrabalhador) return toast({ title: "Este trabalhador ainda nao tem acesso a picagem", variant: "destructive" })
    const obra = obras.find((o) => o.id === obraId)
    await corrigirPicagem(
      {
        funcionarioId: pessoa.funcionarioId,
        funcionarioNome: pessoa.nome,
        uidTrabalhador,
        tipo,
        dia,
        hora,
        orcamentoId: obra?.id,
        orcamentoNumero: obra?.numero,
        motivo: motivo.trim(),
      },
      gestor,
    )
    toast({ title: "Picagem acrescentada", description: "Fica marcada como correcao, com o seu nome e o motivo." })
    setHora("")
    setMotivo("")
    aoFechar()
    await aoGravar()
  }
  return (
    <Dialog open={!!dia} onOpenChange={(a) => !a && aoFechar()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Acrescentar picagem</DialogTitle>
          <DialogDescription>
            {pessoa?.nome} · {dia ? formatDate(dia) : ""}. Fica no registo como correcao sua, com o motivo.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Select value={tipo} onValueChange={(v) => setTipo(v as TipoPicagem)}>
              <SelectTrigger aria-label="Tipo">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(NOMES_PICAGEM) as TipoPicagem[]).map((t) => (
                  <SelectItem key={t} value={t}>
                    {NOMES_PICAGEM[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input type="time" value={hora} onChange={(e) => setHora(e.target.value)} aria-label="Hora" />
          </div>
          {tipo === "entrada" && (
            <Select value={obraId} onValueChange={setObraId}>
              <SelectTrigger aria-label="Obra">
                <SelectValue placeholder="Obra" />
              </SelectTrigger>
              <SelectContent>
                {obras.map((o) => (
                  <SelectItem key={o.id} value={o.id!}>
                    {o.numero} · {o.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Input placeholder="Motivo (obrigatorio)" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          <Button className="w-full rounded-full" onClick={gravar}>
            Gravar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ------------------------------------------------------------ Acessos

export function PainelAcessos({ pessoas, podeCriar, aoMudar }: { pessoas: Pessoa[]; podeCriar: boolean; aoMudar: () => Promise<void> }) {
  const [alvo, setAlvo] = useState<Pessoa | null>(null)
  const [pin, setPin] = useState("")
  const [aGravar, setAGravar] = useState(false)
  const link = typeof window !== "undefined" ? `${window.location.origin}/login?modo=pin` : "/login?modo=pin"

  const gravar = async () => {
    if (!alvo?.funcionario) return
    setAGravar(true)
    try {
      await criarAcessoPonto(alvo.funcionario, pin)
      toast({ title: "Acesso criado", description: `${alvo.nome}: n.º ${normalizarNumero(alvo.numero)} + PIN ${pin}` })
      setAlvo(null)
      setPin("")
      await aoMudar()
    } catch (e) {
      toast({ title: "Nao foi possivel criar o acesso", description: e instanceof Error ? e.message : String(e), variant: "destructive" })
    } finally {
      setAGravar(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Acessos a picagem</CardTitle>
        <CardDescription>
          Cada trabalhador entra com o n.º de funcionario e um PIN de 4 a 6 digitos. So ve as suas picagens e pedidos. Link para enviar:{" "}
          <button
            type="button"
            className="inline-flex items-center gap-1 font-medium text-primary underline"
            onClick={() => {
              void navigator.clipboard?.writeText(link)
              toast({ title: "Link copiado", description: link })
            }}
          >
            {link}
            <Copy className="h-3 w-3" />
          </button>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table data-testid="tabela-acessos">
          <TableHeader>
            <TableRow>
              <TableHead>Funcionario</TableHead>
              <TableHead>N.º</TableHead>
              <TableHead>Acesso</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {pessoas.map((p) => (
              <TableRow key={p.funcionarioId} data-testid="linha-acesso">
                <TableCell className="font-medium">{p.nome}</TableCell>
                <TableCell>{p.numero || <span className="text-xs text-rose-700">sem numero na ficha</span>}</TableCell>
                <TableCell>
                  {p.acesso ? (
                    <Badge variant="outline" className={p.acesso.ativo ? "border-emerald-400 text-emerald-700" : "text-muted-foreground"}>
                      {p.acesso.ativo ? "Ativo" : "Desativado"}
                    </Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">Sem acesso</span>
                  )}
                </TableCell>
                <TableCell className="space-x-1 whitespace-nowrap text-right">
                  {podeCriar && p.funcionario && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-full"
                      disabled={!p.numero}
                      onClick={() => {
                        setAlvo(p)
                        setPin(String(Math.floor(1000 + Math.random() * 9000)))
                      }}
                    >
                      <KeyRound className="mr-1 h-3 w-3" />
                      {p.acesso ? "Novo PIN" : "Criar acesso"}
                    </Button>
                  )}
                  {p.acesso && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={async () => {
                        if (p.acesso!.ativo) await desativarAcessoPonto(p.acesso!)
                        else await reativarAcessoPonto(p.acesso!)
                        await aoMudar()
                      }}
                    >
                      {p.acesso.ativo ? "Desativar" : "Reativar"}
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {!podeCriar && <p className="mt-3 text-xs text-muted-foreground">Para criar acessos e preciso poder ver os funcionarios.</p>}
      </CardContent>
      <Dialog open={!!alvo} onOpenChange={(a) => !a && setAlvo(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{alvo?.acesso ? "Novo PIN" : "Criar acesso"}</DialogTitle>
            <DialogDescription>
              {alvo?.nome} entra com o n.º <strong>{alvo ? normalizarNumero(alvo.numero) : ""}</strong> e este PIN. Pode muda-lo depois na app.
              {alvo?.acesso ? " O PIN antigo deixa de funcionar." : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Label htmlFor="novo-pin">PIN (4 a 6 digitos)</Label>
            <Input id="novo-pin" inputMode="numeric" maxLength={6} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} className="text-center text-2xl tracking-[0.4em]" />
            <Button className="w-full rounded-full" onClick={gravar} disabled={aGravar}>
              {aGravar ? "A criar..." : "Gravar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

// ------------------------------------------------------------ Obras

export interface ObraCandidata {
  id: string
  numero: string
  nome: string
  morada?: string
}

export function PainelObras({
  candidatas,
  obrasPonto,
  config,
  aoMudar,
}: {
  candidatas: ObraCandidata[]
  obrasPonto: ObraPonto[]
  config: ConfigPonto
  aoMudar: () => Promise<void>
}) {
  const [coords, setCoords] = useState<Record<string, string>>({})
  const lista = useMemo(() => {
    const mapa = new Map<string, { candidata?: ObraCandidata; ponto?: ObraPonto }>()
    for (const c of candidatas) mapa.set(c.id, { candidata: c })
    for (const o of obrasPonto) mapa.set(o.id!, { ...(mapa.get(o.id!) || {}), ponto: o })
    return [...mapa.entries()].sort((a, b) => (a[1].candidata?.numero || a[1].ponto?.numero || "").localeCompare(b[1].candidata?.numero || b[1].ponto?.numero || ""))
  }, [candidatas, obrasPonto])

  const guardar = async (id: string, base: { candidata?: ObraCandidata; ponto?: ObraPonto }, alteracoes: Partial<ObraPonto>) => {
    try {
      await guardarObraPonto({
        id,
        numero: base.candidata?.numero || base.ponto?.numero || "",
        nome: base.candidata?.nome || base.ponto?.nome || "",
        morada: base.candidata?.morada || base.ponto?.morada || "",
        ativa: base.ponto?.ativa ?? true,
        tokenQR: base.ponto?.tokenQR || novoToken(),
        ...(base.ponto?.local ? { local: base.ponto.local } : {}),
        ...(base.ponto?.raio ? { raio: base.ponto.raio } : {}),
        ...alteracoes,
      })
      await aoMudar()
    } catch (e) {
      toast({ title: "Nao foi possivel gravar", description: e instanceof Error ? e.message : String(e), variant: "destructive" })
    }
  }

  const imprimirQR = async (o: ObraPonto) => {
    const url = await QRCode.toDataURL(codigoQRObra(o.id!, o.tokenQR), { margin: 1, width: 600 })
    const janela = window.open("", "_blank", "width=700,height=900")
    if (!janela) return toast({ title: "Desbloqueie os popups para imprimir", variant: "destructive" })
    janela.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>QR ${o.numero}</title>
      <style>body{font-family:Arial,sans-serif;text-align:center;padding:30px}h1{font-size:34px;margin:0}h2{font-weight:normal;margin:6px 0 20px}img{width:420px;height:420px}p{font-size:18px}</style></head>
      <body><h1>Picagem de ponto</h1><h2>${o.numero} · ${o.nome.replace(/</g, "&lt;")}</h2><img src="${url}" alt="QR"/><p>Abra a app, toque em <b>Entrar a ler o QR da obra</b> e aponte a camera.</p></body></html>`)
    janela.document.close()
    setTimeout(() => janela.print(), 400)
  }

  const usarLocalAtual = (id: string, base: { candidata?: ObraCandidata; ponto?: ObraPonto }) => {
    if (!navigator.geolocation) return toast({ title: "Sem localizacao neste aparelho", variant: "destructive" })
    navigator.geolocation.getCurrentPosition(
      (p) => void guardar(id, base, { local: { lat: p.coords.latitude, lng: p.coords.longitude } }),
      () => toast({ title: "Autorize a localizacao no browser", variant: "destructive" }),
      { enableHighAccuracy: true, timeout: 15000 },
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Obras onde se pode picar</CardTitle>
        <CardDescription>
          Validacao atual: <strong>{NOMES_VALIDACAO[config.validacao]}</strong>. Para o QR, imprima e afixe na obra. Para o GPS, defina o local: no sitio com
          &ldquo;Usar a minha localizacao&rdquo;, ou cole as coordenadas do Google Maps.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table data-testid="tabela-obras-ponto">
          <TableHeader>
            <TableRow>
              <TableHead>Obra</TableHead>
              <TableHead>Pode picar</TableHead>
              <TableHead>Local (GPS)</TableHead>
              <TableHead>Raio</TableHead>
              <TableHead>QR</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lista.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  Ainda nao ha obras adjudicadas.
                </TableCell>
              </TableRow>
            )}
            {lista.map(([id, base]) => {
              const o = base.ponto
              return (
                <TableRow key={id} data-testid="linha-obra-ponto">
                  <TableCell>
                    <div className="font-medium">{base.candidata?.numero || o?.numero}</div>
                    <div className="text-xs text-muted-foreground">{base.candidata?.nome || o?.nome}</div>
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={!!o?.ativa}
                      onCheckedChange={(ativa) => void guardar(id, base, { ativa })}
                      aria-label={`Pode picar em ${base.candidata?.numero || o?.numero}`}
                    />
                  </TableCell>
                  <TableCell className="min-w-[260px]">
                    {o?.local && (
                      <a
                        className="mb-1 block text-xs text-primary underline"
                        href={`https://www.google.com/maps?q=${o.local.lat},${o.local.lng}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {o.local.lat.toFixed(5)}, {o.local.lng.toFixed(5)}
                      </a>
                    )}
                    <div className="flex gap-1">
                      <Input
                        placeholder="38.72, -9.13 ou link do Maps"
                        value={coords[id] || ""}
                        onChange={(e) => setCoords({ ...coords, [id]: e.target.value })}
                        className="h-8 text-xs"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8"
                        onClick={() => {
                          const c = lerCoordenadas(coords[id] || "")
                          if (!c) return toast({ title: "Coordenadas invalidas", description: "Ex.: 38.7223, -9.1393", variant: "destructive" })
                          void guardar(id, base, { local: c })
                          setCoords({ ...coords, [id]: "" })
                        }}
                      >
                        OK
                      </Button>
                      <Button size="sm" variant="ghost" className="h-8" title="Usar a minha localizacao" onClick={() => usarLocalAtual(id, base)}>
                        <LocateFixed className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min={50}
                      step={50}
                      defaultValue={o?.raio || ""}
                      placeholder={String(config.raioMetros)}
                      onBlur={(e) => {
                        const raio = Number(e.target.value) || 0
                        if (raio !== (o?.raio || 0)) void guardar(id, base, { raio: raio || undefined })
                      }}
                      className="h-8 w-24 text-xs"
                      aria-label="Raio em metros"
                    />
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {o && (
                      <>
                        <Button size="sm" variant="outline" className="rounded-full" onClick={() => imprimirQR(o)}>
                          <QrCode className="mr-1 h-3 w-3" />
                          Imprimir
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          title="Gerar QR novo (o antigo deixa de valer)"
                          onClick={() => {
                            if (confirm("Gerar um QR novo? O QR afixado deixa de funcionar.")) void guardar(id, base, { tokenQR: novoToken() })
                          }}
                        >
                          Novo QR
                        </Button>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

// ------------------------------------------------------------ Configuracao

export const NOMES_VALIDACAO: Record<ConfigPonto["validacao"], string> = {
  livre: "Livre (escolhe a obra na lista)",
  qr: "So QR afixado na obra",
  gps: "So GPS (perto da obra)",
  qr_ou_gps: "QR ou GPS",
}

export function PainelConfig({ config, aoMudar }: { config: ConfigPonto; aoMudar: () => Promise<void> }) {
  const [c, setC] = useState(config)
  const [municipal, setMunicipal] = useState(() => (config.feriadoMunicipal ? `${config.feriadoMunicipal.slice(3)}/${config.feriadoMunicipal.slice(0, 2)}` : ""))
  const gravar = async () => {
    const feriadoMunicipal = municipal.trim() ? lerDiaMes(municipal) : ""
    if (municipal.trim() && !feriadoMunicipal) return toast({ title: "Feriado municipal invalido", description: "Escreva dia/mes, ex.: 13/06.", variant: "destructive" })
    try {
      await guardarConfigPonto({
        ...c,
        carnaval: !!c.carnaval,
        feriadoMunicipal,
        nomeFeriadoMunicipal: (c.nomeFeriadoMunicipal || "").trim(),
        raioMetros: Math.max(50, Number(c.raioMetros) || 300),
        diasFerias: Math.max(0, Number(c.diasFerias) || 22),
        horasDia: Math.max(1, Number(c.horasDia) || 8),
      })
      toast({ title: "Configuracao gravada" })
      await aoMudar()
    } catch (e) {
      toast({ title: "Nao foi possivel gravar", description: e instanceof Error ? e.message : String(e), variant: "destructive" })
    }
  }
  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle className="text-lg">Configuracao do ponto</CardTitle>
        <CardDescription>Vale para toda a empresa.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1">
          <Label>Como se confirma o local da entrada</Label>
          <Select value={c.validacao} onValueChange={(v) => setC({ ...c, validacao: v as ConfigPonto["validacao"] })}>
            <SelectTrigger aria-label="Validacao do local">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(NOMES_VALIDACAO) as ConfigPonto["validacao"][]).map((v) => (
                <SelectItem key={v} value={v}>
                  {NOMES_VALIDACAO[v]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            O GPS so e lido no momento da picagem, nunca a seguir. Informe os trabalhadores (RGPD). Sem local definido na obra, o GPS nao deixa entrar.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="raio">Raio do GPS (m)</Label>
            <Input id="raio" type="number" min={50} step={50} value={c.raioMetros} onChange={(e) => setC({ ...c, raioMetros: Number(e.target.value) })} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="limite">Em falta se nao picou ate</Label>
            <Input id="limite" type="time" value={c.horaLimiteEntrada} onChange={(e) => setC({ ...c, horaLimiteEntrada: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="dias-ferias">Dias de ferias por ano</Label>
            <Input id="dias-ferias" type="number" min={0} value={c.diasFerias} onChange={(e) => setC({ ...c, diasFerias: Number(e.target.value) })} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="horas-dia">Horas de trabalho por dia</Label>
            <Input id="horas-dia" type="number" min={1} step={0.5} value={c.horasDia} onChange={(e) => setC({ ...c, horasDia: Number(e.target.value) })} />
          </div>
        </div>
        <div className="space-y-3 rounded-lg border p-3">
          <div>
            <Label>Feriados que a empresa da</Label>
            <p className="text-xs text-muted-foreground">
              Facultativos (art. 235.º CT): so contam se estiverem no contrato coletivo ou nos contratos. Nao contam como dias de ferias e aparecem no mapa.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Switch id="carnaval" checked={!!c.carnaval} onCheckedChange={(v) => setC({ ...c, carnaval: v })} />
            <Label htmlFor="carnaval" className="font-normal">
              Terca-feira de Carnaval
            </Label>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="municipal-dia">Feriado municipal (dia/mes)</Label>
              <Input id="municipal-dia" placeholder="ex.: 13/06" value={municipal} onChange={(e) => setMunicipal(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="municipal-nome">Nome</Label>
              <Input id="municipal-nome" placeholder="ex.: Santo Antonio (Lisboa)" value={c.nomeFeriadoMunicipal || ""} onChange={(e) => setC({ ...c, nomeFeriadoMunicipal: e.target.value })} />
            </div>
          </div>
        </div>
        <Button className="rounded-full" onClick={gravar}>
          Gravar
        </Button>
      </CardContent>
    </Card>
  )
}
