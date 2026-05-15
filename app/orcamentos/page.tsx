"use client"

import type React from "react"

import { useState, useEffect, useMemo, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Plus, Edit, Trash2, Calculator, Search, FileText, Download, X, Loader2 } from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import { toast } from "@/hooks/use-toast"
import type { Orcamento, Funcionario, Servico, ItemOrcamento, Cliente, TermoServico } from "@/lib/types"
import { FirebaseService } from "@/lib/firebase-service"
import { formatCurrency } from "@/lib/utils"
import { getServiceCategoryName } from "@/lib/service-categories"

interface OrcamentoFormState {
  clienteId: string
  cliente: Orcamento["cliente"]
  dataOrcamento: string
  dataValidade: string
  funcionariosSelecionados: string[]
  servicosSelecionados: string[]
  itens: ItemOrcamento[]
  margemLucro: number
  observacoes: string
}

interface ServicoFormState {
  servicoId: string
  quantidade: number
  unidade: string
  precoUnitario: number
}

interface MaoObraFormState {
  funcionarioId: string
  quantidade: number
  unidade: string
  precoUnitario: number
}

function toDateInput(date: Date): string {
  return date.toISOString().split("T")[0]
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function getDefaultFormData(): OrcamentoFormState {
  const today = new Date()
  return {
    clienteId: "",
    cliente: {
      nome: "",
      email: "",
      telefone: "",
      morada: "",
      cidade: "",
      codigoPostal: "",
      nif: "",
    },
    dataOrcamento: toDateInput(today),
    dataValidade: toDateInput(addDays(today, 30)),
    funcionariosSelecionados: [],
    servicosSelecionados: [],
    itens: [],
    margemLucro: 20,
    observacoes: "",
  }
}

function getDefaultServicoForm(): ServicoFormState {
  return {
    servicoId: "",
    quantidade: 1,
    unidade: "",
    precoUnitario: 0,
  }
}

function getDefaultMaoObraForm(): MaoObraFormState {
  return {
    funcionarioId: "",
    quantidade: 8,
    unidade: "horas",
    precoUnitario: 0,
  }
}

function calculateSubtotal(itens: ItemOrcamento[]): number {
  return itens.reduce((sum, item) => sum + item.total, 0)
}

function calculateTotal(subtotal: number, margemLucro: number): number {
  return subtotal * (1 + margemLucro / 100)
}

function escapeHtml(input?: string): string {
  if (!input) return ""
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/\n/g, "<br/>")
}

function getStatusLabel(status: Orcamento["status"]): string {
  const labels: Record<Orcamento["status"], string> = {
    rascunho: "Rascunho",
    enviado: "Enviado",
    aprovado: "Aprovado",
    rejeitado: "Rejeitado",
  }

  return labels[status] || status
}

