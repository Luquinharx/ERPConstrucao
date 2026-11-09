"use client"

import { Fragment, useMemo, useState } from "react"
import QRCode from "qrcode"
import { Ban, Check, Copy, Download, KeyRound, LocateFixed, Plus, Printer, QrCode, Send, Trash2, X } from "lucide-react"

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
import { idiomaAtual, m, t } from "@/lib/i18n"
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
  eliminarPedidos,
  eliminarPicagens,
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
  d.estado === "a_trabalhar" ? t("A trabalhar") : d.estado === "em_pausa" ? t("Em pausa") : d.estado === "saiu" ? t("Saiu") : t("Sem picagem")

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
    [t("A trabalhar"), conta((l) => l.dia.estado === "a_trabalhar"), "text-emerald-700"],
    [t("Em pausa"), conta((l) => l.dia.estado === "em_pausa"), "text-amber-700"],
    [t("Já saíram"), conta((l) => l.dia.estado === "saiu"), ""],
    [t("Férias / falta"), conta((l) => !!l.pedido), ""],
    [passouLimite ? t("Sem picagem") : t("Sem picagem (depois das {hora})", { hora: config.horaLimiteEntrada }), conta((l) => l.emFalta), "text-rose-700"],
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
      {!util && (
        <p className="text-sm text-muted-foreground">
          {feriadosPT(agora.getFullYear(), config).get(hoje)
            ? t("Hoje não é dia útil ({feriado}): ninguém fica em falta.", { feriado: feriadosPT(agora.getFullYear(), config).get(hoje) })
            : t("Hoje não é dia útil: ninguém fica em falta.")}
        </p>
      )}
      <Card>
        <CardContent className="pt-4">
          <Table data-testid="tabela-hoje">
            <TableHeader>
              <TableRow>
                <TableHead>{t("Trabalhador")}</TableHead>
                <TableHead>{t("Estado")}</TableHead>
                <TableHead>{t("Hora de entrada")}</TableHead>
                <TableHead>{t("Obra")}</TableHead>
                <TableHead className="text-right">{t("Trabalho")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {linhas.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                    {t("Ninguém com acesso à picagem. Crie os acessos no separador Acessos.")}
                  </TableCell>
                </TableRow>
              )}
              {linhas.map(({ p, dia, pedido, emFalta }) => (
                <TableRow key={p.funcionarioId} className={emFalta ? "bg-rose-50 dark:bg-rose-950/30" : ""}>
                  <TableCell>
                    <div className="font-medium">{p.nome}</div>
                    <div className="text-xs text-muted-foreground">{t("n.º {numero}", { numero: p.numero || "-" })}</div>
                  </TableCell>
                  <TableCell className="space-x-1">
                    {/* Uma falta de parte do dia (consulta) nao esconde que esta a trabalhar */}
                    {pedido && (
                      <Badge variant="outline" className={CORES_ESTADO[pedido.estado]}>
                        {pedido.tipo === "ferias" ? t("Férias") : nomeMotivoFalta(pedido.motivoFalta)}
                        {pedido.estado === "pendente" ? ` ${t("(por aprovar)")}` : ""}
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
                        {emFalta ? t("Ausente") : rotuloEstado(dia)}
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

export function PainelPedidos({
  pedidos,
  gestor,
  aoMudar,
  podeApagar = false,
}: {
  pedidos: PedidoPonto[]
  gestor: Gestor
  aoMudar: () => Promise<void>
  /** Administrador: pode eliminar pedidos e limpar o histórico. */
  podeApagar?: boolean
}) {
  const [resposta, setResposta] = useState<Record<string, string>>({})
  const [aDecidir, setADecidir] = useState("")
  const [aEliminar, setAEliminar] = useState(false)

  const eliminar = async (ids: string[], pergunta: string) => {
    if (ids.length === 0 || !confirm(pergunta)) return
    setAEliminar(true)
    try {
      await eliminarPedidos(ids)
      toast({ title: ids.length === 1 ? t("Pedido eliminado") : t("{n} pedidos eliminados", { n: ids.length }) })
      await aoMudar()
    } catch (e) {
      toast({ title: t("Não foi possível eliminar"), description: e instanceof Error ? e.message : String(e), variant: "destructive" })
    } finally {
      setAEliminar(false)
    }
  }
  const pendentes = pedidos.filter((p) => p.estado === "pendente").sort((a, b) => (a.createdAt?.getTime() || 0) - (b.createdAt?.getTime() || 0))
  const decididosTodos = pedidos.filter((p) => p.estado !== "pendente")
  const outros = pedidos
    .filter((p) => p.estado !== "pendente")
    .sort((a, b) => (b.decididoEm?.getTime() || b.createdAt?.getTime() || 0) - (a.decididoEm?.getTime() || a.createdAt?.getTime() || 0))
    .slice(0, 40)

  const decidir = async (p: PedidoPonto, aprovar: boolean) => {
    setADecidir(p.id!)
    try {
      await decidirPedido(p, aprovar, gestor, (resposta[p.id!] || "").trim())
      toast({ title: aprovar ? t("Pedido aprovado") : t("Pedido recusado") })
      await aoMudar()
    } catch (e) {
      toast({ title: t("Não foi possível guardar"), description: e instanceof Error ? e.message : String(e), variant: "destructive" })
    } finally {
      setADecidir("")
    }
  }

  const descricao = (p: PedidoPonto) => {
    if (p.tipo === "correcao" && p.correcao)
      return (
        t("Correção: {tipo} às {hora} de {data}", { tipo: t(NOMES_PICAGEM[p.correcao.tipo]), hora: p.correcao.hora, data: formatDate(p.correcao.dia) }) +
        (p.correcao.orcamentoNumero ? ` (${p.correcao.orcamentoNumero})` : "")
      )
    const periodo = p.fim && p.fim !== p.inicio ? t("{inicio} a {fim}", { inicio: formatDate(p.inicio!), fim: formatDate(p.fim) }) : formatDate(p.inicio!)
    if (p.tipo === "ferias")
      return p.diasUteis === 1
        ? t("Férias: {periodo} · {n} dia útil", { periodo, n: p.diasUteis })
        : t("Férias: {periodo} · {n} dias úteis", { periodo, n: p.diasUteis ?? 0 })
    return t("Falta: {motivo} · {periodo}", { motivo: nomeMotivoFalta(p.motivoFalta), periodo }) + (p.horas ? ` · ${p.horas} h` : "")
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t("Por decidir ({n})", { n: pendentes.length })}</CardTitle>
          <CardDescription>{t("Aprovado fica verde na app do trabalhador. Uma correção aprovada cria a picagem em falta.")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2" data-testid="pedidos-pendentes">
          {pendentes.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">{t("Nada por decidir.")}</p>}
          {pendentes.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center gap-3 rounded-lg border p-3">
              <div className="min-w-[220px] flex-1">
                <div className="font-medium">{p.funcionarioNome}</div>
                <div className="text-sm">{descricao(p)}</div>
                {p.observacoes && <div className="text-xs text-muted-foreground">&ldquo;{p.observacoes}&rdquo;</div>}
              </div>
              <Input
                placeholder={t("Resposta (opcional)")}
                value={resposta[p.id!] || ""}
                onChange={(e) => setResposta({ ...resposta, [p.id!]: e.target.value })}
                className="w-56"
              />
              <Button size="sm" className="rounded-full" disabled={aDecidir === p.id} onClick={() => decidir(p, true)}>
                <Check className="mr-1 h-3 w-3" />
                {t("Aprovar")}
              </Button>
              <Button size="sm" variant="outline" className="rounded-full" disabled={aDecidir === p.id} onClick={() => decidir(p, false)}>
                <X className="mr-1 h-3 w-3" />
                {t("Recusar")}
              </Button>
              {podeApagar && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="rounded-full text-muted-foreground hover:text-destructive"
                  disabled={aEliminar}
                  onClick={() => eliminar([p.id!], t("Eliminar este pedido de vez?"))}
                  aria-label={t("Eliminar pedido")}
                  title={t("Eliminar pedido")}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-lg">{t("Decididos")}</CardTitle>
            {podeApagar && decididosTodos.length > 0 && (
              <Button
                size="sm"
                variant="outline"
                className="rounded-full text-destructive"
                disabled={aEliminar}
                data-testid="limpar-decididos"
                onClick={() =>
                  eliminar(
                    decididosTodos.map((p) => p.id!),
                    t("Eliminar os {n} pedidos já decididos? Os pendentes ficam. Não se pode desfazer.", { n: decididosTodos.length }),
                  )
                }
              >
                <Trash2 className="mr-1 h-3 w-3" />
                {t("Limpar decididos")}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {outros.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">{t("Ainda nenhum.")}</p>}
          {outros.map((p) => (
            <div key={p.id} className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border p-2 text-sm ${CORES_ESTADO[p.estado]}`}>
              <span>
                <span className="font-medium">{p.funcionarioNome}</span> · {descricao(p)}
              </span>
              <span className="flex items-center gap-2 text-xs">
                {p.decididoPor ? t("{estado} por {quem}", { estado: t(NOMES_ESTADO[p.estado]), quem: p.decididoPor }) : t(NOMES_ESTADO[p.estado])}
                {podeApagar && (
                  <button
                    type="button"
                    className="rounded-full p-1 opacity-70 hover:bg-background/60 hover:opacity-100"
                    disabled={aEliminar}
                    onClick={() => eliminar([p.id!], t("Eliminar este pedido de vez?"))}
                    aria-label={t("Eliminar pedido")}
                    title={t("Eliminar pedido")}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
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
  podeApagar = false,
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
  /** Administrador: pode eliminar picagens (ex.: registos de teste). */
  podeApagar?: boolean
}) {
  const [quem, setQuem] = useState(pessoas[0]?.funcionarioId || "")

  /** Eliminar de vez, com confirmação (a lei pede que o registo de tempos se guarde). */
  const eliminar = async (alvo: Picagem[], pergunta: string) => {
    if (alvo.length === 0 || !confirm(pergunta)) return
    try {
      await eliminarPicagens(alvo, picagens)
      toast({ title: alvo.length === 1 ? t("Picagem eliminada") : t("{n} picagens eliminadas", { n: alvo.length }) })
      await aoMudar()
    } catch (e) {
      toast({ title: t("Não foi possível eliminar"), description: e instanceof Error ? e.message : String(e), variant: "destructive" })
    }
  }
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
    const linhas = [[t("Trabalhador"), t("N.º"), t("Dia"), t("Hora de entrada"), t("Hora de saída"), t("Pausa"), t("Trabalho (h)"), t("Obras"), t("Ocorrências")]]
    for (const p of pessoas) {
      const pedidosDele = pedidos.filter((x) => x.funcionarioId === p.funcionarioId)
      for (const d of lidosDe(p.funcionarioId)) {
        const pedido = pedidoNoDia(pedidosDele, d.dia)
        if (d.picagens.length === 0 && !pedido) continue
        const ocorrencias = [
          d.incompleto && d.dia !== hoje ? t("Falta picar") : "",
          d.picagens.some((x) => x.origem === "correcao") ? t("Corrigida") : "",
          pedido ? `${pedido.tipo === "ferias" ? t("Férias") : nomeMotivoFalta(pedido.motivoFalta)} (${t(NOMES_ESTADO[pedido.estado])})` : "",
        ].filter(Boolean)
        linhas.push([
          p.nome,
          p.numero,
          formatDate(d.dia),
          formatarHora(d.primeiraEntrada),
          formatarHora(d.ultimaSaida),
          formatarMinutos(d.minutosPausa),
          idiomaAtual() === "en" ? String(round2(d.minutosTrabalho / 60)) : String(round2(d.minutosTrabalho / 60)).replace(".", ","),
          [...new Set(d.segmentos.map((s) => s.orcamentoNumero).filter(Boolean))].join(" "),
          ocorrencias.join(" / "),
        ])
      }
    }
    const csv = "﻿" + linhas.map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\r\n")
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }))
    const a = document.createElement("a")
    a.href = url
    a.download = t("registo-tempos-{mes}.csv", { mes })
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
            observacoes: t("Vindo das picagens"),
          })
        }
      }
    }
    if (linhas.length === 0) return toast({ title: t("Nada para enviar"), description: t("Não há dias fechados com obra neste mês.") })
    setAEnviar(true)
    try {
      const r = await enviarParaLivroDePonto(linhas)
      toast({
        title: r.criados === 1 ? t("{n} registo enviado para o Livro de ponto", { n: r.criados }) : t("{n} registos enviados para o Livro de ponto", { n: r.criados }),
        description: r.ignorados
          ? t("{n} já estavam aprovados e não mudaram. Ficam pendentes até serem aprovados.", { n: r.ignorados })
          : t("Ficam pendentes até serem aprovados."),
      })
    } catch (e) {
      toast({ title: t("Não foi possível enviar"), description: e instanceof Error ? e.message : String(e), variant: "destructive" })
    } finally {
      setAEnviar(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="text-lg">{t("Registo de tempos")}</CardTitle>
            <CardDescription>
              {t("Art. 202.º do Código do Trabalho: início, fim e intervalos de cada dia. As picagens não se apagam: corrige-se ou anula-se, com motivo.")}
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2 print:hidden">
            <Input type="month" value={mes} onChange={(e) => e.target.value && setMes(e.target.value)} className="w-40" aria-label={t("Mês dos registos")} />
            <Button variant="outline" className="rounded-full" onClick={exportarCSV}>
              <Download className="mr-2 h-4 w-4" />
              {t("Exportar mês (CSV)")}
            </Button>
            <Button variant="outline" className="rounded-full" onClick={() => window.print()}>
              <Printer className="mr-2 h-4 w-4" />
              {t("Imprimir")}
            </Button>
            {podeEnviarHoras && (
              <Button className="rounded-full" onClick={enviarHoras} disabled={aEnviar}>
                <Send className="mr-2 h-4 w-4" />
                {t("Enviar horas para o Livro de ponto")}
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-3 print:hidden">
          <Select value={quem} onValueChange={setQuem}>
            <SelectTrigger className="w-72" aria-label={t("Trabalhador")}>
              <SelectValue placeholder={t("Trabalhador")} />
            </SelectTrigger>
            <SelectContent>
              {pessoas.map((p) => (
                <SelectItem key={p.funcionarioId} value={p.funcionarioId}>
                  {p.nome}
                  {p.numero ? ` ${t("(n.º {numero})", { numero: p.numero })}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-sm">
            {t("Total do mês:")} <strong>{formatarMinutos(total)}</strong>
          </span>
        </div>
        <div className="hidden print:block">
          <strong>{pessoa?.nome}</strong> · {t("n.º {numero}", { numero: pessoa?.numero })} · {mes} · {t("total {tempo}", { tempo: formatarMinutos(total) })}
        </div>
        <Table data-testid="tabela-registos">
          <TableHeader>
            <TableRow>
              <TableHead>{t("Dia")}</TableHead>
              <TableHead>{t("Hora de entrada")}</TableHead>
              <TableHead>{t("Hora de saída")}</TableHead>
              <TableHead>{t("Pausa")}</TableHead>
              <TableHead>{t("Trabalho")}</TableHead>
              <TableHead>{t("Obras")}</TableHead>
              <TableHead>{t("Ocorrências")}</TableHead>
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
                      {d.incompleto && d.dia !== hoje && <Badge variant="outline" className="border-rose-300 text-rose-700 dark:border-rose-500/60 dark:text-rose-400">{t("Falta picar")}</Badge>}
                      {d.picagens.some((p) => p.origem === "correcao") && <Badge variant="outline">{t("Corrigida")}</Badge>}
                      {pedido && (
                        <Badge variant="outline" className={CORES_ESTADO[pedido.estado]}>
                          {pedido.tipo === "ferias" ? t("Férias") : nomeMotivoFalta(pedido.motivoFalta)}
                        </Badge>
                      )}
                      {util && d.picagens.length === 0 && !pedido && d.dia !== hoje && <Badge variant="outline" className="border-rose-300 text-rose-700 dark:border-rose-500/60 dark:text-rose-400">{t("Sem registo")}</Badge>}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-right print:hidden">
                      <Button size="sm" variant="ghost" onClick={() => setAberto(aberto === d.dia ? "" : d.dia)}>
                        {aberto === d.dia ? t("Fechar") : t("Detalhe")}
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
                                {p.origem === "anulacao" ? t("Anulação ({motivo})", { motivo: p.motivo }) : t(NOMES_PICAGEM[p.tipo])}
                                {p.orcamentoNumero ? ` · ${p.orcamentoNumero}` : ""}
                                <span className="text-xs text-muted-foreground">
                                  {p.origem === "correcao" ? ` · ${t("correção de {quem}: {motivo}", { quem: p.feitaPor, motivo: p.motivo })}` : ""}
                                  {p.origem === "app"
                                    ? ` · ${p.metodo === "qr" ? t("app (QR)") : p.metodo === "gps" ? t("app (GPS a {distancia} m)", { distancia: p.gps?.distancia ?? "?" }) : t("app")}`
                                    : ""}
                                </span>
                              </span>
                              {p.origem !== "anulacao" && !anuladas.has(p.id) && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-destructive"
                                  onClick={async () => {
                                    const motivo = prompt(t("Motivo da anulação (fica no registo):"))
                                    if (!motivo?.trim()) return
                                    await anularPicagem(p, motivo.trim(), gestor)
                                    await aoMudar()
                                  }}
                                >
                                  <Ban className="mr-1 h-3 w-3" />
                                  {t("Anular")}
                                </Button>
                              )}
                              {podeApagar && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-destructive"
                                  onClick={() => eliminar([p], t("Eliminar esta picagem de vez? Não fica nenhum registo dela."))}
                                  aria-label={t("Eliminar picagem")}
                                >
                                  <Trash2 className="mr-1 h-3 w-3" />
                                  {t("Eliminar")}
                                </Button>
                              )}
                            </li>
                          ))}
                        </ul>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <Button size="sm" variant="outline" className="rounded-full" onClick={() => setCorrigir({ dia: d.dia })}>
                            <Plus className="mr-1 h-3 w-3" />
                            {t("Acrescentar picagem")}
                          </Button>
                          {podeApagar && todasDoDia.length > 0 && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="rounded-full text-destructive"
                              data-testid="eliminar-dia"
                              onClick={() =>
                                eliminar(
                                  todasDoDia,
                                  t("Eliminar as {n} picagens de {dia}? O dia fica sem registo. Não se pode desfazer.", { n: todasDoDia.length, dia: formatDate(d.dia) }),
                                )
                              }
                            >
                              <Trash2 className="mr-1 h-3 w-3" />
                              {t("Eliminar picagens deste dia")}
                            </Button>
                          )}
                        </div>
                        {podeApagar && (
                          <p className="mt-2 text-xs text-muted-foreground">
                            {t("Eliminar é só para registos errados ou de teste: o Código do Trabalho pede que o registo de tempos se guarde. Para corrigir um dia real, use Anular ou Acrescentar picagem.")}
                          </p>
                        )}
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
    if (!dia || !pessoa || !hora || !motivo.trim()) return toast({ title: t("Indique a hora e o motivo"), variant: "destructive" })
    if (!uidTrabalhador) return toast({ title: t("Este trabalhador ainda não tem acesso à picagem"), variant: "destructive" })
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
    toast({ title: t("Picagem acrescentada"), description: t("Fica marcada como correção, com o seu nome e o motivo.") })
    setHora("")
    setMotivo("")
    aoFechar()
    await aoGravar()
  }
  return (
    <Dialog open={!!dia} onOpenChange={(a) => !a && aoFechar()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("Acrescentar picagem")}</DialogTitle>
          <DialogDescription>
            {pessoa?.nome} · {dia ? formatDate(dia) : ""}. {t("Fica no registo como correção sua, com o motivo.")}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Select value={tipo} onValueChange={(v) => setTipo(v as TipoPicagem)}>
              <SelectTrigger aria-label={t("Tipo")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(NOMES_PICAGEM) as TipoPicagem[]).map((tp) => (
                  <SelectItem key={tp} value={tp}>
                    {t(NOMES_PICAGEM[tp])}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input type="time" value={hora} onChange={(e) => setHora(e.target.value)} aria-label={t("Hora")} />
          </div>
          {tipo === "entrada" && (
            <Select value={obraId} onValueChange={setObraId}>
              <SelectTrigger aria-label={t("Obra")}>
                <SelectValue placeholder={t("Obra")} />
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
          <Input placeholder={t("Motivo (obrigatório)")} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          <Button className="w-full rounded-full" onClick={gravar}>
            {t("Guardar")}
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
      toast({ title: t("Acesso criado"), description: t("{nome}: n.º {numero} + PIN {pin}", { nome: alvo.nome, numero: normalizarNumero(alvo.numero), pin }) })
      setAlvo(null)
      setPin("")
      await aoMudar()
    } catch (e) {
      toast({ title: t("Não foi possível criar o acesso"), description: e instanceof Error ? e.message : String(e), variant: "destructive" })
    } finally {
      setAGravar(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{t("Acessos à picagem")}</CardTitle>
        <CardDescription>
          {t("Cada trabalhador entra com o n.º de funcionário e um PIN de 4 a 6 dígitos. Só vê as suas picagens e pedidos. Link para enviar:")}{" "}
          <button
            type="button"
            className="inline-flex items-center gap-1 font-medium text-primary underline"
            onClick={() => {
              void navigator.clipboard?.writeText(link)
              toast({ title: t("Link copiado"), description: link })
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
              <TableHead>{t("Funcionário")}</TableHead>
              <TableHead>{t("N.º")}</TableHead>
              <TableHead>{t("Acesso")}</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {pessoas.map((p) => (
              <TableRow key={p.funcionarioId} data-testid="linha-acesso">
                <TableCell className="font-medium">{p.nome}</TableCell>
                <TableCell>{p.numero || <span className="text-xs text-rose-700">{t("sem número na ficha")}</span>}</TableCell>
                <TableCell>
                  {p.acesso ? (
                    <Badge variant="outline" className={p.acesso.ativo ? "border-emerald-400 text-emerald-700" : "text-muted-foreground"}>
                      {p.acesso.ativo ? t("Ativo") : t("Desativado")}
                    </Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">{t("Sem acesso")}</span>
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
                      {p.acesso ? t("Novo PIN") : t("Criar acesso")}
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
                      {p.acesso.ativo ? t("Desativar") : t("Reativar")}
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {!podeCriar && <p className="mt-3 text-xs text-muted-foreground">{t("Para criar acessos é preciso poder ver os funcionários.")}</p>}
      </CardContent>
      <Dialog open={!!alvo} onOpenChange={(a) => !a && setAlvo(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{alvo?.acesso ? t("Novo PIN") : t("Criar acesso")}</DialogTitle>
            <DialogDescription>
              {t("{nome} entra com o n.º {numero} e este PIN. Pode mudá-lo depois na app.", { nome: alvo?.nome })
                .split("{numero}")
                .map((parte, i) => (
                  <Fragment key={i}>
                    {i > 0 && <strong>{alvo ? normalizarNumero(alvo.numero) : ""}</strong>}
                    {parte}
                  </Fragment>
                ))}
              {alvo?.acesso ? ` ${t("O PIN antigo deixa de funcionar.")}` : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Label htmlFor="novo-pin">{t("PIN (4 a 6 dígitos)")}</Label>
            <Input id="novo-pin" inputMode="numeric" maxLength={6} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} className="text-center text-2xl tracking-[0.4em]" />
            <Button className="w-full rounded-full" onClick={gravar} disabled={aGravar}>
              {aGravar ? t("A criar...") : t("Guardar")}
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
      toast({ title: t("Não foi possível guardar"), description: e instanceof Error ? e.message : String(e), variant: "destructive" })
    }
  }

  const imprimirQR = async (o: ObraPonto) => {
    const url = await QRCode.toDataURL(codigoQRObra(o.id!, o.tokenQR), { margin: 1, width: 600 })
    const janela = window.open("", "_blank", "width=700,height=900")
    if (!janela) return toast({ title: t("Desbloqueie os popups para imprimir"), variant: "destructive" })
    const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    janela.document.write(`<!doctype html><html lang="${idiomaAtual()}"><head><meta charset="utf-8"><title>QR ${o.numero}</title>
      <style>body{font-family:Arial,sans-serif;text-align:center;padding:30px}h1{font-size:34px;margin:0}h2{font-weight:normal;margin:6px 0 20px}img{width:420px;height:420px}p{font-size:18px}</style></head>
      <body><h1>${esc(t("Picagem de ponto"))}</h1><h2>${o.numero} · ${o.nome.replace(/</g, "&lt;")}</h2><img src="${url}" alt="QR"/><p>${esc(t("Abra a app, toque em «{botao}» e aponte a câmara.", { botao: t("Entrar a ler o QR da obra") }))}</p></body></html>`)
    janela.document.close()
    setTimeout(() => janela.print(), 400)
  }

  const usarLocalAtual = (id: string, base: { candidata?: ObraCandidata; ponto?: ObraPonto }) => {
    if (!navigator.geolocation) return toast({ title: t("Sem localização neste aparelho"), variant: "destructive" })
    navigator.geolocation.getCurrentPosition(
      (p) => void guardar(id, base, { local: { lat: p.coords.latitude, lng: p.coords.longitude } }),
      () => toast({ title: t("Autorize a localização no browser"), variant: "destructive" }),
      { enableHighAccuracy: true, timeout: 15000 },
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{t("Obras onde se pode picar")}</CardTitle>
        <CardDescription>
          {t("Validação atual:")} <strong>{t(NOMES_VALIDACAO[config.validacao])}</strong>.{" "}
          {t("Para o QR, imprima e afixe na obra. Para o GPS, defina o local: no sítio com «Usar a minha localização», ou cole as coordenadas do Google Maps.")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table data-testid="tabela-obras-ponto">
          <TableHeader>
            <TableRow>
              <TableHead>{t("Obra")}</TableHead>
              <TableHead>{t("Pode picar")}</TableHead>
              <TableHead>{t("Local (GPS)")}</TableHead>
              <TableHead>{t("Raio")}</TableHead>
              <TableHead>QR</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lista.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  {t("Ainda não há obras adjudicadas.")}
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
                      aria-label={t("Pode picar em {obra}", { obra: base.candidata?.numero || o?.numero })}
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
                        placeholder={t("38.72, -9.13 ou link do Maps")}
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
                          if (!c) return toast({ title: t("Coordenadas inválidas"), description: t("Ex.: 38.7223, -9.1393"), variant: "destructive" })
                          void guardar(id, base, { local: c })
                          setCoords({ ...coords, [id]: "" })
                        }}
                      >
                        OK
                      </Button>
                      <Button size="sm" variant="ghost" className="h-8" title={t("Usar a minha localização")} onClick={() => usarLocalAtual(id, base)}>
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
                      aria-label={t("Raio em metros")}
                    />
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {o && (
                      <>
                        <Button size="sm" variant="outline" className="rounded-full" onClick={() => imprimirQR(o)}>
                          <QrCode className="mr-1 h-3 w-3" />
                          {t("Imprimir")}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          title={t("Gerar QR novo (o antigo deixa de valer)")}
                          onClick={() => {
                            if (confirm(t("Gerar um QR novo? O QR afixado deixa de funcionar."))) void guardar(id, base, { tokenQR: novoToken() })
                          }}
                        >
                          {t("Novo QR")}
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
  livre: m("Livre (escolhe a obra na lista)"),
  qr: m("Só QR afixado na obra"),
  gps: m("Só GPS (perto da obra)"),
  qr_ou_gps: m("QR ou GPS"),
}

export function PainelConfig({ config, aoMudar }: { config: ConfigPonto; aoMudar: () => Promise<void> }) {
  const [c, setC] = useState(config)
  const [municipal, setMunicipal] = useState(() => (config.feriadoMunicipal ? `${config.feriadoMunicipal.slice(3)}/${config.feriadoMunicipal.slice(0, 2)}` : ""))
  const gravar = async () => {
    const feriadoMunicipal = municipal.trim() ? lerDiaMes(municipal) : ""
    if (municipal.trim() && !feriadoMunicipal) return toast({ title: t("Feriado municipal inválido"), description: t("Escreva dia/mês, ex.: 13/06."), variant: "destructive" })
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
      toast({ title: t("Configuração guardada") })
      await aoMudar()
    } catch (e) {
      toast({ title: t("Não foi possível guardar"), description: e instanceof Error ? e.message : String(e), variant: "destructive" })
    }
  }
  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle className="text-lg">{t("Configuração do ponto")}</CardTitle>
        <CardDescription>{t("Vale para toda a empresa.")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1">
          <Label>{t("Como se confirma o local da entrada")}</Label>
          <Select value={c.validacao} onValueChange={(v) => setC({ ...c, validacao: v as ConfigPonto["validacao"] })}>
            <SelectTrigger aria-label={t("Validação do local")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(NOMES_VALIDACAO) as ConfigPonto["validacao"][]).map((v) => (
                <SelectItem key={v} value={v}>
                  {t(NOMES_VALIDACAO[v])}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {t("O GPS só é lido no momento da picagem, nunca a seguir. Informe os trabalhadores (RGPD). Sem local definido na obra, o GPS não deixa entrar.")}
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="raio">{t("Raio do GPS (m)")}</Label>
            <Input id="raio" type="number" min={50} step={50} value={c.raioMetros} onChange={(e) => setC({ ...c, raioMetros: Number(e.target.value) })} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="limite">{t("Em falta se não picou até")}</Label>
            <Input id="limite" type="time" value={c.horaLimiteEntrada} onChange={(e) => setC({ ...c, horaLimiteEntrada: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="dias-ferias">{t("Dias de férias por ano")}</Label>
            <Input id="dias-ferias" type="number" min={0} value={c.diasFerias} onChange={(e) => setC({ ...c, diasFerias: Number(e.target.value) })} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="horas-dia">{t("Horas de trabalho por dia")}</Label>
            <Input id="horas-dia" type="number" min={1} step={0.5} value={c.horasDia} onChange={(e) => setC({ ...c, horasDia: Number(e.target.value) })} />
          </div>
        </div>
        <div className="space-y-3 rounded-lg border p-3">
          <div>
            <Label>{t("Feriados que a empresa dá")}</Label>
            <p className="text-xs text-muted-foreground">
              {t("Facultativos (art. 235.º CT): só contam se estiverem no contrato coletivo ou nos contratos. Não contam como dias de férias e aparecem no mapa.")}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Switch id="carnaval" checked={!!c.carnaval} onCheckedChange={(v) => setC({ ...c, carnaval: v })} />
            <Label htmlFor="carnaval" className="font-normal">
              {t("Terça-feira de Carnaval")}
            </Label>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="municipal-dia">{t("Feriado municipal (dia/mês)")}</Label>
              <Input id="municipal-dia" placeholder={t("ex.: 13/06")} value={municipal} onChange={(e) => setMunicipal(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="municipal-nome">{t("Nome")}</Label>
              <Input id="municipal-nome" placeholder={t("ex.: Santo António (Lisboa)")} value={c.nomeFeriadoMunicipal || ""} onChange={(e) => setC({ ...c, nomeFeriadoMunicipal: e.target.value })} />
            </div>
          </div>
        </div>
        <Button className="rounded-full" onClick={gravar}>
          {t("Guardar")}
        </Button>
      </CardContent>
    </Card>
  )
}
