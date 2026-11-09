"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Coffee, KeyRound, LogIn, LogOut, MapPin, Play, RefreshCw } from "lucide-react"

import { LeitorQR } from "@/components/ponto/leitor-qr"
import { SeletorIdioma } from "@/components/seletor-idioma"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/hooks/use-auth"
import { usePermissoes } from "@/hooks/use-permissoes"
import { toast } from "@/hooks/use-toast"
import { localeIntl, t } from "@/lib/i18n"
import {
  CONFIG_PONTO_PADRAO,
  CORES_ESTADO,
  NOMES_ESTADO,
  MOTIVOS_FALTA,
  NOMES_PICAGEM,
  acoesPossiveis,
  diaLocal,
  diasDoPeriodo,
  diasUteis,
  distanciaMetros,
  formatarHora,
  formatarMinutos,
  lerCodigoQRObra,
  lerDia,
  nomeMotivoFalta,
  pedidoNoDia,
  pinValido,
  saldoFerias,
  senhaDoPin,
} from "@/lib/ponto"
import {
  cancelarPedido,
  criarPedido,
  getConfigPonto,
  getMeusPedidos,
  getMinhasPicagens,
  getObrasPonto,
  picar,
} from "@/lib/ponto-service"
import type { ConfigPonto, ObraPonto, PedidoPonto, Picagem, TipoPicagem } from "@/lib/types"
import { formatDate } from "@/lib/utils"

const SEM_OBRA = "__sem_obra"

function obterPosicao(): Promise<{ lat: number; lng: number; precisao: number }> {
  return new Promise((resolver, rejeitar) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return rejeitar(new Error(t("Este aparelho não tem localização.")))
    navigator.geolocation.getCurrentPosition(
      (p) => resolver({ lat: p.coords.latitude, lng: p.coords.longitude, precisao: Math.round(p.coords.accuracy) }),
      (e) =>
        rejeitar(
          new Error(e.code === 1 ? t("Autorize a localização no browser para picar nesta obra.") : t("Não foi possível obter a localização. Tente de novo.")),
        ),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    )
  })
}

/**
 * Picagem do trabalhador: entrada, pausa, saida, e os pedidos de ferias,
 * faltas e correcoes. So ve os seus dados (as regras do Firestore garantem-no).
 */
