"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, Lock, ShieldCheck, UserCog, Users } from "lucide-react"

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
import { getUtilizadores, guardarUtilizador } from "@/lib/firebase-service"
import {
  CARGOS,
  CATALOGO_PERMISSOES,
  getCargo,
  permissoesDoCargo,
  type Permissao,
} from "@/lib/permissoes"
import type { UtilizadorSistema } from "@/lib/types"
import { matchesSearch } from "@/lib/utils"

export default function UtilizadoresPage() {
  const { user } = useAuth()
  const { pode, perfil, recarregar } = usePermissoes()
  const { searchTerm, setSearchTerm, clearSearch } = useSearchQuery()

  const [utilizadores, setUtilizadores] = useState<UtilizadorSistema[]>([])
  const [carregando, setCarregando] = useState(true)
  const [emEdicao, setEmEdicao] = useState<UtilizadorSistema | null>(null)
  const [guardando, setGuardando] = useState(false)

  const podeGerir = pode("utilizadores.gerir")

  const carregar = useCallback(async () => {
    try {
      setCarregando(true)
      setUtilizadores(await getUtilizadores())
    } catch (error) {
      toast({
        title: "Erro ao carregar utilizadores",
        description: "Nao foi possivel obter a lista.",
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
        title: "Utilizador atualizado",
        description: `${emEdicao.email} passou a ${getCargo(emEdicao.cargo).nome}.`,
      })
      setEmEdicao(null)
      await carregar()
      // Se o utilizador se alterou a si proprio, as permissoes tem de refletir ja
      if (emEdicao.id === user?.uid) await recarregar()
    } catch (error) {
      toast({ title: "Erro ao guardar", description: "Tente novamente.", variant: "destructive" })
    } finally {
      setGuardando(false)
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
    matchesSearch(searchTerm, [item.email, item.nome, getCargo(item.cargo).nome]),
  )

  if (carregando) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!podeGerir) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <Lock className="mb-4 h-12 w-12 text-muted-foreground" />
          <h3 className="text-lg font-medium">Sem acesso a esta area</h3>
          <p className="mt-2 max-w-md text-muted-foreground">
            A gestao de utilizadores esta reservada a quem tem a permissao correspondente. O seu cargo atual e{" "}
            <strong>{getCargo(perfil?.cargo).nome}</strong>.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div>
          <h1 className="text-3xl font-bold">Utilizadores e cargos</h1>
          <p className="text-muted-foreground mt-2">
            Quem entra no sistema e o que cada um pode fazer em cada ecra.
          </p>
        </div>
      </div>

      {/* Cargos disponiveis */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            Cargos
          </CardTitle>
          <CardDescription>
            Cada cargo e um conjunto de permissoes. Mexer numa permissao a mao passa o utilizador a personalizado.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {CARGOS.filter((cargo) => cargo.id !== "personalizado").map((cargo) => (
            <div key={cargo.id} className="rounded-lg border p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{cargo.nome}</span>
                <Badge variant="secondary" className="text-xs">
                  {cargo.permissoes.length} permissoes
                </Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{cargo.descricao}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <ListToolbar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        onClear={clearSearch}
        placeholder="Procurar por email, nome ou cargo..."
        resultCount={filtrados.length}
        totalCount={utilizadores.length}
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Contas
          </CardTitle>
          <CardDescription>
            As contas aparecem aqui no primeiro acesso. Quem se regista entra como Consulta ate receber um cargo.
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
                  <Badge variant="outline">{getCargo(item.cargo).nome}</Badge>
                  {!item.ativo && <Badge variant="destructive">Desativado</Badge>}
                  {item.id === user?.uid && (
                    <Badge variant="secondary" className="text-xs">
                      Voce
                    </Badge>
                  )}
                </div>
                <p className="truncate text-sm text-muted-foreground">{item.email}</p>
                <p className="text-xs text-muted-foreground">
                  {(item.permissoes || []).length} permissoes
                  {item.ultimoAcesso && (
                    <> · ultimo acesso em {new Date(item.ultimoAcesso).toLocaleDateString("pt-PT")}</>
                  )}
                </p>
              </div>

              <Button variant="outline" className="rounded-full" onClick={() => setEmEdicao({ ...item })}>
                <UserCog className="mr-2 h-4 w-4" />
                Gerir
              </Button>
            </div>
          ))}

          {filtrados.length === 0 && (
            <p className="py-8 text-center text-muted-foreground">Nenhum utilizador encontrado.</p>
          )}
        </CardContent>
      </Card>

      {/* Edicao */}
      <Dialog open={!!emEdicao} onOpenChange={(aberto) => !aberto && setEmEdicao(null)}>
        <DialogContent className="sm:max-w-[720px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Gerir utilizador</DialogTitle>
            <DialogDescription>{emEdicao?.email}</DialogDescription>
          </DialogHeader>

          {emEdicao && (
            <div className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="nome">Nome</Label>
                  <Input
                    id="nome"
                    value={emEdicao.nome || ""}
                    onChange={(e) => setEmEdicao({ ...emEdicao, nome: e.target.value })}
                    placeholder="Nome da pessoa"
                    className="rounded-full"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cargo">Cargo</Label>
                  <Select value={emEdicao.cargo} onValueChange={trocarCargo}>
                    <SelectTrigger className="rounded-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CARGOS.map((cargo) => (
                        <SelectItem key={cargo.id} value={cargo.id}>
                          {cargo.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">{getCargo(emEdicao.cargo).descricao}</p>
                </div>
              </div>

              <label className="flex items-center justify-between rounded-lg border p-3">
                <span>
                  <span className="font-medium">Conta ativa</span>
                  <span className="block text-xs text-muted-foreground">
                    Desativada, a pessoa continua a poder entrar mas nao ve nem faz nada.
                  </span>
                </span>
                <Switch
                  checked={emEdicao.ativo}
                  onCheckedChange={(valor) => setEmEdicao({ ...emEdicao, ativo: valor })}
                />
              </label>

              {emEdicao.id === user?.uid && (
                <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-3 text-xs">
                  Esta a alterar a sua propria conta. Se retirar a permissao de gerir utilizadores, deixa de poder
                  voltar a este ecra.
                </div>
              )}

              <div className="space-y-4">
                <div className="text-sm font-medium">Permissoes</div>
                {CATALOGO_PERMISSOES.map((grupo) => (
                  <div key={grupo.grupo} className="rounded-lg border p-3">
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-primary">
                      {grupo.grupo}
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
                            {item.nome}
                            {item.ajuda && (
                              <span className="block text-xs text-muted-foreground">{item.ajuda}</span>
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
                  Cancelar
                </Button>
                <Button onClick={guardarAlteracoes} disabled={guardando} className="rounded-full min-w-[120px]">
                  {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
