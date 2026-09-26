"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, Lock } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { SemAcesso } from "@/components/sem-acesso"
import { OrcamentoEditor } from "@/components/orcamentos/orcamento-editor"
import { useAuth } from "@/hooks/use-auth"
import { useConfiguracao } from "@/hooks/use-configuracao"
import { usePermissoes } from "@/hooks/use-permissoes"
import { toast } from "@/hooks/use-toast"
import { FirebaseService } from "@/lib/firebase-service"
import { getFase, podeEditar } from "@/lib/orcamento-fases"
import { numeroCompleto } from "@/lib/numeracao"
import type { Cliente, Funcionario, Orcamento, Servico } from "@/lib/types"

/**
 * Ecra de edicao de uma proposta, em pagina propria.
 *
 * O id "novo" abre uma proposta em branco. Ter um endereco por proposta e o
 * que faz o botao de voltar do browser funcionar e permite enviar a alguem o
 * link do orcamento em que se esta a trabalhar.
 */
export default function EditarOrcamentoPage() {
  const router = useRouter()
  const parametros = useParams<{ id: string }>()
  const id = parametros?.id
  const ehNovo = id === "novo"

  const { user } = useAuth()
  const { configuracao } = useConfiguracao()
  const { pode, carregando: permissoesACarregar } = usePermissoes()

  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([])
  const [servicos, setServicos] = useState<Servico[]>([])
  const [aCarregar, setACarregar] = useState(true)

  const carregar = useCallback(async () => {
    if (!user) return

    setACarregar(true)
    try {
      const [orcamentosData, funcionariosData, servicosData, clientesData] = await Promise.all([
        FirebaseService.getOrcamentos(user.uid),
        FirebaseService.getFuncionarios(user.uid),
        FirebaseService.getServicos(user.uid),
        FirebaseService.getClientes(user.uid),
      ])

      setOrcamentos(orcamentosData)
      setFuncionarios(funcionariosData.filter((item) => item.ativo))
      setServicos(servicosData)
      setClientes(clientesData)
    } catch (error) {
      console.error("Erro ao carregar dados:", error)
      toast({
        title: "Erro ao carregar dados",
        description: "Nao foi possivel carregar os dados necessarios.",
        variant: "destructive",
      })
    } finally {
      setACarregar(false)
    }
  }, [user])

  useEffect(() => {
    void carregar()
  }, [carregar])

  const orcamento = useMemo(
    () => (ehNovo ? null : orcamentos.find((item) => item.id === id) || null),
    [ehNovo, orcamentos, id],
  )

  const voltar = () => router.push("/orcamentos")

  if (permissoesACarregar || aCarregar) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  const permissaoNecessaria = ehNovo ? "orcamentos.criar" : "orcamentos.editar"
  if (!pode(permissaoNecessaria)) {
    return <SemAcesso area="Orcamentos" requisito={ehNovo ? "a permissao de criar propostas" : "a permissao de editar propostas"} />
  }

  if (!ehNovo && !orcamento) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <h2 className="text-lg font-medium">Proposta nao encontrada</h2>
          <p className="mt-1 text-muted-foreground">
            Pode ter sido apagada, ou o endereco estar errado.
          </p>
          <Button onClick={voltar} className="mt-4 rounded-full">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar aos orcamentos
          </Button>
        </CardContent>
      </Card>
    )
  }

  /**
   * Fora de rascunho a proposta esta fechada: o que o cliente recebeu nao se
   * reescreve por cima. Os custos reais sao a excepcao e vivem na sua aba,
   * por isso mandamos para o atalho da lista em vez de bloquear tudo.
   */
  if (orcamento && !podeEditar(orcamento.status)) {
    const fase = getFase(orcamento.status)
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <Lock className="mb-3 h-10 w-10 text-muted-foreground" />
          <h2 className="text-lg font-medium">
            {numeroCompleto(orcamento, configuracao)} esta em {fase.nome}
          </h2>
          <p className="mt-1 max-w-md text-muted-foreground">
            Nesta fase a proposta ja nao se edita. Para a alterar, crie uma revisao a partir da lista. Os custos reais
            da obra continuam a poder ser lancados pelo botao proprio.
          </p>
          <Button onClick={voltar} className="mt-4 rounded-full">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar aos orcamentos
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={voltar} className="rounded-full" title="Voltar aos orcamentos">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">
              {orcamento ? numeroCompleto(orcamento, configuracao) : "Novo Orcamento"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {orcamento ? orcamento.cliente.nome : "Preencha as abas e grave no fim."}
            </p>
          </div>
        </div>
        {orcamento && (
          <Badge variant="outline" className={getFase(orcamento.status).cor}>
            {getFase(orcamento.status).nome}
          </Badge>
        )}
      </div>

      <OrcamentoEditor
        orcamento={orcamento}
        orcamentos={orcamentos}
        clientes={clientes}
        funcionarios={funcionarios}
        servicos={servicos}
        onGuardado={voltar}
        onCancelar={voltar}
      />
    </div>
  )
}
