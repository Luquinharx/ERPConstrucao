"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Check, Loader2, Trash2 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CampoNumerico } from "@/components/ui/campo-numerico"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { SeletorComBusca } from "@/components/ui/seletor-com-busca"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useAuth } from "@/hooks/use-auth"
import { useConfiguracao } from "@/hooks/use-configuracao"
import { usePermissoes } from "@/hooks/use-permissoes"
import { toast } from "@/hooks/use-toast"
import { podeApurar } from "@/lib/apuramento-obra"
import { FirebaseService, apagar, atualizar, criar, listar } from "@/lib/firebase-service"
import { numeroCompleto } from "@/lib/numeracao"
import { custoHoras } from "@/lib/obra"
import { custoHoraFuncionario } from "@/lib/produto-calculos"
import type { Funcionario, Orcamento, RegistoHoras } from "@/lib/types"
import { formatCurrency, formatDate, formatNumber2, hojeLocal, round2 } from "@/lib/utils"

/**
 * Livro de ponto: as horas de cada trabalhador em cada obra.
 *
 * Quem esta em obra regista; quem aprova confirma. So as horas aprovadas
 * entram no custo real da obra (apuramento), ao custo/hora do trabalhador
 * mais o custo fixo/hora da empresa, ambos fixados no dia do registo.
 */
