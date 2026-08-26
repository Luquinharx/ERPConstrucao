"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { useInView } from "react-intersection-observer"
import { z } from "zod"
import {
  Plus,
  Edit,
  Trash2,
  User,
  Mail,
  Phone,
  MapPin,
  Hash,
  AlertCircle,
  Building,
  Loader2,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { toast } from "@/hooks/use-toast"

import { useAuth } from "@/hooks/use-auth"
import { usePermissoes } from "@/hooks/use-permissoes"
import { useClientes } from "@/hooks/use-clientes"
import { useSearchQuery } from "@/hooks/use-search-query"
import { ListToolbar } from "@/components/ui/list-toolbar"
import { clienteSchema, type ClienteFormData } from "@/lib/schemas"
import { matchesSearch } from "@/lib/utils"
import type { Cliente } from "@/lib/types"

export default function ClientesPage() {
  const { user } = useAuth()
  const { pode } = usePermissoes()
  const {
    clientes,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError, 
    addCliente, 
    updateCliente, 
    deleteCliente,
    isAdding,
    isUpdating,
    isDeleting 
  } = useClientes()

  const { ref, inView } = useInView()
  const { searchTerm, setSearchTerm, clearSearch } = useSearchQuery()

  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingCliente, setEditingCliente] = useState<Cliente | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  
  // Estados do formulário
  const [formData, setFormData] = useState<ClienteFormData>({
    nome: "",
    email: "",
    telefone: "",
    morada: "",
    cidade: "",
    codigoPostal: "",
    nif: "",
    observacoes: "",
  })

  // Infinite scroll trigger
  useEffect(() => {
    if (inView && hasNextPage) {
      fetchNextPage()
    }
  }, [inView, hasNextPage, fetchNextPage])

  // Busca automatica: com um termo ativo, puxa as paginas restantes para
  // pesquisar sobre a base completa e nao apenas sobre a pagina carregada.
  useEffect(() => {
    if (searchTerm.trim() && hasNextPage && !isFetchingNextPage) {
      fetchNextPage()
    }
  }, [searchTerm, hasNextPage, isFetchingNextPage, fetchNextPage])

  const filteredClientes = clientes.filter((cliente) =>
    matchesSearch(searchTerm, [
      cliente.nome,
      cliente.email,
      cliente.telefone,
      cliente.numeroUnico,
      cliente.morada,
      cliente.cidade,
      cliente.codigoPostal,
      cliente.nif,
      cliente.observacoes,
    ]),
  )

  const validateForm = () => {
    try {
      clienteSchema.parse(formData)
      setErrors({})
      return true
    } catch (error) {
      if (error instanceof z.ZodError) {
        const newErrors: Record<string, string> = {}
        error.errors.forEach((err) => {
          if (err.path[0]) {
            newErrors[err.path[0] as string] = err.message
          }
        })
        setErrors(newErrors)
      }
      return false
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!user) {
      toast({
        title: "Erro",
        description: "Usuário não autenticado",
        variant: "destructive",
      })
      return
    }

    if (!validateForm()) {
      toast({
        title: "Erro de validação",
        description: "Verifique os campos obrigatórios",
        variant: "destructive",
      })
      return
    }

    try {
      if (editingCliente) {
        await updateCliente({ id: editingCliente.id!, data: formData })
        toast({
          title: "Cliente atualizado",
          description: "As informações foram salvas com sucesso.",
        })
      } else {
        await addCliente(formData)
        toast({
          title: "Cliente adicionado",
          description: "Novo cliente cadastrado com sucesso.",
        })
      }

      setIsDialogOpen(false)
      resetForm()
    } catch (error) {
      console.error("Erro ao salvar cliente:", error)
      toast({
        title: "Erro",
        description: "Não foi possível salvar as informações.",
        variant: "destructive",
      })
    }
  }

  const handleDelete = async (cliente: Cliente) => {
    if (!confirm(`Tem certeza que deseja excluir o cliente ${cliente.nome}?`)) {
      return
    }

    try {
      await deleteCliente(cliente.id!)
      toast({
        title: "Cliente excluído",
        description: "O registro foi removido com sucesso.",
      })
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível excluir o cliente.",
        variant: "destructive",
      })
    }
  }

  const handleEdit = (cliente: Cliente) => {
    setEditingCliente(cliente)
    setFormData({
      nome: cliente.nome,
      email: cliente.email,
      telefone: cliente.telefone,
      morada: cliente.morada || "",
      cidade: cliente.cidade || "",
      codigoPostal: cliente.codigoPostal || "",
      nif: cliente.nif || "",
      observacoes: cliente.observacoes || "",
    })
    setErrors({})
    setIsDialogOpen(true)
  }

  const resetForm = () => {
    setEditingCliente(null)
    setFormData({
      nome: "",
      email: "",
      telefone: "",
      morada: "",
      cidade: "",
      codigoPostal: "",
      nif: "",
      observacoes: "",
    })
    setErrors({})
  }

  const handleDialogClose = () => {
    setIsDialogOpen(false)
    resetForm()
  }

  const isSaving = isAdding || isUpdating

  const getClientCodeColor = (codigo: string) => {
    let hash = 0
    for (let i = 0; i < codigo.length; i++) {
      hash = codigo.charCodeAt(i) + ((hash << 5) - hash)
    }
    const hue = Math.abs(hash) % 360
    return `hsl(${hue} 72% 42%)`
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center h-64">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Você precisa estar logado para acessar esta página.</AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary">Clientes</h1>
          <p className="text-muted-foreground">Gerencie seus clientes e informações de contato</p>
        </div>
        <div className="flex space-x-2">
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button disabled={!pode("clientes.gerir")} onClick={() => setIsDialogOpen(true)} className="rounded-full shadow-lg hover:shadow-xl transition-all">
                <Plus className="mr-2 h-4 w-4" />
                Novo Cliente
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>{editingCliente ? "Editar Cliente" : "Novo Cliente"}</DialogTitle>
                <DialogDescription>
                  {editingCliente ? "Atualize as informações do cliente" : "Adicione um novo cliente ao sistema"}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="nome">Nome Completo / Empresa *</Label>
                  <Input
                    id="nome"
                    value={formData.nome}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                    placeholder="Nome completo ou empresa"
                    className={`rounded-lg ${errors.nome ? "border-red-500" : ""}`}
                  />
                  {errors.nome && <span className="text-xs text-red-500">{errors.nome}</span>}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="email@exemplo.com"
                      className={`rounded-lg ${errors.email ? "border-red-500" : ""}`}
                    />
                    {errors.email && <span className="text-xs text-red-500">{errors.email}</span>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="telefone">Telefone *</Label>
                    <Input
                      id="telefone"
                      value={formData.telefone}
                      onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                      placeholder="+351 xxx xxx xxx"
                      className={`rounded-lg ${errors.telefone ? "border-red-500" : ""}`}
                    />
                    {errors.telefone && <span className="text-xs text-red-500">{errors.telefone}</span>}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="morada">Morada</Label>
                  <Input
                    id="morada"
                    value={formData.morada}
                    onChange={(e) => setFormData({ ...formData, morada: e.target.value })}
                    placeholder="Rua, número, andar"
                    className="rounded-lg"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="cidade">Cidade</Label>
                    <Input
                      id="cidade"
                      value={formData.cidade}
                      onChange={(e) => setFormData({ ...formData, cidade: e.target.value })}
                      placeholder="Cidade"
                      className="rounded-lg"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="codigoPostal">Código Postal</Label>
                    <Input
                      id="codigoPostal"
                      value={formData.codigoPostal}
                      onChange={(e) => setFormData({ ...formData, codigoPostal: e.target.value })}
                      placeholder="XXXX-XXX"
                      className="rounded-lg"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="nif">NIF (Opcional)</Label>
                  <Input
                    id="nif"
                    value={formData.nif}
                    onChange={(e) => setFormData({ ...formData, nif: e.target.value })}
                    placeholder="Número de Identificação Fiscal"
                    className="rounded-lg"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="observacoes">Observações</Label>
                  <Textarea
                    id="observacoes"
                    value={formData.observacoes}
                    onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                    placeholder="Informações adicionais sobre o cliente..."
                    rows={3}
                    className="rounded-lg"
                  />
                </div>

                <div className="flex justify-end space-x-2 pt-4">
                  <Button type="button" variant="outline" onClick={handleDialogClose} disabled={isSaving}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={isSaving} className="rounded-full min-w-[100px]">
                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : editingCliente ? "Atualizar" : "Salvar"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <ListToolbar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        onClear={clearSearch}
        placeholder="Pesquisar por nome, email, telefone, codigo, NIF ou cidade..."
        resultCount={filteredClientes.length}
        totalCount={clientes.length}
      />

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <LoadingSpinner size="lg" />
          <p className="ml-4 text-muted-foreground">Carregando clientes...</p>
        </div>
      ) : isError ? (
         <div className="flex items-center justify-center h-64 text-red-500">
          <AlertCircle className="h-6 w-6 mr-2" />
          <p>Erro ao carregar clientes. Tente novamente.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredClientes.map((cliente) => {
            const codeColor = getClientCodeColor(cliente.numeroUnico || cliente.nome)
            return (
            <Card
              key={cliente.id}
              className="hover:shadow-lg transition-all duration-300 border-l-4"
              style={{ borderLeftColor: `${codeColor}40` }}
            >
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div className="flex items-center space-x-3">
                    <div className="h-10 w-10 rounded-full flex items-center justify-center" style={{ backgroundColor: `${codeColor}20` }}>
                       <User className="h-5 w-5" style={{ color: codeColor }} />
                    </div>
                    <CardTitle className="text-lg font-semibold text-foreground">{cliente.nome}</CardTitle>
                  </div>
                  <Badge
                    variant="outline"
                    className="flex items-center gap-1 border"
                    style={{ backgroundColor: `${codeColor}1A`, borderColor: `${codeColor}50`, color: codeColor }}
                  >
                    <Hash className="h-3 w-3" />
                    {cliente.numeroUnico}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center space-x-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                  <Mail className="h-4 w-4 text-primary/70" />
                  <span>{cliente.email}</span>
                </div>
                <div className="flex items-center space-x-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                  <Phone className="h-4 w-4 text-primary/70" />
                  <span>{cliente.telefone}</span>
                </div>
                {(cliente.morada || cliente.cidade || cliente.codigoPostal) && (
                  <div className="flex items-center space-x-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                    <MapPin className="h-4 w-4 text-primary/70" />
                    <span className="truncate">
                      {[cliente.morada, cliente.cidade, cliente.codigoPostal].filter(Boolean).join(", ")}
                    </span>
                  </div>
                )}
                {cliente.nif && (
                   <div className="flex justify-between text-sm pt-2 border-t border-border/50">
                    <span className="text-muted-foreground">NIF:</span>
                    <span className="font-mono">{cliente.nif}</span>
                  </div>
                )}
                
                <div className="flex justify-end space-x-2 pt-4">
                  <Button variant="ghost" size="sm" onClick={() => handleEdit(cliente)} className="h-8 w-8 p-0 rounded-full hover:bg-primary/10 hover:text-primary">
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(cliente)}
                    className="h-8 w-8 p-0 rounded-full text-destructive hover:bg-destructive/10"
                    disabled={isDeleting}
                  >
                   {isDeleting ? <Loader2 className="h-3 w-3 animate-spin"/> : <Trash2 className="h-4 w-4" />}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )})}
          
          {filteredClientes.length === 0 && (
             <div className="col-span-full flex flex-col items-center justify-center p-12 text-center bg-muted/30 rounded-lg border border-dashed border-muted-foreground/25">
              <div className="h-16 w-16 bg-muted rounded-full flex items-center justify-center mb-4">
                <User className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold">Nenhum cliente encontrado</h3>
              <p className="text-muted-foreground max-w-sm mt-2">
                {searchTerm.trim()
                  ? `Nenhum resultado para "${searchTerm}".`
                  : "Comece construindo sua carteira de clientes agora mesmo."}
              </p>
              {searchTerm.trim() ? (
                <Button onClick={clearSearch} variant="outline" className="mt-6 rounded-full">
                  Limpar pesquisa
                </Button>
              ) : (
                <Button onClick={() => setIsDialogOpen(true)} className="mt-6 rounded-full">
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Primeiro Cliente
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Infinite Scroll Trigger */}
      {hasNextPage && (
        <div ref={ref} className="flex justify-center p-4">
          <LoadingSpinner />
        </div>
      )}
    </div>
  )
}
