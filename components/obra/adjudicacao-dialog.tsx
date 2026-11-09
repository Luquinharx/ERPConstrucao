"use client"

import { useEffect, useMemo, useState } from "react"
import { Loader2, Plus, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { CampoNumerico } from "@/components/ui/campo-numerico"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/hooks/use-auth"
import { useConfiguracao } from "@/hooks/use-configuracao"
import { toast } from "@/hooks/use-toast"
import { gravarAdjudicacao } from "@/lib/firebase-service"
import { numeroAoPassarAObra, numeroCompleto, tipoDoDocumento } from "@/lib/numeracao"
import { contasDaAdjudicacao, planoPadrao, type ParcelaPlano } from "@/lib/obra"
import { resumoDeValores } from "@/lib/orcamento-calculos"
import type { Orcamento, StatusOrcamento } from "@/lib/types"
import { formatCurrency, formatNumber2, hojeLocal, round2 } from "@/lib/utils"
import { t } from "@/lib/i18n"

interface AdjudicacaoDialogProps {
  orcamento: Orcamento | null
  orcamentos: Orcamento[]
  onOpenChange: (aberto: boolean) => void
  onAdjudicado: () => void
}

/**
 * Adjudicar: o cliente aceitou. Num so passo fica registado quando e por
 * quanto, o sinal, como se fatura o resto e, se for concurso, passa a obra.
 * As parcelas viram contas a receber com alerta antes do vencimento.
 */
export function AdjudicacaoDialog({ orcamento, orcamentos, onOpenChange, onAdjudicado }: AdjudicacaoDialogProps) {
  const { user } = useAuth()
  const { configuracao } = useConfiguracao()
  const [data, setData] = useState(hojeLocal())
  const [valor, setValor] = useState(0)
  const [sinal, setSinal] = useState(0)
  const [plano, setPlano] = useState<"parcelas" | "autos">("parcelas")
  const [parcelas, setParcelas] = useState<ParcelaPlano[]>([])
  const [passarAObra, setPassarAObra] = useState(true)
  const [notas, setNotas] = useState("")
  const [aGravar, setAGravar] = useState(false)

  useEffect(() => {
    if (!orcamento) return
    const hoje = hojeLocal()
    setData(hoje)
    setValor(resumoDeValores(orcamento).totalVenda)
    setSinal(0)
    setPlano("parcelas")
    setParcelas(planoPadrao(hoje))
    setPassarAObra(tipoDoDocumento(orcamento) !== "obra")
    setNotas("")
  }, [orcamento])

  const somaPercent = round2(parcelas.reduce((s, p) => s + (Number(p.percent) || 0), 0))
  const previa = useMemo(
    () =>
      orcamento
        ? contasDaAdjudicacao({ userId: "" }, valor, sinal, data, plano === "parcelas" ? parcelas : [])
        : [],
    [orcamento, valor, sinal, data, plano, parcelas],
  )

  if (!orcamento) return null
  const jaEObra = tipoDoDocumento(orcamento) === "obra"

  const alterarParcela = (i: number, parcial: Partial<ParcelaPlano>) =>
    setParcelas((atual) => atual.map((p, j) => (j === i ? { ...p, ...parcial } : p)))

  const confirmar = async () => {
    if (!user || !orcamento.id) return
    if (valor <= 0) return toast({ title: t("Indique o valor adjudicado"), variant: "destructive" })
    if (sinal > valor) return toast({ title: t("O sinal não pode ultrapassar o valor adjudicado"), variant: "destructive" })
    if (plano === "parcelas" && Math.abs(somaPercent - 100) > 0.01)
      return toast({
        title: t("As parcelas somam {percentagem}%: têm de somar 100%", { percentagem: formatNumber2(somaPercent) }),
        variant: "destructive",
      })

    const alteracoes: Partial<Orcamento> = {
      status: "aceite" as StatusOrcamento,
      adjudicacao: { data, valor: round2(valor), sinal: round2(sinal), plano, utilizador: user.email || user.uid },
      historicoFases: [
        ...(orcamento.historicoFases || []),
        {
          estado: "aceite" as StatusOrcamento,
          data: new Date(),
          utilizador: user.email || user.uid,
          nota: t("Adjudicada por {valor}", { valor: formatCurrency(valor) }) + (notas.trim() ? ` - ${notas.trim()}` : ""),
        },
      ],
    }
    let numeroObra = orcamento
    if (passarAObra && !jaEObra) {
      const { numero } = numeroAoPassarAObra(orcamentos, orcamento)
      alteracoes.tipoDocumento = "obra"
      alteracoes.numero = numero
      numeroObra = { ...orcamento, numero, tipoDocumento: "obra" }
    }

    const contas = contasDaAdjudicacao(
      {
        orcamentoId: orcamento.id,
        orcamentoNumero: numeroCompleto(numeroObra, configuracao),
        entidade: orcamento.cliente.nome,
        userId: user.uid,
      },
      valor,
      sinal,
      data,
      plano === "parcelas" ? parcelas : [],
    )

    setAGravar(true)
    try {
      await gravarAdjudicacao(orcamento.id, alteracoes, contas)
      const passou = passarAObra && !jaEObra
      const n = contas.length
      toast({
        title: t("Proposta adjudicada"),
        description:
          n === 1
            ? passou
              ? t("{n} conta a receber criada e passou a obra.", { n })
              : t("{n} conta a receber criada.", { n })
            : passou
              ? t("{n} contas a receber criadas e passou a obra.", { n })
              : t("{n} contas a receber criadas.", { n }),
      })
      onAdjudicado()
      onOpenChange(false)
    } catch (error) {
      console.error("Erro ao adjudicar:", error)
      toast({ title: t("Não foi possível adjudicar"), variant: "destructive" })
    } finally {
      setAGravar(false)
    }
  }

  return (
    <Dialog open={!!orcamento} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[620px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("Adjudicar {numero}", { numero: numeroCompleto(orcamento, configuracao) })}</DialogTitle>
          <DialogDescription>
            {t("{cliente} aceitou. Registe o valor, o sinal e como se fatura o resto.", { cliente: orcamento.cliente.nome })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1">
              <Label>{t("Data da adjudicação")}</Label>
              <Input type="date" value={data} onChange={(e) => setData(e.target.value)} className="rounded-full" />
            </div>
            <div className="space-y-1">
              <Label>{t("Valor adjudicado (c/ IVA)")}</Label>
              <CampoNumerico min={0} sufixo="EUR" value={valor} onChange={setValor} aria-label={t("Valor adjudicado")} className="rounded-full" />
            </div>
            <div className="space-y-1">
              <Label>{t("Sinal já recebido")}</Label>
              <CampoNumerico min={0} sufixo="EUR" value={sinal} onChange={setSinal} aria-label={t("Sinal")} className="rounded-full" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t("Como se fatura o remanescente ({valor})", { valor: formatCurrency(round2(valor - sinal)) })}</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              {(
                [
                  ["parcelas", t("Parcelas com data"), t("Ex.: 50% na adjudicação e 50% na conclusão.")],
                  ["autos", t("Por autos de medição"), t("Fatura-se o que for medido em cada auto.")],
                ] as const
              ).map(([id, titulo, ajuda]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setPlano(id)}
                  className={`rounded-lg border p-3 text-left text-sm ${plano === id ? "border-primary ring-1 ring-primary bg-primary/5" : "hover:bg-muted"}`}
                >
                  <div className="font-medium">{titulo}</div>
                  <div className="text-xs text-muted-foreground">{ajuda}</div>
                </button>
              ))}
            </div>
          </div>

          {plano === "parcelas" && (
            <div className="space-y-2" data-testid="parcelas">
              {parcelas.map((p, i) => (
                <div key={i} className="grid grid-cols-[1fr_90px_150px_auto] items-center gap-2">
                  <Input
                    value={p.descricao}
                    aria-label={t("Descrição da parcela")}
                    onChange={(e) => alterarParcela(i, { descricao: e.target.value })}
                  />
                  <CampoNumerico tamanho="sm" min={0} max={100} sufixo="%" aria-label={t("Percentagem")} value={p.percent} onChange={(percent) => alterarParcela(i, { percent })} />
                  <Input type="date" value={p.vencimento} aria-label={t("Vencimento")} onChange={(e) => alterarParcela(i, { vencimento: e.target.value })} />
                  <Button type="button" variant="ghost" size="icon" disabled={parcelas.length <= 1} onClick={() => setParcelas((a) => a.filter((_, j) => j !== i))}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <div className="flex items-center justify-between">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-full"
                  onClick={() => setParcelas((a) => [...a, { descricao: t("{n}.ª fatura", { n: a.length + 1 }), percent: 0, vencimento: data }])}
                >
                  <Plus className="mr-1 h-3 w-3" />
                  {t("Parcela")}
                </Button>
                <span className={`text-xs ${Math.abs(somaPercent - 100) > 0.01 ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                  {t("Soma: {percentagem}%", { percentagem: formatNumber2(somaPercent) })}
                </span>
              </div>
            </div>
          )}

          {!jaEObra && (
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={passarAObra} onCheckedChange={(v) => setPassarAObra(v === true)} />
              {t("Passar já a obra (o número passa de concurso a obra)")}
            </label>
          )}

          <div className="space-y-1">
            <Label>{t("Notas (opcional)")}</Label>
            <Textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={2} />
          </div>

          <div className="rounded-lg bg-muted p-3 text-sm space-y-1" data-testid="previa-contas">
            <div className="font-medium">{t("Contas a receber que vão ser criadas")}</div>
            {previa.length === 0 ? (
              <div className="text-xs text-muted-foreground">{t("Nenhuma: o remanescente fatura-se pelos autos de medição.")}</div>
            ) : (
              previa.map((c, i) => (
                <div key={i} className="flex justify-between gap-2">
                  <span>
                    {c.descricao} · {c.vencimento.split("-").reverse().join("/")}
                    {c.estado === "pago" && ` · ${t("já recebido")}`}
                  </span>
                  <span className="tabular-nums">{formatCurrency(c.valor)}</span>
                </div>
              ))
            )}
            <p className="pt-1 text-xs text-muted-foreground">
              {t("O financeiro avisa 5 dias antes de cada vencimento.")}
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t("Cancelar")}
          </Button>
          <Button type="button" onClick={confirmar} disabled={aGravar} className="rounded-full">
            {aGravar && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t("Confirmar adjudicação")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
