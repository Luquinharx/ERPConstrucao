"use client"

import type React from "react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { Edit, HardHat, Plus, Trash2 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CampoNumerico } from "@/components/ui/campo-numerico"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/hooks/use-auth"
import { usePermissoes } from "@/hooks/use-permissoes"
import { toast } from "@/hooks/use-toast"
import { FirebaseService, addFuncao, deleteFuncao, getFuncoes, updateFuncao } from "@/lib/firebase-service"
import {
  custoHoraFuncionario,
  custoMedioFuncao,
  descricaoClienteFuncao,
  funcionariosDaFuncao,
  margemPorPreco,
  precoPorMargem,
} from "@/lib/produto-calculos"
import type { FuncaoMaoObra, Funcionario } from "@/lib/types"
import { formatCurrency, formatNumber2, round2 } from "@/lib/utils"
import { t } from "@/lib/i18n"

interface FuncaoForm {
  nome: string
  precoHora: number
  descricaoCliente: string
  observacoes: string
  ativo: boolean
}

const formVazio = (nome = ""): FuncaoForm => ({ nome, precoHora: 0, descricaoCliente: "", observacoes: "", ativo: true })

/**
 * Funcoes de mao de obra.
 *
 * O preco/hora ao cliente e da funcao: a hora de pintor custa o mesmo ao
 * cliente seja quem for pintar. O custo/hora e a media dos funcionarios dessa
 * funcao; no orcamento, escolher o funcionario troca a media pelo custo dele.
 */