function buildOrcamentoDocumentHtml(orcamento: Orcamento, termos: TermoServico[]): string {
  const subtotal = Number(orcamento.subtotal || 0)
  const margem = Number(orcamento.margemLucro || 0)
  const margemValor = (subtotal * margem) / 100
  const total = Number(orcamento.valorTotal || 0)

  const termosAtivos = termos.filter((item) => item.ativo)
  const grouped = {
    termos: termosAtivos.filter((item) => item.tipo === "termos"),
    regras: termosAtivos.filter((item) => item.tipo === "regras"),
    condicoes: termosAtivos.filter((item) => item.tipo === "condicoes"),
  }

  const itensRows = (orcamento.itens || [])
    .map(
      (item) => `
        <tr>
          <td>${escapeHtml(item.descricao)}</td>
          <td>${escapeHtml(item.unidade)}</td>
          <td style="text-align:right">${item.quantidade.toFixed(2)}</td>
          <td style="text-align:right">${formatCurrency(item.precoUnitario)}</td>
          <td style="text-align:right">${formatCurrency(item.total)}</td>
        </tr>`,
    )
    .join("")

  const renderTermSection = (title: string, items: TermoServico[]) => {
    if (items.length === 0) return ""
    const content = items
      .map(
        (item, index) => `
          <div style="margin-bottom: 10px;">
            <div style="font-weight: 600;">${index + 1}. ${escapeHtml(item.titulo)}</div>
            <div style="margin-top: 4px; color: #334155; line-height: 1.5;">${escapeHtml(item.conteudo)}</div>
          </div>
        `,
      )
      .join("")
    return `<section style="margin-top:16px;"><h3 style="margin:0 0 8px 0;">${title}</h3>${content}</section>`
  }

  const termosHtml =
    termosAtivos.length > 0
      ? `
    <section style="margin-top: 28px; page-break-before: always;">
      <h2 style="margin-bottom: 12px; border-bottom: 1px solid #cbd5e1; padding-bottom: 6px;">Termos e Condicoes</h2>
      ${renderTermSection("Termos de Servico", grouped.termos)}
      ${renderTermSection("Regras e Politicas", grouped.regras)}
      ${renderTermSection("Condicoes Gerais", grouped.condicoes)}
    </section>
  `
      : `
    <section style="margin-top: 28px;">
      <h2 style="margin-bottom: 8px;">Termos e Condicoes</h2>
      <p style="color:#475569;">Nenhum termo ativo configurado.</p>
    </section>
  `

  return `
  <!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <title>Orcamento ${escapeHtml(orcamento.numero)}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 24px; color: #0f172a; }
        h1, h2, h3 { margin: 0; }
        .muted { color: #475569; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 12px; }
        .box { border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px; }
        table { width: 100%; border-collapse: collapse; margin-top: 14px; }
        th, td { border: 1px solid #cbd5e1; padding: 8px; font-size: 13px; }
        th { background: #f8fafc; text-align: left; }
        .totals { margin-top: 14px; margin-left: auto; width: 360px; }
        .totals div { display: flex; justify-content: space-between; margin: 4px 0; }
        .total-final { font-weight: bold; font-size: 18px; border-top: 1px solid #cbd5e1; padding-top: 8px; margin-top: 8px; }
        .footer { margin-top: 24px; font-size: 12px; color: #64748b; }
      </style>
    </head>
    <body>
      <header style="display:flex; justify-content:space-between; align-items:flex-start; border-bottom:1px solid #cbd5e1; padding-bottom: 12px;">
        <div>
          <h1>Orcamento #${escapeHtml(orcamento.numero)}</h1>
          <p class="muted">Data: ${new Date(orcamento.dataOrcamento).toLocaleDateString("pt-PT")}</p>
          <p class="muted">Validade: ${new Date(orcamento.dataValidade).toLocaleDateString("pt-PT")}</p>
        </div>
        <div style="text-align:right">
          <div style="font-weight:700; font-size:20px">${formatCurrency(total)}</div>
          <div class="muted">Status: ${escapeHtml(getStatusLabel(orcamento.status))}</div>
        </div>
      </header>

      <section class="grid">
        <div class="box">
          <h3>Cliente</h3>
          <div style="margin-top: 8px; line-height:1.6;">
            <div><strong>${escapeHtml(orcamento.cliente.nome)}</strong></div>
            <div>${escapeHtml(orcamento.cliente.email)}</div>
            <div>${escapeHtml(orcamento.cliente.telefone)}</div>
            <div>${escapeHtml(orcamento.cliente.morada)}</div>
            <div>${escapeHtml(orcamento.cliente.cidade)} ${escapeHtml(orcamento.cliente.codigoPostal)}</div>
            <div>${escapeHtml(orcamento.cliente.nif || "")}</div>
          </div>
        </div>
        <div class="box">
          <h3>Responsavel</h3>
          <div style="margin-top: 8px; line-height:1.6;">
            <div>${escapeHtml(orcamento.orcamentista)}</div>
            <div>Itens: ${(orcamento.itens || []).length}</div>
          </div>
        </div>
      </section>

      <section style="margin-top: 18px;">
        <h2>Itens</h2>
        <table>
          <thead>
            <tr>
              <th>Descricao</th>
              <th>Unidade</th>
              <th>Qtd.</th>
              <th>Valor Unitario</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            ${itensRows}
          </tbody>
        </table>
      </section>

      <section class="totals">
        <div><span>Subtotal:</span><span>${formatCurrency(subtotal)}</span></div>
        <div><span>Margem (${margem.toFixed(2)}%):</span><span>${formatCurrency(margemValor)}</span></div>
        <div class="total-final"><span>Total:</span><span>${formatCurrency(total)}</span></div>
      </section>

      ${
        orcamento.observacoes
          ? `<section style="margin-top:20px;"><h3>Observacoes</h3><p style="line-height:1.5;">${escapeHtml(orcamento.observacoes)}</p></section>`
          : ""
      }

      ${termosHtml}

      <div class="footer">
        Documento gerado automaticamente em ${new Date().toLocaleDateString("pt-PT")}
      </div>
    </body>
  </html>
  `
}

