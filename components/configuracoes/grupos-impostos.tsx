"use client"

import { useEffect, useState } from "react"
import { Loader2, Plus, Trash2, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { CampoNumerico } from "@/components/ui/campo-numerico"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useConfiguracao } from "@/hooks/use-configuracao"
import { usePermissoes } from "@/hooks/use-permissoes"
import { toast } from "@/hooks/use-toast"
import type { GrupoImpostos, IncidenciaImposto, RegraImposto } from "@/lib/types"
import { formatNumber2, round2 } from "@/lib/utils"

const novoId = (prefixo: string) => `${prefixo}-${Date.now()}-${Math.round(Math.random() * 1000)}`

const novaRegra = (parcial: Partial<RegraImposto> = {}): RegraImposto => ({
  id: novoId("regra"),
  nome: "",
  percentual: 0,
  incidencia: "compra",
  ...parcial,
})

/** Ponto de partida tipico em Portugal: IVA da compra recuperavel. */
const novoGrupo = (): GrupoImpostos => ({
  id: novoId("grupo"),
  nome: "",
  regras: [novaRegra({ nome: "IVA", percentual: 23, incidencia: "compra", recuperavel: true })],
})

/**
 * Grupos de impostos, como os grupos de tributacao do Sankhya: cada produto
 * escolhe um grupo, e mudar uma taxa aqui muda-a em todos esses produtos.
 */