export default function HorasPage() {
  const { user } = useAuth()
  const { configuracao } = useConfiguracao()
  const { pode } = usePermissoes()
  const podeRegistar = pode("orcamentos.custosObra")
  const podeAprovar = pode("orcamentos.aprovar")

  const [obras, setObras] = useState<Orcamento[]>([])
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([])
  const [registos, setRegistos] = useState<RegistoHoras[]>([])
  const [aCarregar, setACarregar] = useState(true)
  const [obraId, setObraId] = useState("")
  const [data, setData] = useState(hojeLocal())
  const [horas, setHoras] = useState<Record<string, number>>({})
  const [selecionados, setSelecionados] = useState<string[]>([])
  const [aGravar, setAGravar] = useState(false)

  const carregar = useCallback(async () => {
    if (!user) return
    try {
      const [orcs, equipa, lista] = await Promise.all([
        FirebaseService.getOrcamentos(user.uid),
        FirebaseService.getFuncionarios(user.uid),
        listar<RegistoHoras>("registosHoras"),
      ])
      setObras(orcs.filter((o) => podeApurar(o) && o.status !== "cancelado"))
      setFuncionarios(equipa.filter((f) => f.ativo !== false))
      setRegistos(lista.sort((a, b) => b.data.localeCompare(a.data)))
    } finally {
      setACarregar(false)
    }
  }, [user])
  useEffect(() => {
    void carregar()
  }, [carregar])

  const obra = obras.find((o) => o.id === obraId)
  const doDia = registos.filter((r) => r.orcamentoId === obraId && r.data === data)
  const pendentes = registos.filter((r) => r.estado === "pendente")
  const mes = hojeLocal().slice(0, 7)
  const doMes = registos.filter((r) => r.data.startsWith(mes))

  const porObra = useMemo(() => {
    const m = new Map<string, RegistoHoras[]>()
    for (const r of doMes) m.set(r.orcamentoNumero, [...(m.get(r.orcamentoNumero) || []), r])
    return [...m.entries()].map(([numero, lista]) => ({ numero, ...custoHoras(lista), pendentes: lista.filter((r) => r.estado === "pendente").length }))
  }, [doMes])

  const gravarDia = async () => {
    if (!user || !obra?.id) return toast({ title: "Escolha a obra", variant: "destructive" })
    const linhas = Object.entries(horas).filter(([, h]) => h > 0)
    if (linhas.length === 0) return toast({ title: "Indique as horas de pelo menos um trabalhador", variant: "destructive" })
    setAGravar(true)
    try {
      for (const [funcionarioId, h] of linhas) {
        const f = funcionarios.find((x) => x.id === funcionarioId)!
        await criar("registosHoras", {
          funcionarioId,
          funcionarioNome: f.nome,
          orcamentoId: obra.id,
          orcamentoNumero: numeroCompleto(obra, configuracao),
          data,
          horas: round2(h),
          custoHora: custoHoraFuncionario(f),
          custoFixoHora: round2(configuracao.custoFixoHora || 0),
          estado: "pendente",
          userId: user.uid,
        })
      }
      toast({ title: `${linhas.length} registo(s) gravado(s)`, description: "Ficam pendentes ate serem aprovados." })
      setHoras({})
      await carregar()
    } finally {
      setAGravar(false)
    }
  }

  const aprovar = async (ids: string[]) => {
    for (const id of ids) await atualizar("registosHoras", id, { estado: "aprovado", aprovadoPor: user?.email || "" })
    toast({ title: `${ids.length} registo(s) aprovado(s)` })
    setSelecionados([])
    await carregar()
  }

  if (aCarregar) return <LoadingSpinner size="lg" />

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold">Livro de ponto</h1>
        <p className="mt-2 text-muted-foreground">Horas por trabalhador e por obra. So as aprovadas contam no custo da obra.</p>
      </div>

      <Tabs defaultValue="registo">
        <TabsList>
          <TabsTrigger value="registo">Registo diario</TabsTrigger>
          <TabsTrigger value="aprovacoes">
            Aprovacoes
            {pendentes.length > 0 && <Badge className="ml-2 px-1.5 py-0 text-[10px]">{pendentes.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="resumo">Resumo do mes</TabsTrigger>
        </TabsList>

        <TabsContent value="registo" className="space-y-4 pt-4">
          <Card>
            <CardContent className="space-y-4 pt-6">
              <div className="grid gap-4 sm:grid-cols-[1fr_200px]">
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
                <div className="space-y-1">
                  <Label>Dia</Label>
                  <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
                </div>
              </div>

              {obra && (
                <>
                  <Table data-testid="grelha-horas">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Trabalhador</TableHead>
                        <TableHead>Funcao</TableHead>
                        <TableHead className="w-40 text-right">Horas</TableHead>
                        <TableHead className="text-right">Ja registado no dia</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {funcionarios.map((f) => {
                        const ja = doDia.filter((r) => r.funcionarioId === f.id).reduce((s, r) => s + r.horas, 0)
                        return (
                          <TableRow key={f.id}>
                            <TableCell className="font-medium">{f.nome}</TableCell>
                            <TableCell className="text-muted-foreground">{f.funcao}</TableCell>
                            <TableCell>
                              <CampoNumerico
                                tamanho="sm"
                                min={0}
                                max={24}
                                sufixo="h"
                                aria-label={`Horas ${f.nome}`}
                                disabled={!podeRegistar}
                                value={horas[f.id!] || 0}
                                onChange={(h) => setHoras({ ...horas, [f.id!]: h })}
                              />
                            </TableCell>
                            <TableCell className="text-right tabular-nums">{ja ? `${formatNumber2(ja)} h` : "-"}</TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                  {podeRegistar && (
                    <div className="flex justify-end">
                      <Button onClick={gravarDia} disabled={aGravar} className="rounded-full">
                        {aGravar && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Gravar horas do dia
                      </Button>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="aprovacoes" className="space-y-4 pt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
              <div>
                <CardTitle className="text-lg">Horas por aprovar</CardTitle>
                <CardDescription>Aprovadas, entram no custo real da obra.</CardDescription>
              </div>
              {podeAprovar && (
                <Button disabled={selecionados.length === 0} onClick={() => aprovar(selecionados)} className="rounded-full">
                  <Check className="mr-2 h-4 w-4" />
                  Aprovar selecionadas ({selecionados.length})
                </Button>
              )}
            </CardHeader>
            <CardContent>
              <Table data-testid="tabela-aprovacoes">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        aria-label="Selecionar todas"
                        checked={pendentes.length > 0 && selecionados.length === pendentes.length}
                        onCheckedChange={(v) => setSelecionados(v === true ? pendentes.map((p) => p.id!) : [])}
                      />
                    </TableHead>
                    <TableHead>Dia</TableHead>
                    <TableHead>Trabalhador</TableHead>
                    <TableHead>Obra</TableHead>
                    <TableHead className="text-right">Horas</TableHead>
                    <TableHead className="text-right">Custo</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendentes.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">Nada por aprovar.</TableCell>
                    </TableRow>
                  ) : (
                    pendentes.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>
                          <Checkbox
                            aria-label={`Selecionar ${r.funcionarioNome}`}
                            checked={selecionados.includes(r.id!)}
                            onCheckedChange={(v) =>
                              setSelecionados((s) => (v === true ? [...s, r.id!] : s.filter((x) => x !== r.id)))
                            }
                          />
                        </TableCell>
                        <TableCell>{formatDate(r.data)}</TableCell>
                        <TableCell className="font-medium">{r.funcionarioNome}</TableCell>
                        <TableCell>{r.orcamentoNumero}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatNumber2(r.horas)} h</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatCurrency(round2(r.horas * (r.custoHora + r.custoFixoHora)))}
                        </TableCell>
                        <TableCell className="text-right">
                          {(podeAprovar || podeRegistar) && (
                            <Button
                              size="icon"
                              variant="ghost"
                              title="Apagar registo"
                              onClick={async () => {
                                if (!confirm("Apagar este registo?")) return
                                await apagar("registosHoras", r.id!)
                                await carregar()
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="resumo" className="pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Horas aprovadas em {mes.split("-").reverse().join("/")}</CardTitle>
              <CardDescription>Custo = horas x (custo/hora do trabalhador + custo fixo/hora da empresa).</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Obra</TableHead>
                    <TableHead className="text-right">Horas</TableHead>
                    <TableHead className="text-right">Mao de obra</TableHead>
                    <TableHead className="text-right">Estrutura</TableHead>
                    <TableHead className="text-right">Por aprovar</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {porObra.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">Sem horas este mes.</TableCell></TableRow>
                  ) : (
                    porObra.map((p) => (
                      <TableRow key={p.numero}>
                        <TableCell className="font-medium">{p.numero}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatNumber2(p.horas)} h</TableCell>
                        <TableCell className="text-right tabular-nums">{formatCurrency(p.maoObra)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatCurrency(p.estrutura)}</TableCell>
                        <TableCell className="text-right tabular-nums">{p.pendentes}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