export default function OrcamentosPage() {
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([])
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([])
  const [servicos, setServicos] = useState<Servico[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingOrcamento, setEditingOrcamento] = useState<Orcamento | null>(null)
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [generatingDocId, setGeneratingDocId] = useState<string | null>(null)

  const [servicoForm, setServicoForm] = useState<ServicoFormState>(getDefaultServicoForm())
  const [maoObraForm, setMaoObraForm] = useState<MaoObraFormState>(getDefaultMaoObraForm())
  const [formData, setFormData] = useState<OrcamentoFormState>(getDefaultFormData())

  const { user } = useAuth()

  const loadData = useCallback(async () => {
    if (!user) return

    setLoading(true)
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
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const filteredOrcamentos = useMemo(() => {
    let filtered = [...orcamentos]

    if (searchTerm.trim()) {
      const query = searchTerm.toLowerCase().trim()
      filtered = filtered.filter(
        (orcamento) =>
          orcamento.cliente.nome.toLowerCase().includes(query) ||
          orcamento.numero.toLowerCase().includes(query) ||
          (orcamento.cliente.email || "").toLowerCase().includes(query),
      )
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter((orcamento) => orcamento.status === statusFilter)
    }

    return filtered
  }, [orcamentos, searchTerm, statusFilter])

  const generateOrcamentoNumber = () => {
    const year = new Date().getFullYear()
    const count = orcamentos.length + 1
    return `${year}-${count.toString().padStart(3, "0")}`
  }

  const handleClientSelect = (selectedValue: string) => {
    if (selectedValue === "__novo") {
      setFormData({
        ...formData,
        clienteId: "",
      })
      return
    }

    const client = clientes.find((item) => item.id === selectedValue)
    if (!client) return

    setFormData({
      ...formData,
      clienteId: client.id || "",
      cliente: {
        nome: client.nome,
        email: client.email,
        telefone: client.telefone,
        morada: client.morada || "",
        cidade: client.cidade || "",
        codigoPostal: client.codigoPostal || "",
        nif: client.nif || "",
      },
    })
  }

  const handleServicoSelect = (servicoId: string) => {
    const servico = servicos.find((item) => item.id === servicoId)
    if (!servico) return

    setServicoForm({
      servicoId,
      quantidade: 1,
      unidade: servico.unidade || "un",
      precoUnitario: Number(servico.preco || 0),
    })
  }

  const handleFuncionarioSelect = (funcionarioId: string) => {
    const funcionario = funcionarios.find((item) => item.id === funcionarioId)
    if (!funcionario) return

    setMaoObraForm({
      ...maoObraForm,
      funcionarioId,
      precoUnitario: Number(funcionario.custoHora || 0),
    })
  }

  const handleServicoFormSubmit = () => {
    if (!servicoForm.servicoId || servicoForm.quantidade <= 0) {
      toast({
        title: "Dados incompletos",
        description: "Selecione um servico e informe a quantidade.",
        variant: "destructive",
      })
      return
    }

    if (formData.servicosSelecionados.includes(servicoForm.servicoId)) {
      toast({
        title: "Servico ja adicionado",
        description: "Para esse fluxo, cada servico entra apenas uma vez. Ajuste a quantidade do item existente.",
        variant: "destructive",
      })
      return
    }

    const servico = servicos.find((item) => item.id === servicoForm.servicoId)
    if (!servico) return

    const categoryName = getServiceCategoryName(servico.categoriaId, servico.categoriaNome)
    const novoItem: ItemOrcamento = {
      id: `servico-${servicoForm.servicoId}-${Date.now()}`,
      descricao: `${servico.nome} (${categoryName})`,
      quantidade: servicoForm.quantidade,
      unidade: servicoForm.unidade,
      precoUnitario: servicoForm.precoUnitario,
      total: servicoForm.quantidade * servicoForm.precoUnitario,
      tipo: "servico",
      servicoId: servicoForm.servicoId,
    }

    setFormData({
      ...formData,
      itens: [...formData.itens, novoItem],
      servicosSelecionados: [...formData.servicosSelecionados, servicoForm.servicoId],
    })
    setServicoForm(getDefaultServicoForm())
  }

  const handleMaoObraFormSubmit = () => {
    if (!maoObraForm.funcionarioId || maoObraForm.quantidade <= 0) {
      toast({
        title: "Dados incompletos",
        description: "Selecione um funcionario e informe a quantidade.",
        variant: "destructive",
      })
      return
    }

    const funcionario = funcionarios.find((item) => item.id === maoObraForm.funcionarioId)
    if (!funcionario) return

    const novoItem: ItemOrcamento = {
      id: `funcionario-${maoObraForm.funcionarioId}-${Date.now()}`,
      descricao: `Mao de obra - ${funcionario.nome}`,
      quantidade: maoObraForm.quantidade,
      unidade: maoObraForm.unidade,
      precoUnitario: maoObraForm.precoUnitario,
      total: maoObraForm.quantidade * maoObraForm.precoUnitario,
      tipo: "mao_obra",
      funcionarioId: maoObraForm.funcionarioId,
    }

    setFormData({
      ...formData,
      itens: [...formData.itens, novoItem],
      funcionariosSelecionados: [...new Set([...formData.funcionariosSelecionados, maoObraForm.funcionarioId])],
    })
    setMaoObraForm(getDefaultMaoObraForm())
  }

  const handleItemUpdate = (itemId: string, field: keyof ItemOrcamento, value: string | number) => {
    const updatedItens = formData.itens.map((item) => {
      if (item.id !== itemId) return item

      const updatedItem = {
        ...item,
        [field]: value,
      } as ItemOrcamento

      if (field === "quantidade" || field === "precoUnitario") {
        updatedItem.total = Number(updatedItem.quantidade) * Number(updatedItem.precoUnitario)
      }

      return updatedItem
    })

    setFormData({ ...formData, itens: updatedItens })
  }

  const handleItemRemove = (itemId: string) => {
    const target = formData.itens.find((item) => item.id === itemId)
    const updatedItens = formData.itens.filter((item) => item.id !== itemId)

    let servicosSelecionados = formData.servicosSelecionados
    let funcionariosSelecionados = formData.funcionariosSelecionados

    if (target?.tipo === "servico" && target.servicoId) {
      servicosSelecionados = formData.servicosSelecionados.filter((id) => id !== target.servicoId)
    }

    if (target?.tipo === "mao_obra" && target.funcionarioId) {
      const hasOther = updatedItens.some(
        (item) => item.tipo === "mao_obra" && item.funcionarioId && item.funcionarioId === target.funcionarioId,
      )
      if (!hasOther) {
        funcionariosSelecionados = formData.funcionariosSelecionados.filter((id) => id !== target.funcionarioId)
      }
    }

    setFormData({
      ...formData,
      itens: updatedItens,
      servicosSelecionados,
      funcionariosSelecionados,
    })
  }

  const resolveCliente = async (): Promise<string> => {
    if (!user) throw new Error("Usuario nao autenticado")

    if (formData.clienteId) return formData.clienteId

    const nome = formData.cliente.nome.trim().toLowerCase()
    const email = formData.cliente.email.trim().toLowerCase()

    const existing = clientes.find((cliente) => {
      const sameEmail = email && cliente.email.trim().toLowerCase() === email
      const sameName = nome && cliente.nome.trim().toLowerCase() === nome
      return sameEmail || sameName
    })

    if (existing?.id) {
      return existing.id
    }

    const novoClienteId = await FirebaseService.addCliente(
      {
        nome: formData.cliente.nome.trim(),
        email: formData.cliente.email.trim(),
        telefone: formData.cliente.telefone.trim(),
        morada: formData.cliente.morada.trim(),
        cidade: formData.cliente.cidade.trim(),
        codigoPostal: formData.cliente.codigoPostal.trim(),
        nif: formData.cliente.nif?.trim() || "",
        observacoes: "",
        userId: user.uid,
      },
      user.uid,
    )

    return novoClienteId
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    if (formData.itens.length === 0) {
      toast({
        title: "Adicione itens",
        description: "Inclua pelo menos um servico ou mao de obra no orcamento.",
        variant: "destructive",
      })
      return
    }

    const subtotal = calculateSubtotal(formData.itens)
    const valorTotal = calculateTotal(subtotal, formData.margemLucro)

    setLoading(true)
    try {
      const clienteId = await resolveCliente()
      const dataOrcamento = new Date(formData.dataOrcamento)
      const dataValidade = new Date(formData.dataValidade)

      const orcamentoData: Omit<Orcamento, "id"> = {
        numero: editingOrcamento?.numero || generateOrcamentoNumber(),
        clienteId,
        cliente: {
          nome: formData.cliente.nome.trim(),
          email: formData.cliente.email.trim(),
          telefone: formData.cliente.telefone.trim(),
          morada: formData.cliente.morada.trim(),
          cidade: formData.cliente.cidade.trim(),
          codigoPostal: formData.cliente.codigoPostal.trim(),
          nif: formData.cliente.nif?.trim() || "",
        },
        dataOrcamento,
        dataValidade,
        orcamentista: user.email || "",
        itens: formData.itens,
        funcionariosSelecionados: formData.funcionariosSelecionados,
        servicosSelecionados: formData.servicosSelecionados,
        subtotal,
        impostos: 0,
        margemLucro: formData.margemLucro,
        valorTotal,
        observacoes: formData.observacoes,
        status: editingOrcamento?.status || "rascunho",
        userId: user.uid,
        createdAt: editingOrcamento?.createdAt || new Date(),
        updatedAt: new Date(),
      }

      if (editingOrcamento) {
        await FirebaseService.updateOrcamento(editingOrcamento.id!, orcamentoData)
        toast({
          title: "Orcamento atualizado",
          description: "O orcamento foi atualizado com sucesso.",
        })
      } else {
        await FirebaseService.addOrcamento(orcamentoData, user.uid)
        toast({
          title: "Orcamento criado",
          description: "O orcamento foi criado com sucesso.",
        })
      }

      resetForm()
      setIsDialogOpen(false)
      await loadData()
    } catch (error) {
      console.error("Erro ao salvar orcamento:", error)
      toast({
        title: "Erro ao salvar orcamento",
        description: "Nao foi possivel salvar o orcamento.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (orcamento: Orcamento) => {
    setEditingOrcamento(orcamento)
    setFormData({
      clienteId: orcamento.clienteId || "",
      cliente: {
        nome: orcamento.cliente.nome,
        email: orcamento.cliente.email,
        telefone: orcamento.cliente.telefone,
        morada: orcamento.cliente.morada,
        cidade: orcamento.cliente.cidade,
        codigoPostal: orcamento.cliente.codigoPostal,
        nif: orcamento.cliente.nif || "",
      },
      dataOrcamento: toDateInput(new Date(orcamento.dataOrcamento)),
      dataValidade: toDateInput(new Date(orcamento.dataValidade)),
      funcionariosSelecionados: orcamento.funcionariosSelecionados || [],
      servicosSelecionados: orcamento.servicosSelecionados || [],
      itens: orcamento.itens || [],
      margemLucro: orcamento.margemLucro || 0,
      observacoes: orcamento.observacoes || "",
    })
    setServicoForm(getDefaultServicoForm())
    setMaoObraForm(getDefaultMaoObraForm())
    setIsDialogOpen(true)
  }

  const handleDelete = async (id?: string) => {
    if (!id) return
    if (!confirm("Tem certeza que deseja excluir este orcamento?")) return

    try {
      setLoading(true)
      await FirebaseService.deleteOrcamento(id)
      toast({
        title: "Orcamento excluido",
        description: "O orcamento foi excluido com sucesso.",
      })
      await loadData()
    } catch (error) {
      console.error("Erro ao excluir orcamento:", error)
      toast({
        title: "Erro ao excluir orcamento",
        description: "Nao foi possivel excluir o orcamento.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleOpenDocument = async (orcamento: Orcamento, shouldPrint: boolean) => {
    if (!user) return
    if (!orcamento.id) return

    try {
      setGeneratingDocId(orcamento.id)
      const termos = await FirebaseService.getTermosServico(user.uid, true)
      const html = buildOrcamentoDocumentHtml(orcamento, termos)
      const popup = window.open("", "_blank", "width=1024,height=720")

      if (!popup) {
        toast({
          title: "Nao foi possivel abrir o documento",
          description: "Desbloqueie popups do navegador para emitir PDF.",
          variant: "destructive",
        })
        return
      }

      popup.document.open()
      popup.document.write(html)
      popup.document.close()
      popup.focus()

      if (shouldPrint) {
        setTimeout(() => popup.print(), 350)
      }
    } catch (error) {
      console.error("Erro ao gerar documento:", error)
      toast({
        title: "Erro ao gerar documento",
        description: "Nao foi possivel gerar o documento deste orcamento.",
        variant: "destructive",
      })
    } finally {
      setGeneratingDocId(null)
    }
  }

  const resetForm = () => {
    setFormData(getDefaultFormData())
    setEditingOrcamento(null)
    setServicoForm(getDefaultServicoForm())
    setMaoObraForm(getDefaultMaoObraForm())
  }

  const subtotalAtual = calculateSubtotal(formData.itens)
  const valorTotalAtual = calculateTotal(subtotalAtual, formData.margemLucro)
  const selectedClientValue =
    formData.clienteId && clientes.some((cliente) => cliente.id === formData.clienteId) ? formData.clienteId : "__novo"

  const getStatusBadge = (status: Orcamento["status"]) => {
    const variants: Record<Orcamento["status"], "default" | "secondary" | "destructive" | "outline"> = {
      rascunho: "secondary",
      enviado: "default",
      aprovado: "default",
      rejeitado: "destructive",
    }

    return <Badge variant={variants[status] || "secondary"}>{getStatusLabel(status)}</Badge>
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Orcamentos</h1>
          <p className="text-muted-foreground mt-2">Fluxo com cliente automatico, valor de servico vinculado e PDF</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm} className="rounded-full">
              <Plus className="h-4 w-4 mr-2" />
              Novo Orcamento
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[980px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingOrcamento ? "Editar Orcamento" : "Novo Orcamento"}</DialogTitle>
              <DialogDescription>
                {editingOrcamento ? "Atualize os dados do orcamento." : "Crie um novo orcamento no fluxo completo."}
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Cliente</h3>
                <div className="space-y-2">
                  <Label>Selecionar cliente existente</Label>
                  <Select value={selectedClientValue} onValueChange={handleClientSelect}>
                    <SelectTrigger className="rounded-full">
                      <SelectValue placeholder="Selecione um cliente ou use novo cadastro" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__novo">Novo cliente</SelectItem>
                      {clientes.map((cliente) => (
                        <SelectItem key={cliente.id} value={cliente.id || ""}>
                          {cliente.nome} - {cliente.numeroUnico}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="clienteNome">Nome Completo</Label>
                    <Input
                      id="clienteNome"
                      value={formData.cliente.nome}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          clienteId: "",
                          cliente: { ...formData.cliente, nome: e.target.value },
                        })
                      }
                      placeholder="Nome do cliente"
                      required
                      className="rounded-full"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="clienteEmail">Email</Label>
                    <Input
                      id="clienteEmail"
                      type="email"
                      value={formData.cliente.email}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          clienteId: "",
                          cliente: { ...formData.cliente, email: e.target.value },
                        })
                      }
                      placeholder="email@exemplo.com"
                      required
                      className="rounded-full"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="clienteTelefone">Telefone</Label>
                    <Input
                      id="clienteTelefone"
                      value={formData.cliente.telefone}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          clienteId: "",
                          cliente: { ...formData.cliente, telefone: e.target.value },
                        })
                      }
                      placeholder="+351 xxx xxx xxx"
                      required
                      className="rounded-full"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="clienteNif">NIF (Opcional)</Label>
                    <Input
                      id="clienteNif"
                      value={formData.cliente.nif || ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          clienteId: "",
                          cliente: { ...formData.cliente, nif: e.target.value },
                        })
                      }
                      placeholder="123456789"
                      className="rounded-full"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="clienteMorada">Morada</Label>
                  <Input
                    id="clienteMorada"
                    value={formData.cliente.morada}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        clienteId: "",
                        cliente: { ...formData.cliente, morada: e.target.value },
                      })
                    }
                    placeholder="Rua, numero, andar"
                    required
                    className="rounded-full"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="clienteCidade">Cidade</Label>
                    <Input
                      id="clienteCidade"
                      value={formData.cliente.cidade}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          clienteId: "",
                          cliente: { ...formData.cliente, cidade: e.target.value },
                        })
                      }
                      placeholder="Cidade"
                      required
                      className="rounded-full"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="clienteCodigoPostal">Codigo Postal</Label>
                    <Input
                      id="clienteCodigoPostal"
                      value={formData.cliente.codigoPostal}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          clienteId: "",
                          cliente: { ...formData.cliente, codigoPostal: e.target.value },
                        })
                      }
                      placeholder="0000-000"
                      required
                      className="rounded-full"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="dataOrcamento">Data do Orcamento</Label>
                  <Input
                    id="dataOrcamento"
                    type="date"
                    value={formData.dataOrcamento}
                    onChange={(e) => setFormData({ ...formData, dataOrcamento: e.target.value })}
                    className="rounded-full"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dataValidade">Data de Validade</Label>
                  <Input
                    id="dataValidade"
                    type="date"
                    value={formData.dataValidade}
                    onChange={(e) => setFormData({ ...formData, dataValidade: e.target.value })}
                    className="rounded-full"
                    required
                  />
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-medium">Servico no orcamento</h3>
                <Card className="p-4 border-2 border-dashed">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Selecionar servico</Label>
                      <Select value={servicoForm.servicoId} onValueChange={handleServicoSelect}>
                        <SelectTrigger className="rounded-full">
                          <SelectValue placeholder="Escolha um servico" />
                        </SelectTrigger>
                        <SelectContent>
                          {servicos.map((servico) => (
                            <SelectItem key={servico.id} value={servico.id!}>
                              {servico.nome} ({getServiceCategoryName(servico.categoriaId, servico.categoriaNome)}) -{" "}
                              {formatCurrency(servico.preco || 0)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {servicoForm.servicoId && (
                      <>
                        <div className="grid grid-cols-3 gap-4">
                          <div className="space-y-2">
                            <Label>Unidade (automatico)</Label>
                            <Input value={servicoForm.unidade} readOnly className="rounded-full bg-muted" />
                          </div>
                          <div className="space-y-2">
                            <Label>Quantidade</Label>
                            <Input
                              type="number"
                              step="0.01"
                              min="0.01"
                              value={servicoForm.quantidade}
                              onChange={(e) =>
                                setServicoForm({
                                  ...servicoForm,
                                  quantidade: Number.parseFloat(e.target.value) || 1,
                                })
                              }
                              className="rounded-full"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Valor unitario (automatico)</Label>
                            <Input
                              type="number"
                              value={servicoForm.precoUnitario}
                              readOnly
                              className="rounded-full bg-muted"
                            />
                          </div>
                        </div>

                        <div className="p-3 bg-muted rounded-lg flex items-center justify-between">
                          <span className="font-medium">Total do item</span>
                          <span className="text-lg font-bold">
                            {formatCurrency(servicoForm.quantidade * servicoForm.precoUnitario)}
                          </span>
                        </div>

                        <div className="flex justify-end">
                          <Button type="button" onClick={handleServicoFormSubmit} className="rounded-full">
                            Adicionar ao Orcamento
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                </Card>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-medium">Mao de obra</h3>
                <Card className="p-4 border-2 border-dashed">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Selecionar funcionario</Label>
                      <Select value={maoObraForm.funcionarioId} onValueChange={handleFuncionarioSelect}>
                        <SelectTrigger className="rounded-full">
                          <SelectValue placeholder="Escolha um funcionario" />
                        </SelectTrigger>
                        <SelectContent>
                          {funcionarios.map((funcionario) => (
                            <SelectItem key={funcionario.id} value={funcionario.id!}>
                              {funcionario.nome} - {formatCurrency(funcionario.custoHora)} /hora
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {maoObraForm.funcionarioId && (
                      <>
                        <div className="grid grid-cols-3 gap-4">
                          <div className="space-y-2">
                            <Label>Unidade</Label>
                            <Select
                              value={maoObraForm.unidade}
                              onValueChange={(value) => setMaoObraForm({ ...maoObraForm, unidade: value })}
                            >
                              <SelectTrigger className="rounded-full">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="horas">Horas</SelectItem>
                                <SelectItem value="dias">Dias</SelectItem>
                                <SelectItem value="projeto">Projeto</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Quantidade de horas</Label>
                            <Input
                              type="number"
                              step="0.01"
                              min="0.01"
                              value={maoObraForm.quantidade}
                              onChange={(e) =>
                                setMaoObraForm({
                                  ...maoObraForm,
                                  quantidade: Number.parseFloat(e.target.value) || 1,
                                })
                              }
                              className="rounded-full"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Valor unitario da hora (automatico)</Label>
                            <Input value={maoObraForm.precoUnitario.toFixed(2)} readOnly className="rounded-full bg-muted" />
                          </div>
                        </div>

                        <div className="p-3 bg-muted rounded-lg flex items-center justify-between">
                          <span className="font-medium">Total do item</span>
                          <span className="text-lg font-bold">
                            {formatCurrency(maoObraForm.quantidade * maoObraForm.precoUnitario)}
                          </span>
                        </div>

                        <div className="flex justify-end">
                          <Button type="button" onClick={handleMaoObraFormSubmit} className="rounded-full">
                            Adicionar ao Orcamento
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                </Card>
              </div>

              {formData.itens.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Itens do Orcamento</h3>
                  <div className="space-y-3">
                    {formData.itens.map((item) => {
                      const readOnlyServico = item.tipo === "servico"
                      return (
                        <div key={item.id} className="p-4 border rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <div>
                              <h4 className="font-medium">{item.descricao}</h4>
                              <Badge variant="outline" className="text-xs mt-1">
                                {item.tipo === "servico" ? "Servico" : item.tipo === "mao_obra" ? "Mao de obra" : "Material"}
                              </Badge>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => handleItemRemove(item.id)}
                              className="h-6 w-6 text-destructive hover:text-destructive"
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                          <div className="grid grid-cols-4 gap-2">
                            <div>
                              <Label className="text-xs">Quantidade</Label>
                              <Input
                                type="number"
                                step="0.01"
                                value={item.quantidade}
                                onChange={(e) =>
                                  handleItemUpdate(item.id, "quantidade", Number.parseFloat(e.target.value) || 0)
                                }
                                className="h-8 text-sm"
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Unidade</Label>
                              <Input
                                value={item.unidade}
                                readOnly={readOnlyServico}
                                onChange={(e) => handleItemUpdate(item.id, "unidade", e.target.value)}
                                className={`h-8 text-sm ${readOnlyServico ? "bg-muted" : ""}`}
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Preco Unit. (EUR)</Label>
                              <Input
                                type="number"
                                step="0.01"
                                value={item.precoUnitario}
                                readOnly={readOnlyServico}
                                onChange={(e) =>
                                  handleItemUpdate(item.id, "precoUnitario", Number.parseFloat(e.target.value) || 0)
                                }
                                className={`h-8 text-sm ${readOnlyServico ? "bg-muted" : ""}`}
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Total (EUR)</Label>
                              <Input value={item.total.toFixed(2)} readOnly className="h-8 text-sm bg-muted" />
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              <div className="space-y-4">
                <h3 className="text-lg font-medium">Precificacao</h3>
                <div className="space-y-2">
                  <Label htmlFor="margemLucro">Margem de lucro (%)</Label>
                  <Input
                    id="margemLucro"
                    type="number"
                    step="0.1"
                    value={formData.margemLucro}
                    onChange={(e) => setFormData({ ...formData, margemLucro: Number.parseFloat(e.target.value) || 0 })}
                    required
                    className="rounded-full"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="observacoes">Observacoes (Opcional)</Label>
                <Textarea
                  id="observacoes"
                  value={formData.observacoes}
                  onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                  placeholder="Observacoes adicionais sobre o orcamento..."
                  rows={3}
                />
              </div>

              {formData.itens.length > 0 && (
                <div className="space-y-2 p-4 bg-muted rounded-lg">
                  <h4 className="font-medium">Resumo do Orcamento</h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span>Subtotal:</span>
                      <span>{formatCurrency(subtotalAtual)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Margem ({formData.margemLucro}%):</span>
                      <span>{formatCurrency((subtotalAtual * formData.margemLucro) / 100)}</span>
                    </div>
                    <div className="flex justify-between font-medium border-t pt-1">
                      <span>Total:</span>
                      <span>{formatCurrency(valorTotalAtual)}</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end space-x-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={loading} className="rounded-full">
                  {loading ? "A guardar..." : editingOrcamento ? "Atualizar" : "Criar Orcamento"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Pesquisar orcamentos..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 rounded-full"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[220px] rounded-full">
                <SelectValue placeholder="Todos os status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="rascunho">Rascunho</SelectItem>
                <SelectItem value="enviado">Enviado</SelectItem>
                <SelectItem value="aprovado">Aprovado</SelectItem>
                <SelectItem value="rejeitado">Rejeitado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {filteredOrcamentos.map((orcamento, index) => (
          <Card key={orcamento.id} className="animate-slide-in" style={{ animationDelay: `${index * 100}ms` }}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Calculator className="h-5 w-5" />
                    Orcamento #{orcamento.numero}
                  </CardTitle>
                  <CardDescription>{orcamento.cliente.nome}</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusBadge(orcamento.status)}
                  <span className="text-lg font-bold">{formatCurrency(orcamento.valorTotal)}</span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  <p>Data: {new Date(orcamento.dataOrcamento).toLocaleDateString("pt-PT")}</p>
                  <p>Validade: {new Date(orcamento.dataValidade).toLocaleDateString("pt-PT")}</p>
                  <p>Itens: {orcamento.itens.length}</p>
                </div>
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handleOpenDocument(orcamento, false)}
                    className="rounded-full bg-transparent"
                  >
                    <FileText className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handleOpenDocument(orcamento, true)}
                    className="rounded-full bg-transparent"
                    disabled={generatingDocId === orcamento.id}
                  >
                    {generatingDocId === orcamento.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                  </Button>
                  <Button variant="outline" size="icon" onClick={() => handleEdit(orcamento)} className="rounded-full">
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handleDelete(orcamento.id)}
                    className="rounded-full text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {filteredOrcamentos.length === 0 && orcamentos.length > 0 && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Search className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">Nenhum orcamento encontrado</h3>
              <p className="text-muted-foreground text-center mb-4">
                Tente ajustar os filtros de pesquisa para encontrar os orcamentos desejados.
              </p>
              <Button
                onClick={() => {
                  setSearchTerm("")
                  setStatusFilter("all")
                }}
                variant="outline"
                className="rounded-full"
              >
                Limpar filtros
              </Button>
            </CardContent>
          </Card>
        )}

        {orcamentos.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Calculator className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">Nenhum orcamento criado</h3>
              <p className="text-muted-foreground text-center mb-4">Comece criando o primeiro orcamento.</p>
              <Button onClick={() => setIsDialogOpen(true)} className="rounded-full">
                <Plus className="h-4 w-4 mr-2" />
                Criar primeiro orcamento
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