export function GruposImpostos() {
  const { configuracao, guardar } = useConfiguracao()
  const { pode } = usePermissoes()
  const podeGerir = pode("configuracoes.gerir")

  const [grupos, setGrupos] = useState<GrupoImpostos[]>(configuracao.gruposImpostos || [])
  const [aGravar, setAGravar] = useState(false)

  useEffect(() => setGrupos(configuracao.gruposImpostos || []), [configuracao.gruposImpostos])

  const alterarGrupo = (id: string, parcial: Partial<GrupoImpostos>) =>
    setGrupos((atual) => atual.map((g) => (g.id === id ? { ...g, ...parcial } : g)))

  const alterarRegra = (grupo: GrupoImpostos, regraId: string, parcial: Partial<RegraImposto>) =>
    alterarGrupo(grupo.id, {
      regras: grupo.regras.map((r) => {
        if (r.id !== regraId) return r
        const proxima = { ...r, ...parcial }
        // Recuperar so existe na compra: o imposto de venda e sempre pago
        if (proxima.incidencia === "venda") proxima.recuperavel = false
        return proxima
      }),
    })

  const gravar = async () => {
    const semNome = grupos.find((g) => !g.nome.trim())
    if (semNome) {
      toast({ title: "Falta o nome", description: "Todos os grupos precisam de nome.", variant: "destructive" })
      return
    }
    setAGravar(true)
    try {
      await guardar({
        gruposImpostos: grupos.map((g) => ({
          id: g.id,
          nome: g.nome.trim(),
          regras: g.regras
            .filter((r) => r.nome.trim() || r.percentual > 0)
            .map((r) => ({
              id: r.id,
              nome: r.nome.trim() || "Imposto",
              percentual: round2(r.percentual),
              incidencia: r.incidencia,
              recuperavel: r.incidencia === "compra" && !!r.recuperavel,
            })),
        })),
      })
      toast({ title: "Grupos de impostos gravados" })
    } catch {
      toast({ title: "Nao foi possivel gravar", variant: "destructive" })
    } finally {
      setAGravar(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Grupos de impostos</CardTitle>
        <CardDescription>
          Cada produto escolhe um grupo. Impostos de <strong>compra</strong> entram no custo, exceto os recuperaveis
          (ex.: IVA dedutivel), que so geram credito. Impostos de <strong>venda</strong> entram no preco: preco = custo
          x (1 + margem) / (1 - % venda). O IVA cobrado ao cliente continua a ser somado no orcamento.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {grupos.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhum grupo. Crie, por exemplo, &quot;Material - IVA 23%&quot;.</p>
        )}

        {grupos.map((grupo) => {
          const compra = grupo.regras
            .filter((r) => r.incidencia === "compra" && !r.recuperavel)
            .reduce((s, r) => s + (Number(r.percentual) || 0), 0)
          const venda = grupo.regras
            .filter((r) => r.incidencia === "venda")
            .reduce((s, r) => s + (Number(r.percentual) || 0), 0)
          return (
            <div key={grupo.id} className="space-y-3 rounded-lg border p-4" data-testid="grupo-impostos">
              <div className="flex items-center gap-2">
                <Input
                  value={grupo.nome}
                  onChange={(e) => alterarGrupo(grupo.id, { nome: e.target.value })}
                  placeholder="Nome do grupo"
                  aria-label="Nome do grupo"
                  disabled={!podeGerir}
                  className="font-medium"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={!podeGerir}
                  title="Apagar grupo"
                  onClick={() => {
                    // Produtos deste grupo ficam sem impostos ate escolherem outro
                    if (!confirm(`Apagar o grupo "${grupo.nome || "sem nome"}"? Os produtos que o usam ficam sem impostos.`)) return
                    setGrupos((atual) => atual.filter((g) => g.id !== grupo.id))
                  }}
                  className="text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              <div className="space-y-2">
                {grupo.regras.map((regra) => (
                  <div
                    key={regra.id}
                    className="grid grid-cols-[1fr_110px_110px] items-center gap-2 sm:grid-cols-[1fr_110px_110px_150px_auto]"
                  >
                    <Input
                      value={regra.nome}
                      onChange={(e) => alterarRegra(grupo, regra.id, { nome: e.target.value })}
                      placeholder="Imposto"
                      aria-label="Nome do imposto"
                      disabled={!podeGerir}
                      className="h-8"
                    />
                    <Select
                      value={regra.incidencia}
                      disabled={!podeGerir}
                      onValueChange={(v) => alterarRegra(grupo, regra.id, { incidencia: v as IncidenciaImposto })}
                    >
                      <SelectTrigger className="h-8" aria-label="Incidencia">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="compra">Compra</SelectItem>
                        <SelectItem value="venda">Venda</SelectItem>
                      </SelectContent>
                    </Select>
                    <CampoNumerico
                      tamanho="sm"
                      min={0}
                      max={99}
                      sufixo="%"
                      aria-label="Percentagem"
                      disabled={!podeGerir}
                      value={regra.percentual}
                      onChange={(percentual) => alterarRegra(grupo, regra.id, { percentual })}
                    />
                    <label className="flex items-center gap-2 text-xs">
                      <Checkbox
                        checked={!!regra.recuperavel}
                        disabled={!podeGerir || regra.incidencia === "venda"}
                        onCheckedChange={(v) => alterarRegra(grupo, regra.id, { recuperavel: v === true })}
                      />
                      Recuperavel
                    </label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={!podeGerir}
                      className="h-8 w-8"
                      title="Remover imposto"
                      onClick={() => alterarGrupo(grupo.id, { regras: grupo.regras.filter((r) => r.id !== regra.id) })}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!podeGerir}
                  className="rounded-full"
                  onClick={() => alterarGrupo(grupo.id, { regras: [...grupo.regras, novaRegra()] })}
                >
                  <Plus className="mr-1 h-3 w-3" />
                  Imposto
                </Button>
                <span className="text-xs text-muted-foreground">
                  No custo: {formatNumber2(compra)}% da compra · Na venda: {formatNumber2(venda)}% do preco
                </span>
              </div>
            </div>
          )
        })}

        <div className="flex flex-wrap justify-between gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={!podeGerir}
            className="rounded-full"
            onClick={() => setGrupos((atual) => [...atual, novoGrupo()])}
          >
            <Plus className="mr-2 h-4 w-4" />
            Novo grupo
          </Button>
          <Button type="button" onClick={gravar} disabled={!podeGerir || aGravar} className="rounded-full">
            {aGravar && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Gravar grupos
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
