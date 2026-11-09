"use client"

import { useCallback, useEffect, useState } from "react"
import { KeyRound, Loader2, ShieldCheck, Trash2, UserCog, UserPlus, Users, Wand2 } from "lucide-react"

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
import { pedirAuth, useAuth } from "@/hooks/use-auth"
import { usePermissoes } from "@/hooks/use-permissoes"
import { useSearchQuery } from "@/hooks/use-search-query"
import { getUtilizadores, guardarUtilizador } from "@/lib/firebase-service"
import { mensagemDeErroAuth } from "@/lib/auth-mensagens"
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

/** Palavra-passe inicial aleatória, fácil de ditar (sem 0/O, 1/l). */
function gerarSenha(): string {
  const letras = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789"
  const bytes = new Uint8Array(10)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => letras[b % letras.length]).join("")
}

const NOVO_VAZIO = { nome: "", email: "", senha: "", cargo: "consulta" }

export default function UtilizadoresPage() {
  const { user } = useAuth()
  const { pode, perfil, recarregar } = usePermissoes()
  const { searchTerm, setSearchTerm, clearSearch } = useSearchQuery()

  const [utilizadores, setUtilizadores] = useState<UtilizadorSistema[]>([])
  const [carregando, setCarregando] = useState(true)
  const [emEdicao, setEmEdicao] = useState<UtilizadorSistema | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [aApagar, setAApagar] = useState<UtilizadorSistema | null>(null)
  const [novo, setNovo] = useState<typeof NOVO_VAZIO | null>(null)
  const [aCriar, setACriar] = useState(false)
  const [senhaNova, setSenhaNova] = useState("")
  const [aDefinirSenha, setADefinirSenha] = useState(false)

  const podeGerir = pode("utilizadores.gerir")

  /** Só o administrador cria contas: nome, email, palavra-passe inicial e cargo. */
  const criarUtilizador = async () => {
    if (!novo) return
    if (!novo.email.trim()) return toast({ title: t("Indique o email."), variant: "destructive" })
    if (novo.senha.length < 6) return toast({ title: t("A palavra-passe tem de ter pelo menos 6 caracteres."), variant: "destructive" })
    setACriar(true)
    try {
      await pedirAuth("criar-utilizador", {
        nome: novo.nome.trim(),
        email: novo.email.trim(),
        senha: novo.senha,
        cargo: novo.cargo,
        permissoes: permissoesDoCargo(novo.cargo),
      })
      toast({
        title: t("Utilizador criado"),
        description: t("{email} já pode entrar com a palavra-passe que definiu.", { email: novo.email.trim() }),
      })
      setNovo(null)
      await carregar()
    } catch (error) {
      toast({
        title: t("Não foi possível criar o utilizador"),
        description: mensagemDeErroAuth(error, t("Tente novamente.")),
        variant: "destructive",
      })
    } finally {
      setACriar(false)
    }
  }

  /** Palavra-passe nova para outra pessoa (as sessões abertas dela terminam). */
  const definirSenha = async () => {
    if (!emEdicao?.id) return
    if (senhaNova.length < 6) return toast({ title: t("A palavra-passe tem de ter pelo menos 6 caracteres."), variant: "destructive" })
    setADefinirSenha(true)
    try {
      await pedirAuth("definir-senha", { uid: emEdicao.id, senha: senhaNova })
      toast({
        title: t("Palavra-passe definida"),
        description: t("Comunique a palavra-passe nova a {email}.", { email: emEdicao.email }),
      })
      setSenhaNova("")
    } catch (error) {
      toast({
        title: t("Não foi possível definir a palavra-passe"),
        description: mensagemDeErroAuth(error, t("Tente novamente.")),
        variant: "destructive",
      })
    } finally {
      setADefinirSenha(false)
    }
  }

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

  /** Remove a pessoa do sistema: o perfil e a conta de acesso (deixa de conseguir entrar). */
  const removerPerfil = async () => {
    if (!aApagar?.id) return

    try {
      await pedirAuth("remover-utilizador", { uid: aApagar.id })
      toast({
        title: t("Utilizador removido"),
        description: t("{email} deixou de ter acesso ao sistema.", { email: aApagar.email }),
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
        <Button className="rounded-full" onClick={() => setNovo({ ...NOVO_VAZIO, senha: gerarSenha() })} data-testid="novo-utilizador">
          <UserPlus className="mr-2 h-4 w-4" />
          {t("Novo utilizador")}
        </Button>
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
            {t("Só o administrador cria contas, em \"Novo utilizador\". Não há registo livre no ecrã de entrada.")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {filtrados.map((item) => (
            <div
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
              data-utilizador={item.email}
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
                <Button variant="outline" className="rounded-full" onClick={() => { setEmEdicao({ ...item }); setSenhaNova("") }}>
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
                    aria-label={t("Remover {email}", { email: item.email })}
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

              {/* Palavra-passe definida pelo administrador (a pessoa esqueceu-se, por exemplo) */}
              {emEdicao.id !== user?.uid && (
                <div className="space-y-2 rounded-lg border p-3">
                  <Label htmlFor="senha-nova-utilizador" className="flex items-center gap-2">
                    <KeyRound className="h-4 w-4" />
                    {t("Definir nova palavra-passe")}
                  </Label>
                  <div className="flex flex-wrap gap-2">
                    <Input
                      id="senha-nova-utilizador"
                      value={senhaNova}
                      onChange={(e) => setSenhaNova(e.target.value)}
                      placeholder={t("Pelo menos 6 caracteres")}
                      className="min-w-[200px] flex-1 rounded-full font-mono"
                      autoComplete="off"
                    />
                    <Button type="button" variant="outline" className="rounded-full" onClick={() => setSenhaNova(gerarSenha())}>
                      <Wand2 className="mr-2 h-4 w-4" />
                      {t("Gerar")}
                    </Button>
                    <Button type="button" className="rounded-full" onClick={definirSenha} disabled={aDefinirSenha || !senhaNova}>
                      {aDefinirSenha ? <Loader2 className="h-4 w-4 animate-spin" /> : t("Definir")}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t("A pessoa passa a entrar com esta palavra-passe e as sessões que tinha abertas terminam.")}
                  </p>
                </div>
              )}

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
            <DialogTitle>{t("Remover utilizador")}</DialogTitle>
            <DialogDescription>{aApagar?.email}</DialogDescription>
          </DialogHeader>

          <div className="space-y-3 text-sm">
            <p>
              {t("A conta de acesso e o perfil são eliminados: esta pessoa deixa de conseguir entrar no sistema. O que registou (orçamentos, picagens...) mantém-se.")}
            </p>
            <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-3 text-xs">
              {t("Para lhe tirar o acesso só por uns tempos, desative a conta em \"Gerir\" em vez de a remover.")}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" className="rounded-full" onClick={() => setAApagar(null)}>
              {t("Cancelar")}
            </Button>
            <Button variant="destructive" className="rounded-full" onClick={removerPerfil}>
              <Trash2 className="mr-2 h-4 w-4" />
              {t("Remover utilizador")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Novo utilizador (só o administrador) */}
      <Dialog open={!!novo} onOpenChange={(aberto) => !aberto && setNovo(null)}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>{t("Novo utilizador")}</DialogTitle>
            <DialogDescription>
              {t("A pessoa entra com este email e esta palavra-passe. Depois pode mudá-la em Configurações.")}
            </DialogDescription>
          </DialogHeader>

          {novo && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="novo-nome">{t("Nome")}</Label>
                <Input
                  id="novo-nome"
                  value={novo.nome}
                  onChange={(e) => setNovo({ ...novo, nome: e.target.value })}
                  placeholder={t("Nome da pessoa")}
                  className="rounded-full"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="novo-email">{t("Email")}</Label>
                <Input
                  id="novo-email"
                  type="email"
                  value={novo.email}
                  onChange={(e) => setNovo({ ...novo, email: e.target.value })}
                  placeholder={t("nome@empresa.pt")}
                  className="rounded-full"
                  autoComplete="off"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="novo-senha">{t("Palavra-passe inicial")}</Label>
                <div className="flex gap-2">
                  <Input
                    id="novo-senha"
                    value={novo.senha}
                    onChange={(e) => setNovo({ ...novo, senha: e.target.value })}
                    className="flex-1 rounded-full font-mono"
                    autoComplete="off"
                  />
                  <Button type="button" variant="outline" className="rounded-full" onClick={() => setNovo({ ...novo, senha: gerarSenha() })}>
                    <Wand2 className="mr-2 h-4 w-4" />
                    {t("Gerar")}
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>{t("Cargo")}</Label>
                <Select value={novo.cargo} onValueChange={(cargo) => setNovo({ ...novo, cargo })}>
                  <SelectTrigger className="rounded-full" data-testid="novo-cargo">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CARGOS.filter((c) => c.id !== "personalizado" && c.id !== "trabalhador").map((cargo) => (
                      <SelectItem key={cargo.id} value={cargo.id}>
                        {t(cargo.nome)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">{t(getCargo(novo.cargo).descricao)}</p>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" className="rounded-full" onClick={() => setNovo(null)}>
                  {t("Cancelar")}
                </Button>
                <Button className="rounded-full min-w-[140px]" onClick={criarUtilizador} disabled={aCriar}>
                  {aCriar ? <Loader2 className="h-4 w-4 animate-spin" /> : t("Criar utilizador")}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

    </div>
  )
}
