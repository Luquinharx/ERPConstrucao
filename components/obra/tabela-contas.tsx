"use client"

import { useState } from "react"
import { Check, Plus, Trash2, Undo2 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CampoNumerico } from "@/components/ui/campo-numerico"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useAuth } from "@/hooks/use-auth"
import { toast } from "@/hooks/use-toast"
import { apagar, atualizar, criar } from "@/lib/firebase-service"
import { diasAte } from "@/lib/obra"
import type { Conta, TipoConta } from "@/lib/types"
import { formatCurrency, formatDate, hojeLocal, round2 } from "@/lib/utils"
import { m, t } from "@/lib/i18n"

const ORIGENS: Record<Conta["origem"], string> = {
  adjudicacao: m("Adjudicação"),
  auto: m("Auto de medição"),
  fatura: m("Fatura de fornecedor"),
  manual: m("Manual"),
}

function EstadoConta({ conta }: { conta: Conta }) {
  if (conta.estado === "pago") {
    return <Badge variant="outline" className="border-emerald-500/40 text-emerald-700">{conta.tipo === "receber" ? t("Recebido") : t("Pago")}</Badge>
  }
  const dias = diasAte(conta.vencimento)
  if (dias < 0) return <Badge variant="outline" className="border-rose-500/40 text-rose-700">{t("Vencida há {n} d", { n: -dias })}</Badge>
  if (dias <= 5) return <Badge variant="outline" className="border-amber-500/40 text-amber-700">{t("Vence em {n} d", { n: dias })}</Badge>
  return <Badge variant="outline">{t("Pendente")}</Badge>
}

interface TabelaContasProps {
  contas: Conta[]
  podeGerir: boolean
  onAlterado: () => void
  /** Conta manual nova fica ligada a esta obra. */
  obra?: { id: string; numero: string; cliente: string }
  mostrarObra?: boolean
}

