"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Camera, CameraOff, Loader2, Minus, Plus, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { SeletorComBusca } from "@/components/ui/seletor-com-busca"
import { useAuth } from "@/hooks/use-auth"
import { useConfiguracao } from "@/hooks/use-configuracao"
import { usePermissoes } from "@/hooks/use-permissoes"
import { toast } from "@/hooks/use-toast"
import { podeApurar } from "@/lib/apuramento-obra"
import { produtoDoCodigo } from "@/lib/etiquetas"
import { FirebaseService, registarDevolucao, registarMovimentoEstoque } from "@/lib/firebase-service"
import { numeroCompleto } from "@/lib/numeracao"
import type { Material, Orcamento } from "@/lib/types"
import { formatNumber2, hojeLocal, round2 } from "@/lib/utils"

type Modo = "saida" | "devolucao"

/**
 * Bipar material com a camera do telemovel: ao sair para a obra e ao voltar.
 *
 * Le as etiquetas QR do sistema e os codigos de barras de fabrica (EAN). Cada
 * leitura soma 1 ao carrinho; no fim regista-se tudo de uma vez. Sem camera
 * (ou no computador) escreve-se o codigo no campo.
 */
export default function BiparPage() {
  const { user } = useAuth()
  const { configuracao } = useConfiguracao()
  const { pode } = usePermissoes()
  const [produtos, setProdutos] = useState<Material[]>([])
  const [obras, setObras] = useState<Orcamento[]>([])
  const [aCarregar, setACarregar] = useState(true)
  const [obraId, setObraId] = useState("")
  const [modo, setModo] = useState<Modo>("saida")
  const [carrinho, setCarrinho] = useState<Record<string, number>>({})
  const [codigo, setCodigo] = useState("")
  const [camera, setCamera] = useState(false)
  const [aGravar, setAGravar] = useState(false)
  const leitor = useRef<{ stop: () => Promise<void>; clear: () => void } | null>(null)
  const ultimo = useRef({ codigo: "", quando: 0 })

  const carregar = useCallback(async () => {
    if (!user) return
    try {
      const [lista, orcs] = await Promise.all([FirebaseService.getMateriais(user.uid), FirebaseService.getOrcamentos(user.uid)])
      setProdutos(lista.filter((p) => p.controlaEstoque))
      setObras(orcs.filter((o) => podeApurar(o) && o.status !== "cancelado"))
    } finally {
      setACarregar(false)
    }
  }, [user])
  useEffect(() => {
    void carregar()
  }, [carregar])

  /** Uma leitura: encontra o produto e soma 1. A mesma etiqueta lida seguida conta uma vez. */
  const ler = useCallback(
    (lido: string) => {
      const agora = Date.now()
      if (lido === ultimo.current.codigo && agora - ultimo.current.quando < 1500) return
      ultimo.current = { codigo: lido, quando: agora }
      const produto = produtoDoCodigo(lido, produtos)
      if (!produto?.id) {
        toast({ title: "Codigo desconhecido", description: lido, variant: "destructive" })
        return
      }
      setCarrinho((c) => ({ ...c, [produto.id!]: round2((c[produto.id!] || 0) + 1) }))
      if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(60)
      toast({ title: `+1 ${produto.nome}` })
    },
    [produtos],
  )

  const pararCamera = useCallback(async () => {
    if (leitor.current) {
      await leitor.current.stop().catch(() => {})
      leitor.current.clear()
      leitor.current = null
    }
    setCamera(false)
  }, [])

  const ligarCamera = async () => {
    try {
      const { Html5Qrcode, Html5QrcodeSupportedFormats: F } = await import("html5-qrcode")
      const instancia = new Html5Qrcode("leitor-camera", {
        verbose: false,
        formatsToSupport: [F.QR_CODE, F.EAN_13, F.EAN_8, F.CODE_128, F.UPC_A],
      })
      await instancia.start({ facingMode: "environment" }, { fps: 10, qrbox: { width: 240, height: 240 } }, (texto) => ler(texto), () => {})
      leitor.current = instancia
      setCamera(true)
    } catch (erro) {
      toast({
        title: "Nao foi possivel abrir a camera",
        description: "Autorize a camera no browser, ou escreva o codigo no campo.",
        variant: "destructive",
      })
      console.error(erro)
    }
  }
  useEffect(() => () => void pararCamera(), [pararCamera])

  const obra = obras.find((o) => o.id === obraId)
  const linhas = Object.entries(carrinho).filter(([, q]) => q > 0)

  const registar = async () => {
    if (!user || !obra?.id) return toast({ title: "Escolha a obra", variant: "destructive" })
    if (linhas.length === 0) return toast({ title: "Ainda nao bipou nada", variant: "destructive" })
    setAGravar(true)
    const numero = numeroCompleto(obra, configuracao)
    let feitos = 0
    try {
      for (const [materialId, quantidade] of linhas) {
        if (modo === "saida") {
          await registarMovimentoEstoque(
            { materialId, tipo: "saida", quantidade, data: hojeLocal(), orcamentoId: obra.id, orcamentoNumero: numero, documento: "Bipado", userId: user.uid },
            { grupos: configuracao.gruposImpostos || [] },
          )
        } else {
          await registarDevolucao(
            { materialId, quantidade, orcamentoId: obra.id, orcamentoNumero: numero, data: hojeLocal(), userId: user.uid },
            configuracao.gruposImpostos || [],
          )
        }
        feitos++
        setCarrinho((c) => ({ ...c, [materialId]: 0 }))
      }
      toast({ title: modo === "saida" ? `${feitos} produto(s) sairam para ${numero}` : `${feitos} produto(s) voltaram de ${numero}` })
      await carregar()
    } catch (erro) {
      toast({
        title: `Registados ${feitos} de ${linhas.length}`,
        description: erro instanceof Error ? erro.message : "Tente novamente.",
        variant: "destructive",
      })
    } finally {
      setAGravar(false)
    }
  }

  if (aCarregar) return <LoadingSpinner size="lg" />
  if (!pode("materiais.gerir")) return <p>Precisa da permissao de gerir materiais.</p>

  return (
    <div className="mx-auto max-w-xl space-y-4 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Bipar material</h1>
        <p className="text-sm text-muted-foreground">Aponte a camera a etiqueta ou ao codigo de barras.</p>
      </div>

      <Card>
        <CardContent className="space-y-3 pt-6">
          <div className="space-y-1">
            <Label>Obra</Label>
            <SeletorComBusca
              valor={obraId}
              onChange={setObraId}
              placeholder="Escolha a obra"
              placeholderBusca="Procurar obra..."
              vazio="Nenhuma obra adjudicada."
              opcoes={obras.map((o) => ({ valor: o.id!, rotulo: numeroCompleto(o, configuracao), detalhe: o.cliente.nome }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-2" data-testid="modo-bipar">
            {(
              [
                ["saida", "Sai para a obra"],
                ["devolucao", "Volta da obra"],
              ] as const
            ).map(([id, nome]) => (
              <button
                key={id}
                type="button"
                onClick={() => setModo(id)}
                className={`rounded-lg border p-3 text-sm font-medium ${modo === id ? "border-primary bg-primary/10 ring-1 ring-primary" : "hover:bg-muted"}`}
              >
                {nome}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 pt-6">
          <div id="leitor-camera" className={camera ? "overflow-hidden rounded-lg" : "hidden"} />
          <Button variant={camera ? "outline" : "default"} className="w-full rounded-full" onClick={camera ? pararCamera : ligarCamera}>
            {camera ? <CameraOff className="mr-2 h-4 w-4" /> : <Camera className="mr-2 h-4 w-4" />}
            {camera ? "Desligar camera" : "Ligar camera"}
          </Button>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              ler(codigo)
              setCodigo("")
            }}
          >
            <Input
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              placeholder="Ou escreva o codigo / EAN"
              aria-label="Codigo"
            />
            <Button type="submit" variant="outline">Ler</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{modo === "saida" ? "A sair para a obra" : "A voltar ao armazem"}</CardTitle>
          <CardDescription>{linhas.length} produto(s)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2" data-testid="carrinho">
          {linhas.map(([id, q]) => {
            const p = produtos.find((x) => x.id === id)
            return (
              <div key={id} className="flex items-center justify-between gap-2 rounded-lg border p-2">
                <div className="min-w-0">
                  <div className="truncate font-medium">{p?.nome}</div>
                  <div className="text-xs text-muted-foreground">
                    Em estoque: {formatNumber2(Number(p?.estoqueAtual) || 0)} {p?.unidade}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => setCarrinho({ ...carrinho, [id]: Math.max(0, q - 1) })}>
                    <Minus className="h-3 w-3" />
                  </Button>
                  <span className="w-10 text-center tabular-nums" data-testid="qtd-carrinho">{formatNumber2(q)}</span>
                  <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => setCarrinho({ ...carrinho, [id]: q + 1 })}>
                    <Plus className="h-3 w-3" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setCarrinho({ ...carrinho, [id]: 0 })}>
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </div>
              </div>
            )
          })}
          <Button className="w-full rounded-full" disabled={aGravar || linhas.length === 0} onClick={registar}>
            {aGravar && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {modo === "saida" ? "Registar saida" : "Registar devolucao"}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
