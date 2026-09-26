"use client"

import { useEffect, useMemo, useState } from "react"
import { Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { CustosObraFolha } from "@/components/orcamentos/custos-obra-folha"
import { useToast } from "@/hooks/use-toast"
import { updateOrcamento } from "@/lib/firebase-service"
import { analisarCustoObra, prepararParaGravar, valoresVendidosDoOrcamento } from "@/lib/custos-obra"
import type { LinhaCustoObra, Orcamento } from "@/lib/types"

interface CustosObraDialogProps {
  orcamento: Orcamento | null
  open: boolean
  onOpenChange: (aberto: boolean) => void
  /** Custo previsto no orcamento, ja calculado pela pagina. */
  custoOrcado: number
  /** Sem isto o ecra abre em leitura: ve-se a analise, nao se lanca nada. */
  podeLancar: boolean
  /** Devolve as linhas gravadas para a lista se atualizar sem reler tudo. */
  onGuardado?: (orcamentoId: string, linhas: LinhaCustoObra[]) => void
}

/**
 * Atalho para lancar custos sem abrir o orcamento todo.
 *
 * A mesma folha existe como aba do editor; aqui grava sozinha, porque quem
 * entra por este caminho nao esta a mexer em mais nada da proposta.
 */
export function CustosObraDialog({
  orcamento,
  open,
  onOpenChange,
  custoOrcado,
  podeLancar,
  onGuardado,
}: CustosObraDialogProps) {
  const { toast } = useToast()
  const [linhas, setLinhas] = useState<LinhaCustoObra[]>([])
  const [aGravar, setAGravar] = useState(false)

  // Recarrega sempre que muda a obra aberta, para nao arrastar as linhas da anterior.
  useEffect(() => {
    if (!open) return
    setLinhas(orcamento?.custosObra ? orcamento.custosObra.map((linha) => ({ ...linha })) : [])
  }, [open, orcamento])

  const analise = useMemo(() => {
    if (!orcamento) return null
    return analisarCustoObra(valoresVendidosDoOrcamento(orcamento, custoOrcado), linhas)
  }, [orcamento, custoOrcado, linhas])

  const guardar = async () => {
    if (!orcamento?.id) return
    setAGravar(true)
    try {
      const limpas = prepararParaGravar(linhas)
      await updateOrcamento(orcamento.id, { custosObra: limpas })
      setLinhas(limpas)
      onGuardado?.(orcamento.id, limpas)
      toast({
        title: "Custos da obra guardados",
        description: `${limpas.length} ${limpas.length === 1 ? "linha lancada" : "linhas lancadas"}.`,
      })
      onOpenChange(false)
    } catch (erro) {
      console.error("Erro ao guardar custos da obra:", erro)
      toast({
        title: "Nao foi possivel guardar",
        description: "Verifique a ligacao e tente novamente.",
        variant: "destructive",
      })
    } finally {
      setAGravar(false)
    }
  }

  if (!orcamento || !analise) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[1100px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Custos reais da obra - {orcamento.numero}</DialogTitle>
          <DialogDescription>
            Lance aqui o que a obra gastou de facto. Escreva o valor da fatura (com IVA) e escolha a
            taxa: o custo sem IVA e o IVA suportado sao calculados. Nao e preciso discriminar a fatura
            linha a linha - uma linha com o total do documento chega.
          </DialogDescription>
        </DialogHeader>

        <CustosObraFolha linhas={linhas} onChange={setLinhas} analise={analise} podeLancar={podeLancar} />

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          {podeLancar && (
            <Button type="button" onClick={() => void guardar()} disabled={aGravar}>
              {aGravar && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Guardar custos
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