export default function FuncoesPage() {
  const { user } = useAuth()
  const { pode } = usePermissoes()
  const podeGerir = pode("funcionarios.gerir")

  const [funcoes, setFuncoes] = useState<FuncaoMaoObra[]>([])
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([])
  const [aCarregar, setACarregar] = useState(true)
  const [aberto, setAberto] = useState(false)
  const [editando, setEditando] = useState<FuncaoMaoObra | null>(null)
  const [form, setForm] = useState<FuncaoForm>(formVazio())
  const [aGravar, setAGravar] = useState(false)

  const carregar = useCallback(async () => {
    if (!user) return
    try {
      const [listaFuncoes, listaFuncionarios] = await Promise.all([
        getFuncoes(),
        FirebaseService.getFuncionarios(user.uid),
      ])
      setFuncoes(listaFuncoes)
      setFuncionarios(listaFuncionarios)
    } catch (error) {
      console.error("Erro ao carregar funcoes:", error)
      toast({ title: t("Erro ao carregar funções"), variant: "destructive" })
    } finally {
      setACarregar(false)
    }
  }, [user])

  useEffect(() => {
    void carregar()
  }, [carregar])

  /** Funcoes que os funcionarios ja usam mas que ainda nao tem preco definido. */
  const semCadastro = useMemo(() => {
    const conhecidas = new Set(funcoes.map((f) => f.nome.trim().toLowerCase()))
    const nomes = new Map<string, string>()
    for (const f of funcionarios) {
      const nome = (f.funcao || "").trim()
      if (nome && f.ativo !== false && !conhecidas.has(nome.toLowerCase())) nomes.set(nome.toLowerCase(), nome)
    }
    return Array.from(nomes.values()).sort()
  }, [funcoes, funcionarios])

  const custoForm = custoMedioFuncao({ nome: form.nome }, funcionarios)

  const abrir = (funcao: FuncaoMaoObra | null, nome = "") => {
    setEditando(funcao)
    setForm(
      funcao
        ? {
            nome: funcao.nome,
            precoHora: funcao.precoHora,
            descricaoCliente: funcao.descricaoCliente || "",
            observacoes: funcao.observacoes || "",
            ativo: funcao.ativo !== false,
          }
        : formVazio(nome),
    )
    setAberto(true)
  }

  const gravar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    const nome = form.nome.trim()
    if (!nome) {
      toast({ title: t("Indique o nome da função"), variant: "destructive" })
      return
    }
    const repetida = funcoes.some((f) => f.id !== editando?.id && f.nome.trim().toLowerCase() === nome.toLowerCase())
    if (repetida) {
      toast({
        title: t("A função já existe"),
        description: t('"{nome}" já está registada.', { nome }),
        variant: "destructive",
      })
      return
    }

    setAGravar(true)
    try {
      const dados = {
        nome,
        precoHora: round2(form.precoHora),
        descricaoCliente: form.descricaoCliente.trim(),
        observacoes: form.observacoes.trim(),
        ativo: form.ativo,
      }
      if (editando?.id) await updateFuncao(editando.id, dados)
      else await addFuncao(dados, user.uid)
      toast({ title: editando ? t("Função atualizada") : t("Função registada") })
      setAberto(false)
      await carregar()
    } catch (error) {
      console.error("Erro ao gravar funcao:", error)
      toast({ title: t("Não foi possível guardar a função"), variant: "destructive" })
    } finally {
      setAGravar(false)
    }
  }

  const apagar = async (funcao: FuncaoMaoObra) => {
    if (!funcao.id || !confirm(t('Eliminar a função "{nome}"? Os funcionários não são alterados.', { nome: funcao.nome })))
      return
    try {
      await deleteFuncao(funcao.id)
      await carregar()
    } catch {
      toast({ title: t("Não foi possível eliminar"), variant: "destructive" })
    }
  }

  if (aCarregar) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">{t("Funções de mão de obra")}</h1>
          <p className="text-muted-foreground mt-2">
            {t("Preço/hora cobrado ao cliente e custo médio/hora da equipa de cada função")}
          </p>
        </div>
        <Button disabled={!podeGerir} onClick={() => abrir(null)} className="rounded-full">
          <Plus className="h-4 w-4 mr-2" />
          {t("Nova função")}
        </Button>
      </div>

      {semCadastro.length > 0 && (
        <Card className="border-dashed">
          <CardContent className="py-4 space-y-2">
            <p className="text-sm">
              {t("Os funcionários usam estas funções, que ainda não têm preço ao cliente. Clique para registar:")}
            </p>
            <div className="flex flex-wrap gap-2">
              {semCadastro.map((nome) => (
                <Button
                  key={nome}
                  variant="outline"
                  size="sm"
                  disabled={!podeGerir}
                  className="rounded-full"
                  onClick={() => abrir(null, nome)}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  {nome}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {funcoes.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <HardHat className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">{t("Nenhuma função registada")}</h3>
            <p className="text-muted-foreground">
              {t("Registe Pintor, Pedreiro, Eletricista... com o preço/hora ao cliente.")}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {funcoes.map((funcao) => {
            const equipa = funcionariosDaFuncao(funcao, funcionarios)
            const custo = custoMedioFuncao(funcao, funcionarios)
            const margem = margemPorPreco(custo, funcao.precoHora)
            return (
              <Card key={funcao.id} className={funcao.ativo === false ? "opacity-60" : undefined}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <CardTitle className="text-base">{funcao.nome}</CardTitle>
                      <CardDescription className="truncate">{descricaoClienteFuncao(funcao)}</CardDescription>
                    </div>
                    {funcao.ativo === false && <Badge variant="secondary">{t("Inativa")}</Badge>}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t("Preço ao cliente")}</span>
                      <span className="font-medium tabular-nums">{formatCurrency(funcao.precoHora)}/h</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t("Custo médio")}</span>
                      <span className="tabular-nums">{equipa.length ? `${formatCurrency(custo)}/h` : t("sem funcionários")}</span>
                    </div>
                    {equipa.length > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{t("Margem")}</span>
                        <span className={`tabular-nums ${margem < 0 ? "text-destructive font-medium" : ""}`}>
                          {formatNumber2(margem)}%
                        </span>
                      </div>
                    )}
                  </div>
                  {equipa.length > 0 && (
                    <div className="border-t pt-2 text-xs text-muted-foreground space-y-0.5">
                      {equipa.map((f) => (
                        <div key={f.id} className="flex justify-between">
                          <span className="truncate">{f.nome}</span>
                          <span className="tabular-nums">{formatCurrency(custoHoraFuncionario(f))}/h</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" size="icon" disabled={!podeGerir} onClick={() => abrir(funcao)} className="rounded-full">
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      disabled={!podeGerir}
                      onClick={() => apagar(funcao)}
                      className="rounded-full text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editando ? t("Editar função") : t("Nova função")}</DialogTitle>
            <DialogDescription>
              {t("O custo médio vem dos funcionários ativos com esta função (campo Função na ficha do funcionário).")}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={gravar} className="space-y-4">
            <div className="space-y-2">
              <Label>{t("Nome")}</Label>
              <Input
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                placeholder={t("Ex.: Pintor")}
                className="rounded-full"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>{t("Preço/hora ao cliente")}</Label>
                <CampoNumerico
                  min={0}
                  sufixo="EUR"
                  value={form.precoHora}
                  onChange={(precoHora) => setForm({ ...form, precoHora })}
                  className="rounded-full"
                />
              </div>
              <div className="space-y-2">
                <Label>{t("Margem sobre o custo médio")}</Label>
                <CampoNumerico
                  sufixo="%"
                  disabled={custoForm <= 0}
                  value={margemPorPreco(custoForm, form.precoHora)}
                  onChange={(margem) => setForm({ ...form, precoHora: precoPorMargem(custoForm, margem) })}
                  className="rounded-full"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {custoForm > 0
                ? t("Custo médio atual: {valor}/h", { valor: formatCurrency(custoForm) })
                : t("Custo médio atual: nenhum funcionário ativo com esta função")}
            </p>
            <div className="space-y-2">
              <Label>{t("Texto no PDF do cliente")}</Label>
              <Input
                value={form.descricaoCliente}
                onChange={(e) => setForm({ ...form, descricaoCliente: e.target.value })}
                placeholder={t("Mão de obra - {nome}", { nome: form.nome || t("função") })}
                className="rounded-full"
              />
            </div>
            <div className="space-y-2">
              <Label>{t("Observações")}</Label>
              <Textarea value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} rows={2} />
            </div>
            <label className="flex items-center gap-3 text-sm">
              <Switch checked={form.ativo} onCheckedChange={(ativo) => setForm({ ...form, ativo })} />
              {t("Ativa (aparece nos orçamentos)")}
            </label>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setAberto(false)}>
                {t("Cancelar")}
              </Button>
              <Button type="submit" disabled={aGravar} className="rounded-full">
                {aGravar ? t("A guardar...") : t("Guardar")}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