export default function PicagemPage() {
  const { user, updateUserPassword } = useAuth()
  const { perfil } = usePermissoes()
  const [config, setConfig] = useState<ConfigPonto>(CONFIG_PONTO_PADRAO)
  const [obras, setObras] = useState<ObraPonto[]>([])
  const [picagens, setPicagens] = useState<Picagem[]>([])
  const [pedidos, setPedidos] = useState<PedidoPonto[]>([])
  const [aCarregar, setACarregar] = useState(true)
  const [aPicar, setAPicar] = useState(false)
  const [obraId, setObraId] = useState("")
  const [agora, setAgora] = useState(() => new Date())
  const [mudarPin, setMudarPin] = useState(false)

  const funcionarioId = perfil?.funcionarioId || ""
  const nome = perfil?.nome || ""

  const carregar = useCallback(async () => {
    if (!user) return
    try {
      const [c, o, p, r] = await Promise.all([
        getConfigPonto(),
        getObrasPonto().catch(() => [] as ObraPonto[]),
        getMinhasPicagens(user.uid),
        getMeusPedidos(user.uid),
      ])
      setConfig(c)
      setObras(o.filter((x) => x.ativa).sort((a, b) => a.numero.localeCompare(b.numero)))
      setPicagens(p)
      setPedidos(r.sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0)))
    } catch (e) {
      console.error(e)
      toast({ title: t("Não foi possível carregar"), description: t("Verifique a ligação à internet."), variant: "destructive" })
    } finally {
      setACarregar(false)
    }
  }, [user])
  useEffect(() => {
    void carregar()
  }, [carregar])
  useEffect(() => {
    const relogio = setInterval(() => setAgora(new Date()), 20000)
    return () => clearInterval(relogio)
  }, [])

  const hoje = diaLocal(agora)
  const dia = useMemo(() => lerDia(hoje, picagens, agora), [hoje, picagens, agora])
  const acoes = acoesPossiveis(dia.estado)
  const obraDoDia = obras.find((o) => o.id === dia.obraAtual?.orcamentoId)
  useEffect(() => {
    if (!obraId && dia.obraAtual?.orcamentoId) setObraId(dia.obraAtual.orcamentoId)
  }, [dia.obraAtual?.orcamentoId, obraId])

  /** Confirma o local da entrada conforme a configuracao. */
  const validarLocal = async (obra: ObraPonto | undefined): Promise<Pick<Picagem, "metodo" | "gps">> => {
    const v = config.validacao
    if (!obra) {
      if (v === "livre") return { metodo: "livre" }
      throw new Error(t("Escolha a obra."))
    }
    if (v === "livre") return { metodo: "livre" }
    if (v === "qr") throw new Error(t("Nesta empresa a entrada faz-se a ler o QR afixado na obra."))
    if (!obra.local) {
      throw new Error(
        v === "qr_ou_gps" ? t("Esta obra ainda não tem localização. Leia o QR da obra.") : t("Esta obra ainda não tem localização. Fale com o encarregado."),
      )
    }
    const pos = await obterPosicao()
    const distancia = distanciaMetros(pos, obra.local)
    const raio = obra.raio || config.raioMetros
    // A margem do proprio GPS conta a favor (ate 100 m), para nao barrar quem esta a porta
    if (distancia > raio + Math.min(pos.precisao, 100)) {
      throw new Error(
        v === "qr_ou_gps"
          ? t("Está a {distancia} m da obra (máximo {raio} m). Pode ler o QR da obra.", { distancia, raio })
          : t("Está a {distancia} m da obra (máximo {raio} m).", { distancia, raio }),
      )
    }
    return { metodo: "gps", gps: { ...pos, distancia } }
  }

  const registar = async (tipo: TipoPicagem, opcoes: { obra?: ObraPonto; viaQR?: boolean } = {}) => {
    if (!user || !funcionarioId) return
    setAPicar(true)
    try {
      let local: Pick<Picagem, "metodo" | "gps"> = { metodo: "livre" }
      let obra = opcoes.obra
      if (tipo === "entrada") {
        if (!obra && obraId && obraId !== SEM_OBRA) obra = obras.find((o) => o.id === obraId)
        local = opcoes.viaQR ? { metodo: "qr" } : await validarLocal(obra)
      } else if (tipo === "retoma") {
        obra = obraDoDia
      }
      await picar({
        uid: user.uid,
        funcionarioId,
        funcionarioNome: nome,
        tipo,
        orcamentoId: obra?.id || (tipo === "retoma" ? dia.obraAtual?.orcamentoId : "") || "",
        orcamentoNumero: obra?.numero || (tipo === "retoma" ? dia.obraAtual?.orcamentoNumero : "") || "",
        ...local,
      })
      if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(60)
      toast({ title: t("{tipo} registada", { tipo: t(NOMES_PICAGEM[tipo]) }), description: `${formatarHora(new Date())}${obra ? ` · ${obra.numero}` : ""}` })
      await carregar()
    } catch (e) {
      toast({ title: t("Não foi possível picar"), description: e instanceof Error ? e.message : String(e), variant: "destructive" })
    } finally {
      setAPicar(false)
    }
  }

  const lerQR = (texto: string) => {
    const lido = lerCodigoQRObra(texto)
    const obra = lido && obras.find((o) => o.id === lido.obraId)
    if (!lido || !obra) return toast({ title: t("QR desconhecido"), description: t("Não é um QR de obra deste sistema."), variant: "destructive" })
    if (obra.tokenQR !== lido.token) return toast({ title: t("QR antigo"), description: t("Este QR já não é válido. Peça o novo ao encarregado."), variant: "destructive" })
    setObraId(obra.id!)
    void registar("entrada", { obra, viaQR: true })
  }

  if (aCarregar) return <LoadingSpinner size="lg" />
  if (!funcionarioId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("Picagem")}</CardTitle>
          <CardDescription>
            {t("Esta conta não está ligada a um funcionário. A picagem faz-se com o n.º de funcionário e PIN, criados em Ponto da equipa > Acessos.")}
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const usaQR = config.validacao === "qr" || config.validacao === "qr_ou_gps"
  const mostraLista = config.validacao !== "qr"
  const estadoTexto =
    dia.estado === "a_trabalhar" ? t("A trabalhar") : dia.estado === "em_pausa" ? t("Em pausa") : dia.estado === "saiu" ? t("Saiu") : t("Ainda não entrou")
  const pedidoHoje = pedidoNoDia(pedidos, hoje)
  const primeiroNome = nome.split(" ")[0]
  const [hojeAntes, hojeDepois] = t("Hoje: {tempo} de trabalho").split("{tempo}")

  return (
    <div className="mx-auto max-w-xl space-y-4 animate-fade-in">
      {/* No telemovel o botao do menu fica no canto: o titulo comeca depois dele */}
      <div className="flex items-start justify-between gap-3 pl-12 lg:pl-0">
        <div>
          <h1 className="text-2xl font-bold">{primeiroNome ? t("Olá, {nome}", { nome: primeiroNome }) : t("Olá, bem-vindo")}</h1>
          <p className="text-sm text-muted-foreground">
            {agora.toLocaleDateString(localeIntl(), { weekday: "long", day: "numeric", month: "long" })}
          </p>
        </div>
        <div className="flex gap-1">
          <SeletorIdioma />
          <Button variant="ghost" size="icon" title={t("Atualizar")} onClick={() => void carregar()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" title={t("Mudar PIN")} onClick={() => setMudarPin(true)}>
            <KeyRound className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Card data-testid="cartao-picagem">
        <CardContent className="flex flex-col gap-4 pt-6">
          <div className="order-1 text-center">
            <div className="text-5xl font-bold tabular-nums">{formatarHora(agora)}</div>
            <div className="mt-2 flex items-center justify-center gap-2">
              <Badge
                variant="outline"
                className={
                  dia.estado === "a_trabalhar"
                    ? "border-emerald-400 text-emerald-700"
                    : dia.estado === "em_pausa"
                      ? "border-amber-400 text-amber-700"
                      : ""
                }
                data-testid="estado-ponto"
              >
                {estadoTexto}
              </Badge>
              {dia.obraAtual?.orcamentoNumero && dia.estado !== "saiu" && (
                <Badge variant="outline">
                  <MapPin className="mr-1 h-3 w-3" />
                  {dia.obraAtual.orcamentoNumero}
                </Badge>
              )}
            </div>
            <div className="mt-2 text-sm text-muted-foreground">
              {hojeAntes}
              <span className="font-medium text-foreground">{formatarMinutos(dia.minutosTrabalho)}</span>
              {hojeDepois}
              {dia.minutosPausa > 0 && <> · {t("{tempo} de pausa", { tempo: formatarMinutos(dia.minutosPausa) })}</>}
            </div>
            {pedidoHoje && (
              <div className="mt-2 text-xs text-muted-foreground">
                {t("Hoje tem {ausencia} ({estado}).", {
                  ausencia: pedidoHoje.tipo === "ferias" ? t("férias") : nomeMotivoFalta(pedidoHoje.motivoFalta).toLowerCase(),
                  estado: t(NOMES_ESTADO[pedidoHoje.estado]).toLowerCase(),
                })}
              </div>
            )}
          </div>

          {acoes.includes("entrada") && (
            // A trabalhar, Pausa/Sair vem primeiro e mudar de obra fica por baixo
            <div className={`space-y-2 ${dia.estado === "a_trabalhar" ? "order-3" : "order-2"}`}>
              {mostraLista && (
                <div className="space-y-1">
                  <Label>{dia.estado === "a_trabalhar" ? t("Mudar para outra obra") : t("Obra")}</Label>
                  <Select value={obraId} onValueChange={setObraId}>
                    <SelectTrigger className="rounded-full" aria-label={t("Obra")}>
                      <SelectValue placeholder={t("Escolha a obra")} />
                    </SelectTrigger>
                    <SelectContent>
                      {obras.map((o) => (
                        <SelectItem key={o.id} value={o.id!}>
                          {o.numero} · {o.nome}
                        </SelectItem>
                      ))}
                      {config.validacao === "livre" && <SelectItem value={SEM_OBRA}>{t("Sem obra (armazém / escritório)")}</SelectItem>}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {mostraLista && (
                <Button
                  // A trabalhar, o botao principal e o Sair: mudar de obra e secundario
                  variant={dia.estado === "a_trabalhar" ? "outline" : "default"}
                  className={dia.estado === "a_trabalhar" ? "w-full rounded-full" : "h-14 w-full rounded-full text-lg"}
                  disabled={aPicar || !obraId || (dia.estado === "a_trabalhar" && (obraId === SEM_OBRA ? "" : obraId) === (dia.obraAtual?.orcamentoId || ""))}
                  onClick={() => registar("entrada")}
                  data-testid="botao-entrada"
                >
                  <LogIn className={dia.estado === "a_trabalhar" ? "mr-2 h-4 w-4" : "mr-2 h-5 w-5"} />
                  {dia.estado === "a_trabalhar" ? t("Mudar de obra") : t("Picar entrada")}
                  {config.validacao !== "livre" && obraId && <span className="ml-2 text-xs opacity-80">{t("(confirma GPS)")}</span>}
                </Button>
              )}
              {usaQR && <LeitorQR onLer={lerQR} rotulo={dia.estado === "a_trabalhar" ? t("Ler QR de outra obra") : t("Entrar a ler o QR da obra")} />}
            </div>
          )}

          <div className={`grid grid-cols-2 gap-2 ${dia.estado === "a_trabalhar" ? "order-2" : "order-3"}`}>
            {acoes.includes("pausa") && (
              <Button variant="outline" className="h-12 rounded-full" disabled={aPicar} onClick={() => registar("pausa")}>
                <Coffee className="mr-2 h-4 w-4" />
                {t("Pausa")}
              </Button>
            )}
            {acoes.includes("retoma") && (
              <Button className="h-12 rounded-full" disabled={aPicar} onClick={() => registar("retoma")}>
                <Play className="mr-2 h-4 w-4" />
                {t("Voltar da pausa")}
              </Button>
            )}
            {acoes.includes("saida") && (
              <Button
                variant="destructive"
                className="h-12 rounded-full"
                disabled={aPicar}
                onClick={() => registar("saida")}
                data-testid="botao-saida"
              >
                <LogOut className="mr-2 h-4 w-4" />
                {t("Picar saída")}
              </Button>
            )}
          </div>

          {dia.picagens.length > 0 && (
            <ul className="order-4 divide-y rounded-lg border text-sm" data-testid="picagens-hoje">
              {dia.picagens.map((p) => (
                <li key={p.id} className="flex items-center justify-between px-3 py-2">
                  <span>
                    <span className="font-medium tabular-nums">{formatarHora(p.hora)}</span> · {t(NOMES_PICAGEM[p.tipo])}
                    {p.orcamentoNumero ? <span className="text-muted-foreground"> · {p.orcamentoNumero}</span> : null}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {p.origem === "correcao" ? t("corrigida") : p.metodo === "qr" ? "QR" : p.metodo === "gps" ? "GPS" : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="mes">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="mes">{t("Mês")}</TabsTrigger>
          <TabsTrigger value="ferias">{t("Férias")}</TabsTrigger>
          <TabsTrigger value="faltas">{t("Faltas")}</TabsTrigger>
          <TabsTrigger value="correcoes">{t("Correções")}</TabsTrigger>
        </TabsList>
        <TabsContent value="mes">
          <HistoricoMes picagens={picagens} pedidos={pedidos} agora={agora} />
        </TabsContent>
        <TabsContent value="ferias">
          <PedidoFerias pedidos={pedidos} config={config} base={{ uid: user!.uid, funcionarioId, funcionarioNome: nome }} aoGravar={carregar} />
        </TabsContent>
        <TabsContent value="faltas">
          <PedidoFalta pedidos={pedidos} config={config} base={{ uid: user!.uid, funcionarioId, funcionarioNome: nome }} aoGravar={carregar} />
        </TabsContent>
        <TabsContent value="correcoes">
          <PedidoCorrecao pedidos={pedidos} obras={obras} base={{ uid: user!.uid, funcionarioId, funcionarioNome: nome }} aoGravar={carregar} />
        </TabsContent>
      </Tabs>

      <MudarPin
        aberto={mudarPin}
        aoFechar={() => setMudarPin(false)}
        aoMudar={async (atual, novo) => {
          await updateUserPassword(senhaDoPin(atual), senhaDoPin(novo))
        }}
      />
    </div>
  )
}

// ------------------------------------------------------------ Historico do mes

function HistoricoMes({ picagens, pedidos, agora }: { picagens: Picagem[]; pedidos: PedidoPonto[]; agora: Date }) {
  const [mes, setMes] = useState(() => diaLocal(agora).slice(0, 7))
  const hoje = diaLocal(agora)
  const dias = diasDoPeriodo(`${mes}-01`, `${mes}-31`).filter((d) => d.startsWith(mes) && d <= hoje).reverse()
  const lidos = dias.map((d) => lerDia(d, picagens, d === hoje ? agora : undefined))
  const total = lidos.reduce((s, d) => s + d.minutosTrabalho, 0)

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">{t("Total: {tempo}", { tempo: formatarMinutos(total) })}</CardTitle>
          <Input type="month" value={mes} onChange={(e) => setMes(e.target.value)} className="w-44" aria-label={t("Mês")} />
        </div>
      </CardHeader>
      <CardContent>
        <ul className="divide-y text-sm">
          {lidos
            .filter((d) => d.picagens.length > 0 || pedidoNoDia(pedidos, d.dia))
            .map((d) => {
              const pedido = pedidoNoDia(pedidos, d.dia)
              return (
                <li key={d.dia} className="flex items-center justify-between gap-2 py-2">
                  <div>
                    <div className="font-medium">{formatDate(d.dia)}</div>
                    <div className="text-xs text-muted-foreground">
                      {d.picagens.length > 0 ? `${formatarHora(d.primeiraEntrada)} - ${formatarHora(d.ultimaSaida)}` : ""}
                      {pedido ? ` ${pedido.tipo === "ferias" ? t("Férias") : nomeMotivoFalta(pedido.motivoFalta)}` : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {d.incompleto && d.dia !== hoje && (
                      <Badge variant="outline" className="border-rose-300 text-rose-700">
                        {t("Falta picar")}
                      </Badge>
                    )}
                    <span className="tabular-nums">{formatarMinutos(d.minutosTrabalho)}</span>
                  </div>
                </li>
              )
            })}
        </ul>
        {lidos.every((d) => d.picagens.length === 0) && <p className="py-6 text-center text-sm text-muted-foreground">{t("Sem picagens neste mês.")}</p>}
      </CardContent>
    </Card>
  )
}

// ------------------------------------------------------------ Pedidos

type Base = { uid: string; funcionarioId: string; funcionarioNome: string }

function ListaPedidos({ pedidos, aoGravar }: { pedidos: PedidoPonto[]; aoGravar: () => Promise<void> }) {
  if (pedidos.length === 0) return <p className="py-4 text-center text-sm text-muted-foreground">{t("Ainda sem pedidos.")}</p>
  return (
    <ul className="space-y-2" data-testid="lista-pedidos">
      {pedidos.map((p) => (
        <li key={p.id} className={`rounded-lg border p-3 text-sm ${CORES_ESTADO[p.estado]}`}>
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="font-medium">
                {p.tipo === "correcao" && p.correcao
                  ? t("{tipo} às {hora} de {data}", { tipo: t(NOMES_PICAGEM[p.correcao.tipo]), hora: p.correcao.hora, data: formatDate(p.correcao.dia) })
                  : p.fim && p.fim !== p.inicio
                    ? t("{inicio} a {fim}", { inicio: formatDate(p.inicio!), fim: formatDate(p.fim) })
                    : formatDate(p.inicio!)}
              </div>
              <div className="text-xs opacity-80">
                {p.tipo === "ferias" && (p.diasUteis === 1 ? t("{n} dia útil", { n: p.diasUteis }) : t("{n} dias úteis", { n: p.diasUteis ?? 0 }))}
                {p.tipo === "falta" && `${nomeMotivoFalta(p.motivoFalta)}${p.horas ? ` · ${p.horas} h` : ""}`}
                {p.observacoes ? ` · ${p.observacoes}` : ""}
              </div>
              {p.respostaGestor && <div className="mt-1 text-xs">{t("Resposta: {resposta}", { resposta: p.respostaGestor })}</div>}
            </div>
            <div className="flex flex-col items-end gap-1">
              <Badge variant="outline" className="bg-white/60">
                {t(NOMES_ESTADO[p.estado])}
              </Badge>
              {p.estado === "pendente" && (
                <button
                  type="button"
                  className="text-xs underline"
                  onClick={async () => {
                    await cancelarPedido(p.id!)
                    await aoGravar()
                  }}
                >
                  {t("Cancelar")}
                </button>
              )}
            </div>
          </div>
        </li>
      ))}
    </ul>
  )
}

function PedidoFerias({ pedidos, config, base, aoGravar }: { pedidos: PedidoPonto[]; config: ConfigPonto; base: Base; aoGravar: () => Promise<void> }) {
  const ano = new Date().getFullYear()
  const [inicio, setInicio] = useState("")
  const [fim, setFim] = useState("")
  const [obs, setObs] = useState("")
  const [aGravar, setAGravar] = useState(false)
  const saldo = saldoFerias(pedidos, ano, config.diasFerias)
  const dias = inicio && fim ? diasUteis(inicio, fim, config) : 0
  const minhas = pedidos.filter((p) => p.tipo === "ferias")

  const pedir = async () => {
    if (!inicio || !fim || fim < inicio) return toast({ title: t("Indique o primeiro e o último dia"), variant: "destructive" })
    if (dias === 0) return toast({ title: t("O período não tem dias úteis"), variant: "destructive" })
    if (dias > saldo.disponiveis - saldo.pendentes)
      return toast({
        title: t("Sem dias suficientes"),
        description: saldo.disponiveis - saldo.pendentes === 1 ? t("Tem {n} dia livre.", { n: 1 }) : t("Tem {n} dias livres.", { n: saldo.disponiveis - saldo.pendentes }),
        variant: "destructive",
      })
    setAGravar(true)
    try {
      await criarPedido({ ...base, tipo: "ferias", inicio, fim, diasUteis: dias, observacoes: obs.trim() })
      toast({ title: t("Pedido de férias enviado"), description: t("Fica amarelo até o encarregado aprovar.") })
      setInicio("")
      setFim("")
      setObs("")
      await aoGravar()
    } finally {
      setAGravar(false)
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{t("Férias {ano}", { ano })}</CardTitle>
        <CardDescription data-testid="saldo-ferias">
          {t("{disponiveis} de {direito} dias disponíveis", { disponiveis: saldo.disponiveis, direito: saldo.direito })}
          {saldo.pendentes > 0 ? ` · ${t("{n} a aguardar aprovação", { n: saldo.pendentes })}` : ""}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label htmlFor="ferias-inicio">{t("Primeiro dia")}</Label>
            <Input id="ferias-inicio" type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ferias-fim">{t("Último dia")}</Label>
            <Input id="ferias-fim" type="date" value={fim} min={inicio} onChange={(e) => setFim(e.target.value)} />
          </div>
        </div>
        {dias > 0 && (
          <p className="text-sm">
            {dias === 1 ? t("{n} dia útil (sem fins de semana nem feriados).", { n: dias }) : t("{n} dias úteis (sem fins de semana nem feriados).", { n: dias })}
          </p>
        )}
        <Input placeholder={t("Observações (opcional)")} value={obs} onChange={(e) => setObs(e.target.value)} />
        <Button className="w-full rounded-full" onClick={pedir} disabled={aGravar}>
          {t("Pedir férias")}
        </Button>
        <ListaPedidos pedidos={minhas} aoGravar={aoGravar} />
      </CardContent>
    </Card>
  )
}

function PedidoFalta({ pedidos, config, base, aoGravar }: { pedidos: PedidoPonto[]; config: ConfigPonto; base: Base; aoGravar: () => Promise<void> }) {
  const [inicio, setInicio] = useState(diaLocal(new Date()))
  const [fim, setFim] = useState(diaLocal(new Date()))
  const [motivo, setMotivo] = useState("consulta")
  const [horas, setHoras] = useState("")
  const [obs, setObs] = useState("")
  const [aGravar, setAGravar] = useState(false)
  const minhas = pedidos.filter((p) => p.tipo === "falta")

  const enviar = async () => {
    if (!inicio || (fim && fim < inicio)) return toast({ title: t("Verifique as datas"), variant: "destructive" })
    setAGravar(true)
    try {
      await criarPedido({
        ...base,
        tipo: "falta",
        inicio,
        fim: fim || inicio,
        diasUteis: diasUteis(inicio, fim || inicio, config),
        motivoFalta: motivo,
        horas: Number(horas.replace(",", ".")) || 0,
        observacoes: obs.trim(),
      })
      toast({ title: t("Falta comunicada"), description: t("Entregue o comprovativo ao encarregado, se tiver.") })
      setObs("")
      setHoras("")
      await aoGravar()
    } finally {
      setAGravar(false)
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{t("Comunicar falta")}</CardTitle>
        <CardDescription>{t("Consulta, doença, licença parental... O encarregado valida.")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1">
          <Label>{t("Motivo")}</Label>
          <Select value={motivo} onValueChange={setMotivo}>
            <SelectTrigger aria-label={t("Motivo da falta")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MOTIVOS_FALTA.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {t(m.nome)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label htmlFor="falta-inicio">{t("De")}</Label>
            <Input id="falta-inicio" type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="falta-fim">{t("Até")}</Label>
            <Input id="falta-fim" type="date" value={fim} min={inicio} onChange={(e) => setFim(e.target.value)} />
          </div>
        </div>
        <Input inputMode="decimal" placeholder={t("Só parte do dia? Quantas horas (opcional)")} value={horas} onChange={(e) => setHoras(e.target.value)} />
        <Input placeholder={t("Observações (opcional)")} value={obs} onChange={(e) => setObs(e.target.value)} />
        <Button className="w-full rounded-full" onClick={enviar} disabled={aGravar}>
          {t("Comunicar falta")}
        </Button>
        <ListaPedidos pedidos={minhas} aoGravar={aoGravar} />
      </CardContent>
    </Card>
  )
}

function PedidoCorrecao({ pedidos, obras, base, aoGravar }: { pedidos: PedidoPonto[]; obras: ObraPonto[]; base: Base; aoGravar: () => Promise<void> }) {
  const [dia, setDia] = useState(diaLocal(new Date()))
  const [hora, setHora] = useState("")
  const [tipo, setTipo] = useState<TipoPicagem>("saida")
  const [obraId, setObraId] = useState("")
  const [motivo, setMotivo] = useState("")
  const [aGravar, setAGravar] = useState(false)
  const minhas = pedidos.filter((p) => p.tipo === "correcao")

  const enviar = async () => {
    if (!dia || !hora) return toast({ title: t("Indique o dia e a hora"), variant: "destructive" })
    if (!motivo.trim()) return toast({ title: t("Explique o que aconteceu"), variant: "destructive" })
    const obra = obras.find((o) => o.id === obraId)
    setAGravar(true)
    try {
      await criarPedido({
        ...base,
        tipo: "correcao",
        correcao: { dia, hora, tipo, orcamentoId: obra?.id || "", orcamentoNumero: obra?.numero || "" },
        observacoes: motivo.trim(),
      })
      toast({ title: t("Pedido de correção enviado") })
      setHora("")
      setMotivo("")
      await aoGravar()
    } finally {
      setAGravar(false)
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{t("Esqueceu-se de picar?")}</CardTitle>
        <CardDescription>{t("As picagens não se apagam. Peça a correção e o encarregado aprova.")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-3 gap-2">
          <div className="col-span-1 space-y-1">
            <Label>{t("Picagem")}</Label>
            <Select value={tipo} onValueChange={(v) => setTipo(v as TipoPicagem)}>
              <SelectTrigger aria-label={t("Tipo de picagem")}>
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
          </div>
          <div className="space-y-1">
            <Label htmlFor="corr-dia">{t("Dia")}</Label>
            <Input id="corr-dia" type="date" value={dia} onChange={(e) => setDia(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="corr-hora">{t("Hora")}</Label>
            <Input id="corr-hora" type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
          </div>
        </div>
        {tipo === "entrada" && (
          <Select value={obraId} onValueChange={setObraId}>
            <SelectTrigger aria-label={t("Obra da correção")}>
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
        <Textarea placeholder={t("O que aconteceu? (ex.: esqueci-me de picar a saída)")} value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={2} />
        <Button className="w-full rounded-full" onClick={enviar} disabled={aGravar}>
          {t("Pedir correção")}
        </Button>
        <ListaPedidos pedidos={minhas} aoGravar={aoGravar} />
      </CardContent>
    </Card>
  )
}

function MudarPin({ aberto, aoFechar, aoMudar }: { aberto: boolean; aoFechar: () => void; aoMudar: (atual: string, novo: string) => Promise<void> }) {
  const [atual, setAtual] = useState("")
  const [novo, setNovo] = useState("")
  const [repetir, setRepetir] = useState("")
  const [aGravar, setAGravar] = useState(false)
  const gravar = async () => {
    if (!pinValido(novo)) return toast({ title: t("O PIN novo tem de ter 4 a 6 dígitos"), variant: "destructive" })
    if (novo !== repetir) return toast({ title: t("Os PINs novos não coincidem"), variant: "destructive" })
    setAGravar(true)
    try {
      await aoMudar(atual, novo)
      toast({ title: t("PIN alterado") })
      setAtual("")
      setNovo("")
      setRepetir("")
      aoFechar()
    } catch {
      toast({ title: t("PIN atual errado"), variant: "destructive" })
    } finally {
      setAGravar(false)
    }
  }
  const campo = (id: string, rotulo: string, valor: string, mudar: (v: string) => void) => (
    <div className="space-y-1">
      <Label htmlFor={id}>{rotulo}</Label>
      <Input id={id} type="password" inputMode="numeric" maxLength={6} value={valor} onChange={(e) => mudar(e.target.value.replace(/\D/g, ""))} />
    </div>
  )
  return (
    <Dialog open={aberto} onOpenChange={(a) => !a && aoFechar()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("Mudar PIN")}</DialogTitle>
          <DialogDescription>{t("4 a 6 dígitos. Não o partilhe com colegas.")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {campo("pin-atual", t("PIN atual"), atual, setAtual)}
          {campo("pin-novo", t("PIN novo"), novo, setNovo)}
          {campo("pin-repetir", t("Repetir PIN novo"), repetir, setRepetir)}
          <Button className="w-full rounded-full" onClick={gravar} disabled={aGravar}>
            {t("Guardar")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
