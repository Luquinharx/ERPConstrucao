"use client"

import { Plus, Trash2, TrendingDown, TrendingUp } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { CampoNumerico } from "@/components/ui/campo-numerico"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  GRUPOS_CUSTO_OBRA,
  TAXAS_IVA_CUSTO,
  type AnaliseCustoObra,
  linhasDoGrupo,
  novaLinhaCusto,
  somarTotais,
  totaisDaLinha,
} from "@/lib/custos-obra"
import type { GrupoCustoObra, LinhaCustoObra } from "@/lib/types"
import { cn, formatCurrency, formatNumber2 } from "@/lib/utils"
import { t } from "@/lib/i18n"

interface CustosObraFolhaProps {
  linhas: LinhaCustoObra[]
  onChange: (linhas: LinhaCustoObra[]) => void
  /** Ja calculada por quem chama, com os valores de venda que fizerem sentido ali. */
  analise: AnaliseCustoObra
  /** Sem isto a folha e so de leitura: ve-se a analise, nao se lanca nada. */
  podeLancar: boolean
}

/**
 * Folha de custos reais da obra: os tres blocos e a analise da margem.
 *
 * E um componente controlado, sem estado nem gravacao proprios, porque tem
 * dois donos com regras diferentes - a aba do editor grava junto com o resto
 * do orcamento, o atalho da lista grava sozinho. Quem chama e que decide.
 */