export function TabelaContas({ contas, podeGerir, onAlterado, obra, mostrarObra }: TabelaContasProps) {
  const { user } = useAuth()
  const [nova, setNova] = useState<{ tipo: TipoConta; descricao: string; entidade: string; valor: number; vencimento: string } | null>(null)

  const marcar = async (conta: Conta, pago: boolean) => {
    if (!conta.id) return
    await atualizar("contas", conta.id, pago ? { estado: "pago", dataPagamento: hojeLocal() } : { estado: "pendente", dataPagamento: "" })
    toast({ title: pago ? (conta.tipo === "receber" ? t("Marcada como recebida") : t("Marcada como paga")) : t("Voltou a pendente") })
    onAlterado()
  }

  const gravarNova = async () => {
    if (!user || !nova) return
    if (!nova.descricao.trim() || nova.valor <= 0) return toast({ title: t("Indique a descrição e o valor"), variant: "destructive" })
    await criar("contas", {
      tipo: nova.tipo,
      descricao: nova.descricao.trim(),
      entidade: nova.entidade.trim() || obra?.cliente || "",
      valor: round2(nova.valor),
      vencimento: nova.vencimento,
      estado: "pendente",
      origem: "manual",
      ...(obra ? { orcamentoId: obra.id, orcamentoNumero: obra.numero } : {}),
      userId: user.uid,
    })
    setNova(null)
    onAlterado()
  }

  const ordenadas = [...contas].sort((a, b) => (a.estado === b.estado ? a.vencimento.localeCompare(b.vencimento) : a.estado === "pendente" ? -1 : 1))

  return (
    <div className="space-y-3">
      {podeGerir && (
        <div className="flex justify-end">
          <Button
            variant="outline"
            className="rounded-full"
            onClick={() => setNova({ tipo: "receber", descricao: "", entidade: "", valor: 0, vencimento: hojeLocal() })}
          >
            <Plus className="mr-2 h-4 w-4" />
            {t("Conta manual")}
          </Button>
        </div>
      )}
      <Table data-testid="tabela-contas">
        <TableHeader>
          <TableRow>
            <TableHead>{t("Vencimento")}</TableHead>
            <TableHead>{t("Descrição")}</TableHead>
            {mostrarObra && <TableHead>{t("Obra")}</TableHead>}
            <TableHead>{t("Origem")}</TableHead>
            <TableHead className="text-right">{t("Valor")}</TableHead>
            <TableHead>{t("Estado")}</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {ordenadas.length === 0 ? (
            <TableRow>
              <TableCell colSpan={mostrarObra ? 7 : 6} className="py-8 text-center text-muted-foreground">
                {t("Sem contas.")}
              </TableCell>
            </TableRow>
          ) : (
            ordenadas.map((c) => (
              <TableRow key={c.id} data-testid="linha-conta">
                <TableCell className="whitespace-nowrap">{formatDate(c.vencimento)}</TableCell>
                <TableCell>
                  <div className="font-medium">{c.descricao}</div>
                  <div className="text-xs text-muted-foreground">
                    {c.tipo === "receber" ? t("A receber") : t("A pagar")}
                    {c.entidade ? ` · ${c.entidade}` : ""}
                  </div>
                </TableCell>
                {mostrarObra && <TableCell className="whitespace-nowrap">{c.orcamentoNumero || "-"}</TableCell>}
                <TableCell className="text-sm text-muted-foreground">{ORIGENS[c.origem] ? t(ORIGENS[c.origem]) : ""}</TableCell>
                <TableCell className={`text-right tabular-nums ${c.tipo === "pagar" ? "text-rose-700" : ""}`}>
                  {c.tipo === "pagar" ? "-" : "+"}
                  {formatCurrency(c.valor)}
                </TableCell>
                <TableCell><EstadoConta conta={c} /></TableCell>
                <TableCell className="whitespace-nowrap text-right">
                  {podeGerir &&
                    (c.estado === "pendente" ? (
                      <Button size="sm" variant="outline" className="rounded-full" onClick={() => marcar(c, true)}>
                        <Check className="mr-1 h-3 w-3" />
                        {c.tipo === "receber" ? t("Recebido") : t("Pago")}
                      </Button>
                    ) : (
                      <Button size="icon" variant="ghost" title={t("Voltar a pendente")} onClick={() => marcar(c, false)}>
                        <Undo2 className="h-4 w-4" />
                      </Button>
                    ))}
                  {podeGerir && c.origem === "manual" && (
                    <Button
                      size="icon"
                      variant="ghost"
                      title={t("Eliminar")}
                      onClick={async () => {
                        if (!c.id || !confirm(t("Eliminar esta conta?"))) return
                        await apagar("contas", c.id)
                        onAlterado()
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

      <Dialog open={!!nova} onOpenChange={(a) => !a && setNova(null)}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle>{t("Conta manual")}</DialogTitle>
            <DialogDescription>{t("Para o que não nasce de uma adjudicação, auto ou fatura.")}</DialogDescription>
          </DialogHeader>
          {nova && (
            <div className="space-y-3">
              <Select value={nova.tipo} onValueChange={(tipo) => setNova({ ...nova, tipo: tipo as TipoConta })}>
                <SelectTrigger aria-label={t("Tipo de conta")}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="receber">{t("A receber")}</SelectItem>
                  <SelectItem value="pagar">{t("A pagar")}</SelectItem>
                </SelectContent>
              </Select>
              <div className="space-y-1">
                <Label>{t("Descrição")}</Label>
                <Input value={nova.descricao} onChange={(e) => setNova({ ...nova, descricao: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>{nova.tipo === "receber" ? t("Cliente") : t("Fornecedor")}</Label>
                <Input value={nova.entidade} onChange={(e) => setNova({ ...nova, entidade: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>{t("Valor (c/ IVA)")}</Label>
                  <CampoNumerico min={0} sufixo="EUR" value={nova.valor} onChange={(valor) => setNova({ ...nova, valor })} />
                </div>
                <div className="space-y-1">
                  <Label>{t("Vencimento")}</Label>
                  <Input type="date" value={nova.vencimento} onChange={(e) => setNova({ ...nova, vencimento: e.target.value })} />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setNova(null)}>{t("Cancelar")}</Button>
                <Button onClick={gravarNova} className="rounded-full">{t("Guardar")}</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
