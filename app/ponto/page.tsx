"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { RefreshCw } from "lucide-react"

import { MapaFerias, PainelAcessos, PainelConfig, PainelHoje, PainelObras, PainelPedidos, PainelRegistos, type Pessoa } from "@/components/ponto/gestor"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useAuth } from "@/hooks/use-auth"
import { useConfiguracao } from "@/hooks/use-configuracao"
import { usePermissoes } from "@/hooks/use-permissoes"
import { toast } from "@/hooks/use-toast"
import { podeApurar } from "@/lib/apuramento-obra"
import { FirebaseService } from "@/lib/firebase-service"
import { numeroCompleto } from "@/lib/numeracao"
import { CONFIG_PONTO_PADRAO, diaLocal } from "@/lib/ponto"
import { getAcessos, getConfigPonto, getObrasPonto, getPedidos, getPicagensDesde } from "@/lib/ponto-service"
import type { AcessoPonto, ConfigPonto, Funcionario, ObraPonto, Orcamento, PedidoPonto, Picagem } from "@/lib/types"

/**
 * Ponto da equipa: quem esta a trabalhar, pedidos por decidir, registo de
 * tempos do mes, mapa de ferias, acessos (n.o + PIN), obras e configuracao.
 */
export default function PontoPage() {
  const { user } = useAuth()
  const { configuracao } = useConfiguracao()
  const { pode } = usePermissoes()
  const verFuncionarios = pode("funcionarios.ver")
  const verObras = pode("orcamentos.ver")

  const [config, setConfig] = useState<ConfigPonto>(CONFIG_PONTO_PADRAO)
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([])
  const [acessos, setAcessos] = useState<AcessoPonto[]>([])
  const [obrasPonto, setObrasPonto] = useState<ObraPonto[]>([])
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([])
  const [pedidos, setPedidos] = useState<PedidoPonto[]>([])
  const [picagens, setPicagens] = useState<Picagem[]>([])
  const [mes, setMes] = useState(() => diaLocal(new Date()).slice(0, 7))
  const [aCarregar, setACarregar] = useState(true)
  const [agora, setAgora] = useState(() => new Date())

  const carregar = useCallback(async () => {
    if (!user) return
    try {
      // O mes escolhido ate hoje: chega para o painel de hoje e para os registos
      const inicioMesAtual = diaLocal(new Date()).slice(0, 8) + "01"
      const desde = `${mes}-01` < inicioMesAtual ? `${mes}-01` : inicioMesAtual
      const [c, f, a, o, orcs, p, pic] = await Promise.all([
        getConfigPonto(),
        verFuncionarios ? FirebaseService.getFuncionarios(user.uid).catch(() => [] as Funcionario[]) : Promise.resolve([] as Funcionario[]),
        getAcessos().catch(() => [] as AcessoPonto[]),
        getObrasPonto().catch(() => [] as ObraPonto[]),
        verObras ? FirebaseService.getOrcamentos(user.uid).catch(() => [] as Orcamento[]) : Promise.resolve([] as Orcamento[]),
        getPedidos(),
        getPicagensDesde(desde),
      ])
      setConfig(c)
      setFuncionarios(f)
      setAcessos(a)
      setObrasPonto(o)
      setOrcamentos(orcs)
      setPedidos(p)
      setPicagens(pic)
      setAgora(new Date())
    } catch (e) {
      console.error(e)
      toast({ title: "Nao foi possivel carregar o ponto", description: e instanceof Error ? e.message : String(e), variant: "destructive" })
    } finally {
      setACarregar(false)
    }
  }, [user, mes, verFuncionarios, verObras])
  useEffect(() => {
    void carregar()
  }, [carregar])
  useEffect(() => {
    const t = setInterval(() => setAgora(new Date()), 60000)
    return () => clearInterval(t)
  }, [])

  /** Junta funcionarios, acessos e quem aparece nas picagens/pedidos. */
  const pessoas = useMemo<Pessoa[]>(() => {
    const mapa = new Map<string, Pessoa>()
    for (const f of funcionarios.filter((x) => x.ativo !== false)) {
      mapa.set(f.id!, { funcionarioId: f.id!, nome: f.nome, numero: f.numeroFuncionario || "", funcionario: f })
    }
    for (const a of acessos) {
      const atual = mapa.get(a.funcionarioId) || { funcionarioId: a.funcionarioId, nome: "", numero: a.id || "" }
      // Um funcionario pode ter tido varios numeros; vale o acesso ativo
      if (!atual.acesso || a.ativo) mapa.set(a.funcionarioId, { ...atual, acesso: a, numero: atual.numero || a.id || "" })
    }
    for (const x of [...picagens, ...pedidos]) {
      const atual = mapa.get(x.funcionarioId)
      if (!atual) mapa.set(x.funcionarioId, { funcionarioId: x.funcionarioId, nome: x.funcionarioNome, numero: "" })
      else if (!atual.nome) mapa.set(x.funcionarioId, { ...atual, nome: x.funcionarioNome })
    }
    return [...mapa.values()].sort((a, b) => a.nome.localeCompare(b.nome, "pt"))
  }, [funcionarios, acessos, picagens, pedidos])

  const candidatas = useMemo(
    () =>
      orcamentos
        .filter((o) => podeApurar(o) && o.status !== "cancelado")
        .map((o) => ({ id: o.id!, numero: numeroCompleto(o, configuracao), nome: o.cliente?.nome || "", morada: o.cliente?.morada || "" })),
    [orcamentos, configuracao],
  )

  if (aCarregar) return <LoadingSpinner size="lg" />
  const gestor = { uid: user!.uid, email: user!.email || "" }
  const pendentes = pedidos.filter((p) => p.estado === "pendente").length
  const obrasAtivas = obrasPonto.filter((o) => o.ativa)

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-3xl font-bold">Ponto da equipa</h1>
          <p className="mt-2 text-muted-foreground">Picagens, ferias e faltas. Os trabalhadores picam no telemovel com o n.º de funcionario e PIN.</p>
        </div>
        <Button variant="outline" className="rounded-full" onClick={() => void carregar()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Atualizar
        </Button>
      </div>

      <Tabs defaultValue="hoje">
        <TabsList className="flex h-auto flex-wrap justify-start print:hidden">
          <TabsTrigger value="hoje">Hoje</TabsTrigger>
          <TabsTrigger value="pedidos">
            Pedidos
            {pendentes > 0 && <Badge className="ml-2 h-5 px-1.5">{pendentes}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="registos">Registos</TabsTrigger>
          <TabsTrigger value="ferias">Mapa de ferias</TabsTrigger>
          <TabsTrigger value="acessos">Acessos</TabsTrigger>
          <TabsTrigger value="obras">Obras</TabsTrigger>
          <TabsTrigger value="config">Configuracao</TabsTrigger>
        </TabsList>
        <TabsContent value="hoje">
          <PainelHoje pessoas={pessoas} picagens={picagens} pedidos={pedidos} config={config} agora={agora} />
        </TabsContent>
        <TabsContent value="pedidos">
          <PainelPedidos pedidos={pedidos} gestor={gestor} aoMudar={carregar} />
        </TabsContent>
        <TabsContent value="registos">
          <PainelRegistos
            pessoas={pessoas}
            picagens={picagens}
            pedidos={pedidos}
            obras={obrasAtivas}
            mes={mes}
            setMes={setMes}
            gestor={gestor}
            custoFixoHora={configuracao.custoFixoHora || 0}
            podeEnviarHoras={verFuncionarios}
            aoMudar={carregar}
          />
        </TabsContent>
        <TabsContent value="ferias">
          <MapaFerias pessoas={pessoas} pedidos={pedidos} picagens={picagens} config={config} mes={mes} setMes={setMes} />
        </TabsContent>
        <TabsContent value="acessos">
          <PainelAcessos pessoas={pessoas} podeCriar={verFuncionarios} aoMudar={carregar} />
        </TabsContent>
        <TabsContent value="obras">
          <PainelObras candidatas={candidatas} obrasPonto={obrasPonto} config={config} aoMudar={carregar} />
        </TabsContent>
        <TabsContent value="config">
          <PainelConfig key={JSON.stringify(config)} config={config} aoMudar={carregar} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
