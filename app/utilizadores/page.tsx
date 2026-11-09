"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, ShieldCheck, Trash2, UserCog, Users } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { ListToolbar } from "@/components/ui/list-toolbar"
import { toast } from "@/hooks/use-toast"
import { useAuth } from "@/hooks/use-auth"
import { usePermissoes } from "@/hooks/use-permissoes"
import { useSearchQuery } from "@/hooks/use-search-query"
import { apagarUtilizador, getUtilizadores, guardarUtilizador } from "@/lib/firebase-service"
import {
  CARGOS,
  CATALOGO_PERMISSOES,
  getCargo,
  permissoesDoCargo,
  type Permissao,
} from "@/lib/permissoes"
import type { UtilizadorSistema } from "@/lib/types"
import { formatDate, matchesSearch } from "@/lib/utils"
import { t } from "@/lib/i18n"
import { SemAcesso } from "@/components/sem-acesso"

export default function UtilizadoresPage() {
  const { user } = useAuth()
  const { pode, perfil, recarregar } = usePermissoes()
  const { searchTerm, setSearchTerm, clearSearch } = useSearchQuery()

  const [utilizadores, setUtilizadores] = useState<UtilizadorSistema[]>([])
  const [carregando, setCarregando] = useState(true)
  const [emEdicao, setEmEdicao] = useState<UtilizadorSistema | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [aApagar, setAApagar] = useState<UtilizadorSistema | null>(null)

  const podeGerir = pode("utilizadores.gerir")

  const carregar = useCallback(async () => {
    try {
      setCarregando(true)
      setUtilizadores(await getUtilizadores())
    } catch (error) {
      toast({
        title: t("Erro ao carregar utilizadores"),
        description: t("Não foi possível obter a lista."),
        variant: "destructive",
      })
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => {
    if (user) void carregar()
  }, [user, carregar])

  const guardarAlteracoes = async () => {
    if (!emEdicao?.id) return

    setGuardando(true)
    try {
      await guardarUtilizador(emEdicao.id, {
        nome: emEdicao.nome || "",
        cargo: emEdicao.cargo,
        permissoes: emEdicao.permissoes,
        ativo: emEdicao.ativo,
      })
      toast({
        title: t("Utilizador atualizado"),
        description: t("{email} passou a {cargo}.", { email: emEdicao.email, cargo: t(getCargo(emEdicao.cargo).nome) }),
      })
      setEmEdicao(null)
      await carregar()
      // Se o utilizador se alterou a si proprio, as permissoes tem de refletir ja
      if (emEdicao.id === user?.uid) await recarregar()
    } catch (error) {
      toast({ title: t("Erro ao guardar"), description: t("Tente novamente."), variant: "destructive" })
    } finally {
      setGuardando(false)
    }
  }

  /**
   * Remove o perfil, nao a conta de autenticacao.
   *
   * A conta continua a existir no Firebase Auth e a pessoa consegue entrar;
   * volta a aparecer aqui como Consulta. Para a impedir de entrar de vez, a
   * conta tem de ser apagada na consola do Firebase.
   */
  const removerPerfil = async () => {
    if (!aApagar?.id) return

    try {
      await apagarUtilizador(aApagar.id)
      toast({
        title: t("Perfil removido"),
        description: t("{email} deixou de ter permissões no sistema.", { email: aApagar.email }),
      })
      setAApagar(null)
      await carregar()
    } catch (error) {
      toast({ title: t("Erro ao remover"), description: t("Tente novamente."), variant: "destructive" })
    }
  }

  /** Trocar de cargo repoe as permissoes desse cargo. */
  const trocarCargo = (cargo: string) => {
    if (!emEdicao) return
    setEmEdicao({
      ...emEdicao,
      cargo,
      permissoes: cargo === "personalizado" ? emEdicao.permissoes : permissoesDoCargo(cargo),
    })
  }

  const alternarPermissao = (permissao: Permissao, ativa: boolean) => {
    if (!emEdicao) return
    const atuais = new Set(emEdicao.permissoes || [])
    if (ativa) atuais.add(permissao)
    else atuais.delete(permissao)
    // Mexer numa permissao a mao passa o cargo a personalizado
    setEmEdicao({ ...emEdicao, cargo: "personalizado", permissoes: Array.from(atuais) })
  }

  const filtrados = utilizadores.filter((item) =>
    matchesSearch(searchTerm, [item.email, item.nome, t(getCargo(item.cargo).nome)]),
  )

  if (carregando) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!podeGerir) {
    return <SemAcesso area={t("Utilizadores e cargos")} requisito={t("a permissão de gerir utilizadores")} />
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div>
          <h1 className="text-3xl font-bold">{t("Utilizadores e cargos")}</h1>
          <p className="text-muted-foreground mt-2">
            {t("Quem entra no sistema e o que cada um pode fazer em cada ecrã.")}
          </p>
        </div>
      </div>

      {/* Cargos disponiveis */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            {t("Cargos")}
          </CardTitle>
          <CardDescription>
            {t("Cada cargo é um conjunto de permissões. Mexer numa permissão à mão passa o utilizador a personalizado.")}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {CARGOS.filter((cargo) => cargo.id !== "personalizado").map((cargo) => (
            <div key={cargo.id} className="rounded-lg border p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{t(cargo.nome)}</span>
                <Badge variant="secondary" className="text-xs">
                  {cargo.permissoes.length === 1
                    ? t("{n} permissão", { n: cargo.permissoes.length })
                    : t("{n} permissões", { n: cargo.permissoes.length })}
                </Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{t(cargo.descricao)}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <ListToolbar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        onClear={clearSearch}
        placeholder={t("Pesquisar por email, nome ou cargo...")}
        resultCount={filtrados.length}
        totalCount={utilizadores.length}
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            {t("Contas")}
          </CardTitle>
          <CardDescription>
            {t("As contas aparecem aqui no primeiro acesso. Quem se regista entra como Consulta até receber um cargo.")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {filtrados.map((item) => (
            <div
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{item.nome || item.email}</span>
                  <Badge variant="outline">{t(getCargo(item.cargo).nome)}</Badge>
                  {!item.ativo && <Badge variant="destructive">{t("Desativado")}</Badge>}
                  {item.id === user?.uid && (
                    <Badge variant="secondary" className="text-xs">
                      {t("Você")}
                    </Badge>
                  )}
                </div>
                <p className="truncate text-sm text-muted-foreground">{item.email}</p>
                <p className="text-xs text-muted-foreground">
                  {(item.permissoes || []).length === 1
                    ? t("{n} permissão", { n: 1 })
                    : t("{n} permissões", { n: (item.permissoes || []).length })}
                  {item.ultimoAcesso && (
                    <> · {t("último acesso a {data}", { data: formatDate(new Date(item.ultimoAcesso)) })}</>
                  )}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button variant="outline" className="rounded-full" onClick={() => setEmEdicao({ ...item })}>
                  <UserCog className="mr-2 h-4 w-4" />
                  {t("Gerir")}
                </Button>
                {/* A propria conta nao se remove: ficaria sem quem gere utilizadores */}
                {item.id !== user?.uid && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-full text-muted-foreground hover:text-destructive"
                    onClick={() => setAApagar(item)}
                    aria-label={t("Remover o perfil de {email}", { email: item.email })}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}

          {filtrados.length === 0 && (
            <p className="py-8 text-center text-muted-foreground">{t("Nenhum utilizador encontrado.")}</p>
          )}
        </CardContent>
      </Card>

      {/* Edicao */}
      <Dialog open={!!emEdicao} onOpenChange={(aberto) => !aberto && setEmEdicao(null)}>
        <DialogContent className="sm:max-w-[720px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("Gerir utilizador")}</DialogTitle>
            <DialogDescription>{emEdicao?.email}</DialogDescription>
          </DialogHeader>

          {emEdicao && (
            <div className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="nome">{t("Nome")}</Label>
                  <Input
                    id="nome"
                    value={emEdicao.nome || ""}
                    onChange={(e) => setEmEdicao({ ...emEdicao, nome: e.target.value })}
                    placeholder={t("Nome da pessoa")}
                    className="rounded-full"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cargo">{t("Cargo")}</Label>
                  <Select value={emEdicao.cargo} onValueChange={trocarCargo}>
                    <SelectTrigger className="rounded-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CARGOS.map((cargo) => (
                        <SelectItem key={cargo.id} value={cargo.id}>
                          {t(cargo.nome)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">{t(getCargo(emEdicao.cargo).descricao)}</p>
                </div>
              </div>

              <label className="flex items-center justify-between rounded-lg border p-3">
                <span>
                  <span className="font-medium">{t("Conta ativa")}</span>
                  <span className="block text-xs text-muted-foreground">
                    {t("Desativada, a pessoa continua a poder entrar mas não vê nem faz nada.")}
                  </span>
                </span>
                <Switch
                  checked={emEdicao.ativo}
                  onCheckedChange={(valor) => setEmEdicao({ ...emEdicao, ativo: valor })}
                />
              </label>

              {emEdicao.id === user?.uid && (
                <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-3 text-xs">
                  {t("Está a alterar a sua própria conta. Se retirar a permissão de gerir utilizadores, deixa de poder voltar a este ecrã.")}
                </div>
              )}

              <div className="space-y-4">
                <div className="text-sm font-medium">{t("Permissões")}</div>
                {CATALOGO_PERMISSOES.map((grupo) => (
                  <div key={grupo.grupo} className="rounded-lg border p-3">
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-primary">
                      {t(grupo.grupo)}
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {grupo.itens.map((item) => (
                        <label key={item.id} className="flex items-start gap-2 text-sm">
                          <Checkbox
                            checked={(emEdicao.permissoes || []).includes(item.id)}
                            onCheckedChange={(valor) => alternarPermissao(item.id, valor === true)}
                            className="mt-0.5"
                          />
                          <span>
                            {t(item.nome)}
                            {item.ajuda && (
                              <span className="block text-xs text-muted-foreground">{t(item.ajuda)}</span>
                            )}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setEmEdicao(null)}>
                  {t("Cancelar")}
                </Button>
                <Button onClick={guardarAlteracoes} disabled={guardando} className="rounded-full min-w-[120px]">
                  {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : t("Guardar")}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      {/* Confirmacao da remocao */}
      <Dialog open={!!aApagar} onOpenChange={(aberto) => !aberto && setAApagar(null)}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>{t("Remover perfil")}</DialogTitle>
            <DialogDescription>{aApagar?.email}</DialogDescription>
          </DialogHeader>

          <div className="space-y-3 text-sm">
            <p>
              {t("Esta pessoa deixa de ter permissões no sistema. O perfil sai desta lista e todas as suas permissões são eliminadas.")}
            </p>
            <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-3 text-xs">
              {t("A conta de acesso continua a existir. Se voltar a entrar, reaparece aqui como Consulta. Para lhe tirar todo o acesso, desative a conta em vez de remover o perfil.")}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" className="rounded-full" onClick={() => setAApagar(null)}>
              {t("Cancelar")}
            </Button>
            <Button variant="destructive" className="rounded-full" onClick={removerPerfil}>
              <Trash2 className="mr-2 h-4 w-4" />
              {t("Remover perfil")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  )
}