export function CustosObraFolha({ linhas, onChange, analise, podeLancar }: CustosObraFolhaProps) {
  const totalGeral = somarTotais(linhas)

  const adicionarLinha = (grupo: GrupoCustoObra) => onChange([...linhas, novaLinhaCusto(grupo)])

  const alterarLinha = (id: string, campos: Partial<LinhaCustoObra>) =>
    onChange(linhas.map((linha) => (linha.id === id ? { ...linha, ...campos } : linha)))

  const removerLinha = (id: string) => onChange(linhas.filter((linha) => linha.id !== id))

  return (
    <div className="space-y-6">
      {GRUPOS_CUSTO_OBRA.map((grupo) => {
        const doGrupo = linhasDoGrupo(linhas, grupo.id)
        const totais = somarTotais(doGrupo)

        return (
          <section key={grupo.id} className="rounded-lg border overflow-hidden">
            <header className="flex items-center justify-between gap-4 bg-primary px-4 py-2 text-primary-foreground">
              <div className="min-w-0">
                <h3 className="text-sm font-semibold uppercase tracking-wide">{t(grupo.nome)}</h3>
                <p className="text-xs opacity-80 truncate">{t(grupo.ajuda)}</p>
              </div>
              {podeLancar && (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="rounded-full shrink-0"
                  onClick={() => adicionarLinha(grupo.id)}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  {t("Linha")}
                </Button>
              )}
            </header>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1040px] table-fixed text-sm">
                <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">{t("Descrição do item")}</th>
                    <th className="px-2 py-2 text-left font-medium w-[180px]">{t("Fornecedor / Loja")}</th>
                    <th className="px-2 py-2 text-left font-medium w-[64px]">{t("UN")}</th>
                    <th className="px-2 py-2 text-right font-medium w-[96px]">{t("Quantidade")}</th>
                    <th className="px-2 py-2 text-right font-medium w-[110px]">{t("V. Un. c/IVA")}</th>
                    <th className="px-2 py-2 text-left font-medium w-[140px]">{t("IVA")}</th>
                    <th className="px-2 py-2 text-right font-medium w-[110px]">{t("Total s/IVA")}</th>
                    <th className="px-2 py-2 text-right font-medium w-[110px]">{t("Total c/IVA")}</th>
                    <th className="w-[44px]" />
                  </tr>
                </thead>
                <tbody>
                  {doGrupo.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-3 py-6 text-center text-muted-foreground">
                        {t("Sem custos lançados neste bloco.")}
                      </td>
                    </tr>
                  )}
                  {doGrupo.map((linha) => {
                    const totaisLinha = totaisDaLinha(linha)
                    return (
                      <tr key={linha.id} className="border-t">
                        <td className="px-3 py-1.5">
                          <Input
                            value={linha.descricao}
                            disabled={!podeLancar}
                            placeholder={t(grupo.exemploDescricao)}
                            onChange={(evento) => alterarLinha(linha.id, { descricao: evento.target.value })}
                            className="h-8"
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <Input
                            value={linha.fornecedor || ""}
                            disabled={!podeLancar}
                            placeholder={t(grupo.exemploFornecedor)}
                            onChange={(evento) => alterarLinha(linha.id, { fornecedor: evento.target.value })}
                            className="h-8"
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <Input
                            value={linha.unidade}
                            disabled={!podeLancar}
                            onChange={(evento) => alterarLinha(linha.id, { unidade: evento.target.value })}
                            className="h-8 text-center"
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <CampoNumerico
                            value={linha.quantidade}
                            disabled={!podeLancar}
                            min={0}
                            tamanho="sm"
                            onChange={(valor) => alterarLinha(linha.id, { quantidade: valor })}
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <CampoNumerico
                            value={linha.valorUnitario}
                            disabled={!podeLancar}
                            min={0}
                            tamanho="sm"
                            sufixo="EUR"
                            onChange={(valor) => alterarLinha(linha.id, { valorUnitario: valor })}
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <Select
                            value={String(linha.taxaIVA)}
                            disabled={!podeLancar}
                            onValueChange={(valor) => alterarLinha(linha.id, { taxaIVA: Number(valor) })}
                          >
                            <SelectTrigger className="h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {TAXAS_IVA_CUSTO.map((taxa) => (
                                <SelectItem key={taxa.valor} value={String(taxa.valor)}>
                                  {t(taxa.nome)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-2 py-1.5 text-right font-medium tabular-nums">
                          {formatCurrency(totaisLinha.semIVA)}
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">
                          {formatCurrency(totaisLinha.comIVA)}
                        </td>
                        <td className="px-1 py-1.5">
                          {podeLancar && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => removerLinha(linha.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t bg-muted/40 font-semibold">
                    <td colSpan={6} className="px-3 py-2 text-right uppercase text-xs tracking-wide">
                      {t("Total {grupo}", { grupo: t(grupo.nome) })}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">{formatCurrency(totais.semIVA)}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{formatCurrency(totais.comIVA)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>
        )
      })}

      <div className="flex flex-wrap items-center justify-end gap-x-8 gap-y-2 rounded-lg border bg-muted/40 px-4 py-3">
        <span className="text-xs font-semibold uppercase tracking-wide">{t("Total da obra")}</span>
        <Valor rotulo={t("Custo (s/IVA)")} valor={totalGeral.semIVA} destaque />
        <Valor rotulo={t("IVA suportado")} valor={totalGeral.iva} />
        <Valor rotulo={t("Pago (c/IVA)")} valor={totalGeral.comIVA} />
      </div>

      <Analise analise={analise} />
    </div>
  )
}

function Valor({ rotulo, valor, destaque }: { rotulo: string; valor: number; destaque?: boolean }) {
  return (
    <div className="text-right">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{rotulo}</div>
      <div className={cn("tabular-nums", destaque ? "text-base font-semibold" : "text-sm")}>
        {formatCurrency(valor)}
      </div>
    </div>
  )
}

/**
 * A pergunta que motiva tudo isto: a obra deu o lucro que a proposta prometia?
 */
function Analise({ analise }: { analise: AnaliseCustoObra }) {
  const perdeuMargem = analise.desvioMargem < 0
  const prejuizo = analise.margemReal < 0

  return (
    <section className="rounded-lg border">
      <header className="border-b px-4 py-2">
        <h3 className="text-sm font-semibold">{t("Análise da obra")}</h3>
        <p className="text-xs text-muted-foreground">
          {t("Margem prevista quando se vendeu, contra a margem que a obra deixou de facto.")}
        </p>
      </header>

      <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <Cartao
          titulo={t("Vendido (s/IVA)")}
          valor={formatCurrency(analise.baseTributavel)}
          nota={t("IVA cobrado ao cliente: {valor}", { valor: formatCurrency(analise.ivaCobrado) })}
        />
        <Cartao
          titulo={t("Custo orçado")}
          valor={formatCurrency(analise.custoOrcado)}
          nota={t("Margem prevista: {valor} ({percent}%)", {
            valor: formatCurrency(analise.margemPrevista),
            percent: formatNumber2(analise.margemPrevistaPercent),
          })}
        />
        <Cartao
          titulo={t("Custo real")}
          valor={formatCurrency(analise.custoReal)}
          nota={
            analise.semLancamentos
              ? t("Ainda sem custos lançados")
              : t("Desvio: {valor} ({percent}%)", {
                  valor: (analise.desvioCusto >= 0 ? "+" : "") + formatCurrency(analise.desvioCusto),
                  percent: formatNumber2(analise.desvioCustoPercent),
                })
          }
          tom={analise.semLancamentos ? "neutro" : analise.desvioCusto > 0 ? "mau" : "bom"}
        />
        <Cartao
          titulo={t("Margem real")}
          valor={`${formatCurrency(analise.margemReal)} (${formatNumber2(analise.margemRealPercent)}%)`}
          nota={
            analise.semLancamentos
              ? t("Lance os custos para saber")
              : prejuizo
                ? t("A obra deu prejuízo")
                : perdeuMargem
                  ? t("Perdeu {valor} face ao previsto", { valor: formatCurrency(Math.abs(analise.desvioMargem)) })
                  : t("Ganhou {valor} face ao previsto", { valor: formatCurrency(Math.abs(analise.desvioMargem)) })
          }
          tom={analise.semLancamentos ? "neutro" : prejuizo || perdeuMargem ? "mau" : "bom"}
          icone={perdeuMargem ? "desce" : "sobe"}
        />
      </div>

      <div className="border-t px-4 py-3 text-sm">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="font-medium">{t("Acerto de IVA")}</span>
          <span className="text-muted-foreground">
            {t("Cobrado {cobrado} - suportado {suportado} =", {
              cobrado: formatCurrency(analise.ivaCobrado),
              suportado: formatCurrency(analise.ivaSuportado),
            })}{" "}
            <strong className="text-foreground tabular-nums">{formatCurrency(Math.abs(analise.saldoIVA))}</strong>{" "}
            {analise.saldoIVA >= 0 ? t("a entregar ao Estado") : t("a recuperar do Estado")}
          </span>
        </div>
      </div>
    </section>
  )
}

function Cartao({
  titulo,
  valor,
  nota,
  tom = "neutro",
  icone,
}: {
  titulo: string
  valor: string
  nota: string
  tom?: "neutro" | "bom" | "mau"
  icone?: "sobe" | "desce"
}) {
  const cor = tom === "bom" ? "text-emerald-600" : tom === "mau" ? "text-destructive" : "text-muted-foreground"
  return (
    <div className="rounded-lg border p-3">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{titulo}</div>
      <div className="mt-1 flex items-center gap-1 text-lg font-semibold tabular-nums">
        {icone === "sobe" && <TrendingUp className="h-4 w-4 text-emerald-600" />}
        {icone === "desce" && <TrendingDown className="h-4 w-4 text-destructive" />}
        <span>{valor}</span>
      </div>
      <div className={cn("mt-1 text-xs", cor)}>{nota}</div>
    </div>
  )
}
