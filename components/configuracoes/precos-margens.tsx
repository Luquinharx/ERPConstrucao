"use client"

import { useEffect, useState } from "react"
import { Loader2, Plus, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { CampoNumerico } from "@/components/ui/campo-numerico"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useConfiguracao } from "@/hooks/use-configuracao"
import { usePermissoes } from "@/hooks/use-permissoes"
import { toast } from "@/hooks/use-toast"
import { ESTRUTURA_PADRAO, especialidadesDe, margemSobreVenda } from "@/lib/precificacao"
import type { Especialidade } from "@/lib/types"
import { formatNumber2, round2 } from "@/lib/utils"
import { t } from "@/lib/i18n"

/**
 * Parametros de preco da folha de obra: estrutura (FI) e margem por
 * especialidade. Mudar aqui vale para as propostas novas e para as que se
 * voltarem a abrir no modelo por especialidade.
 */
export function PrecosMargens() {
  const { configuracao, guardar } = useConfiguracao()
  const { pode } = usePermissoes()
  const podeGerir = pode("configuracoes.gerir")

  const [estrutura, setEstrutura] = useState(configuracao.estruturaPercent ?? ESTRUTURA_PADRAO)
  const [especialidades, setEspecialidades] = useState<Especialidade[]>(especialidadesDe(configuracao))
  const [custoFixoHora, setCustoFixoHora] = useState(configuracao.custoFixoHora ?? 0)
  const [aGravar, setAGravar] = useState(false)

  useEffect(() => {
    setEstrutura(configuracao.estruturaPercent ?? ESTRUTURA_PADRAO)
    setEspecialidades(especialidadesDe(configuracao))
    setCustoFixoHora(configuracao.custoFixoHora ?? 0)
  }, [configuracao])

  const alterar = (id: string, parcial: Partial<Especialidade>) =>
    setEspecialidades((atual) => atual.map((e) => (e.id === id ? { ...e, ...parcial } : e)))

  const gravar = async () => {
    if (especialidades.some((e) => !e.nome.trim())) {
      toast({ title: t("Todas as especialidades precisam de nome"), variant: "destructive" })
      return
    }
    setAGravar(true)
    try {
      await guardar({
        estruturaPercent: round2(estrutura),
        especialidades: especialidades.map((e) => ({ ...e, nome: e.nome.trim(), margem: round2(e.margem) })),
        custoFixoHora: round2(custoFixoHora),
      })
      toast({ title: t("Preços e margens guardados") })
    } catch {
      toast({ title: t("Não foi possível guardar"), variant: "destructive" })
    } finally {
      setAGravar(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("Preços e margens")}</CardTitle>
        <CardDescription>
          {t(
            "Como na folha de obra: preço = custo x (1 + estrutura + margem da especialidade). Ex.: estrutura 15% e construção civil 15% dão um preço de custo x 1,30.",
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>{t("Estrutura (custos fixos da empresa)")}</Label>
            <CampoNumerico
              min={0}
              sufixo="%"
              disabled={!podeGerir}
              aria-label={t("Estrutura")}
              value={estrutura}
              onChange={setEstrutura}
              className="rounded-full"
            />
            <p className="text-xs text-muted-foreground">
              {t("O \"FI Estrutura\" da folha: soma-se a todas as especialidades.")}
            </p>
          </div>
          <div className="space-y-2">
            <Label>{t("Custo fixo por hora de mão de obra")}</Label>
            <CampoNumerico
              min={0}
              sufixo="EUR/h"
              disabled={!podeGerir}
              aria-label={t("Custo fixo por hora")}
              value={custoFixoHora}
              onChange={setCustoFixoHora}
              className="rounded-full"
            />
            <p className="text-xs text-muted-foreground">
              {t("Opcional. Cada hora registada no livro de ponto carrega este valor no apuramento da obra.")}
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <Label>{t("Especialidades")}</Label>
          {especialidades.map((e) => {
            const fator = 1 + (estrutura + e.margem) / 100
            return (
              <div key={e.id} className="grid grid-cols-[1fr_130px_auto] items-center gap-2 sm:grid-cols-[1fr_130px_220px_auto]">
                <Input
                  value={e.nome}
                  disabled={!podeGerir}
                  aria-label={t("Nome da especialidade")}
                  onChange={(ev) => alterar(e.id, { nome: ev.target.value })}
                />
                <CampoNumerico
                  tamanho="sm"
                  min={0}
                  sufixo="%"
                  disabled={!podeGerir}
                  aria-label={t("Margem {nome}", { nome: e.nome })}
                  value={e.margem}
                  onChange={(margem) => alterar(e.id, { margem })}
                />
                <span className="hidden text-xs text-muted-foreground sm:block">
                  {t("custo x {fator} · {margem}% da venda", {
                    fator: formatNumber2(fator),
                    margem: formatNumber2(margemSobreVenda(100, 100 * fator)),
                  })}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={!podeGerir || especialidades.length <= 1}
                  title={t("Remover")}
                  onClick={() => setEspecialidades((atual) => atual.filter((x) => x.id !== e.id))}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )
          })}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!podeGerir}
            className="rounded-full"
            onClick={() =>
              setEspecialidades((atual) => [...atual, { id: `esp-${Date.now()}`, nome: "", margem: 15 }])
            }
          >
            <Plus className="mr-1 h-3 w-3" />
            {t("Especialidade")}
          </Button>
        </div>

        <div className="flex justify-end">
          <Button type="button" onClick={gravar} disabled={!podeGerir || aGravar} className="rounded-full">
            {aGravar && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t("Guardar preços e margens")}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
