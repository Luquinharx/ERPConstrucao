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
import { Plus, Edit, Trash2, Calculator, Search, FileText, Download, X, Loader2, Copy } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useAuth } from "@/hooks/use-auth"
import { toast } from "@/hooks/use-toast"
import type { Orcamento, Funcionario, Servico, ItemOrcamento, Cliente, TermoServico } from "@/lib/types"
import { FirebaseService } from "@/lib/firebase-service"
import { formatCurrency, matchesSearch, round2, toFixed2 } from "@/lib/utils"
import { getServiceCategoryName } from "@/lib/service-categories"
import { ListToolbar } from "@/components/ui/list-toolbar"
import { useSearchQuery } from "@/hooks/use-search-query"

/** Documento gerado: venda (cliente) ou custo (interno). */
type TipoDocumento = "venda" | "custo"

interface OrcamentoFormState {
  clienteId: string
  cliente: Orcamento["cliente"]
  dataOrcamento: string
  dataValidade: string
  funcionariosSelecionados: string[]
  servicosSelecionados: string[]
  itens: ItemOrcamento[]
  margemLucro: number
  /** Custo de transporte: linha propria no final do orcamento. */
  transporte: number
  observacoes: string
}

interface ServicoFormState {
  servicoId: string
  quantidade: number
  unidade: string
  precoUnitario: number
  precoFixo: number
  transporte: number
}

interface MaoObraFormState {
  funcionarioId: string
  quantidade: number
  unidade: string
  precoUnitario: number
  custoUnitario: number
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
    transporte: 0,
    observacoes: "",
  }
}

function getDefaultServicoForm(): ServicoFormState {
  return {
    servicoId: "",
    quantidade: 1,
    unidade: "",
    precoUnitario: 0,
    precoFixo: 0,
    transporte: 0,
  }
}

function getDefaultMaoObraForm(): MaoObraFormState {
  return {
    funcionarioId: "",
    quantidade: 8,
    unidade: "horas",
    precoUnitario: 0,
    custoUnitario: 0,
  }
}

/**
 * Total do item. Itens marcados como valor fixo nao multiplicam pela
 * quantidade/area (ex.: andaime, deslocacao, montagem).
 */
function calculateItemTotal(quantidade: number, precoUnitario: number, valorFixo?: boolean): number {
  if (valorFixo) return round2(precoUnitario)
  return round2((Number(quantidade) || 0) * (Number(precoUnitario) || 0))
}

function calculateSubtotal(itens: ItemOrcamento[]): number {
  return round2(itens.reduce((sum, item) => sum + (Number(item.total) || 0), 0))
}

function calculateSubtotalCusto(itens: ItemOrcamento[]): number {
  return round2(
    itens.reduce((sum, item) => {
      const custo = item.custoUnitario ?? item.precoUnitario
      return sum + calculateItemTotal(item.quantidade, custo, item.valorFixo)
    }, 0),
  )
}

/** Total de venda: subtotal + margem, com o transporte somado no final. */
function calculateTotal(subtotal: number, margemLucro: number, transporte = 0): number {
  return round2(subtotal * (1 + (Number(margemLucro) || 0) / 100) + (Number(transporte) || 0))
}

/** Total de custo: custo real dos itens + transporte, sem margem. */
function calculateTotalCusto(subtotalCusto: number, transporte = 0): number {
  return round2(subtotalCusto + (Number(transporte) || 0))
}

/** Separa preco variavel (por unidade), fixo e transporte, com fallback para servicos antigos. */
function getServicoPrecos(servico: Servico) {
  const transporte = round2(servico.transporte ?? 0)
  const temSplit = servico.precoVariavel !== undefined || servico.precoFixo !== undefined

  return {
    precoVariavel: temSplit ? round2(servico.precoVariavel ?? 0) : round2(Number(servico.preco ?? 0) - transporte),
    precoFixo: temSplit ? round2(servico.precoFixo ?? 0) : 0,
    transporte,
  }
}

/** Descricao impressa no PDF: no de venda o nome do funcionario nunca aparece. */
function getItemDescricaoDocumento(item: ItemOrcamento, tipo: TipoDocumento): string {
  if (tipo === "custo") return item.nome || item.descricao
  if (item.tipo === "mao_obra") return item.descricaoCliente || "Mao de obra"
  return item.nome || item.descricao
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

function buildOrcamentoDocumentHtml(
  orcamento: Orcamento,
  termos: TermoServico[],
  tipo: TipoDocumento = "venda",
): string {
  const isCusto = tipo === "custo"
  const itens = orcamento.itens || []

  const subtotal = round2(orcamento.subtotal || 0)
  const subtotalCusto = round2(orcamento.subtotalCusto ?? calculateSubtotalCusto(itens))
  const transporte = round2(orcamento.transporte || 0)
  const margem = round2(orcamento.margemLucro || 0)
  const margemValor = round2((subtotal * margem) / 100)
  const totalVenda = round2(orcamento.valorTotal || 0)
  const totalCusto = round2(orcamento.valorTotalCusto ?? calculateTotalCusto(subtotalCusto, transporte))
  const total = isCusto ? totalCusto : totalVenda
  const lucro = round2(totalVenda - totalCusto)

  const termosAtivos = termos.filter((item) => item.ativo)
  const grouped = {
    termos: termosAtivos.filter((item) => item.tipo === "termos"),
    regras: termosAtivos.filter((item) => item.tipo === "regras"),
    condicoes: termosAtivos.filter((item) => item.tipo === "condicoes"),
  }

  const itensRows = itens
    .map((item) => {
      const nome = getItemDescricaoDocumento(item, tipo)
      const detalhe = item.nome && item.descricao && item.descricao !== item.nome ? item.descricao : ""
      const precoUnitario = isCusto ? (item.custoUnitario ?? item.precoUnitario) : item.precoUnitario
      const totalItem = calculateItemTotal(item.quantidade, precoUnitario, item.valorFixo)
      const quantidadeLabel = item.valorFixo ? "Valor fixo" : toFixed2(item.quantidade)

      return `
        <tr>
          <td>
            <div style="font-weight:600">${escapeHtml(nome)}</div>
            ${detalhe ? `<div style="color:#475569; font-size:12px; margin-top:2px">${escapeHtml(detalhe)}</div>` : ""}
          </td>
          <td>${escapeHtml(item.valorFixo ? "-" : item.unidade)}</td>
          <td style="text-align:right">${quantidadeLabel}</td>
          <td style="text-align:right">${formatCurrency(precoUnitario)}</td>
          <td style="text-align:right">${formatCurrency(totalItem)}</td>
        </tr>`
    })
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
      <title>Orcamento ${isCusto ? "CUSTO " : ""}${escapeHtml(orcamento.numero)}</title>
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
          <div style="margin-top:6px; display:inline-block; padding:3px 10px; border-radius:999px; font-size:12px; font-weight:700; ${
            isCusto ? "background:#fee2e2; color:#991b1b;" : "background:#dcfce7; color:#166534;"
          }">${isCusto ? "ORCAMENTO DE CUSTO - USO INTERNO" : "ORCAMENTO DE VENDA - CLIENTE"}</div>
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
        ${
          isCusto
            ? `
          <div><span>Subtotal (custo real):</span><span>${formatCurrency(subtotalCusto)}</span></div>
          <div><span>Transporte:</span><span>${formatCurrency(transporte)}</span></div>
          <div class="total-final"><span>Total de custo:</span><span>${formatCurrency(totalCusto)}</span></div>
          <div style="margin-top:8px"><span>Total de venda:</span><span>${formatCurrency(totalVenda)}</span></div>
          <div><span>Lucro previsto:</span><span>${formatCurrency(lucro)}</span></div>
        `
            : `
          <div><span>Subtotal:</span><span>${formatCurrency(subtotal)}</span></div>
          <div><span>Margem (${toFixed2(margem)}%):</span><span>${formatCurrency(margemValor)}</span></div>
          <div><span>Transporte:</span><span>${formatCurrency(transporte)}</span></div>
          <div class="total-final"><span>Total:</span><span>${formatCurrency(totalVenda)}</span></div>
        `
        }
      </section>

      ${
        orcamento.observacoes
          ? `<section style="margin-top:20px;"><h3>Observacoes</h3><p style="line-height:1.5;">${escapeHtml(orcamento.observacoes)}</p></section>`
          : ""
      }

      ${isCusto ? "" : termosHtml}

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
  const { searchTerm, setSearchTerm, clearSearch } = useSearchQuery()
  const [statusFilter, setStatusFilter] = useState("all")
  const [generatingDocId, setGeneratingDocId] = useState<string | null>(null)

  const [servicoForm, setServicoForm] = useState<ServicoFormState>(getDefaultServicoForm())
  const [maoObraForm, setMaoObraForm] = useState<MaoObraFormState>(getDefaultMaoObraForm())
  const [formData, setFormData] = useState<OrcamentoFormState>(getDefaultFormData())

  // Duplicar mao de obra: item de origem + funcionario escolhido para a copia
  const [duplicandoItem, setDuplicandoItem] = useState<ItemOrcamento | null>(null)
  const [duplicarFuncionarioId, setDuplicarFuncionarioId] = useState("")

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
      filtered = filtered.filter((orcamento) =>
        matchesSearch(searchTerm, [
          orcamento.numero,
          orcamento.cliente.nome,
          orcamento.cliente.email,
          orcamento.cliente.telefone,
          orcamento.cliente.cidade,
          orcamento.cliente.nif,
          getStatusLabel(orcamento.status),
        ]),
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

    const { precoVariavel, precoFixo, transporte } = getServicoPrecos(servico)

    setServicoForm({
      servicoId,
      quantidade: 1,
      unidade: servico.unidade || "un",
      precoUnitario: precoVariavel,
      precoFixo,
      transporte,
    })
  }

  const handleFuncionarioSelect = (funcionarioId: string) => {
    const funcionario = funcionarios.find((item) => item.id === funcionarioId)
    if (!funcionario) return

    setMaoObraForm({
      ...maoObraForm,
      funcionarioId,
      precoUnitario: round2(funcionario.custoHora || 0),
      custoUnitario: round2(funcionario.custoHoraCalculado ?? funcionario.custoHora ?? 0),
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
    const nome = `${servico.nome} (${categoryName})`
    const descricao = servico.descricao?.trim() || nome
    const timestamp = Date.now()

    const novosItens: ItemOrcamento[] = [
      {
        id: `servico-${servicoForm.servicoId}-${timestamp}`,
        nome,
        descricao,
        quantidade: round2(servicoForm.quantidade),
        unidade: servicoForm.unidade,
        precoUnitario: round2(servicoForm.precoUnitario),
        custoUnitario: round2(servicoForm.precoUnitario),
        total: calculateItemTotal(servicoForm.quantidade, servicoForm.precoUnitario),
        valorFixo: false,
        tipo: "servico",
        servicoId: servicoForm.servicoId,
      },
    ]

    // Parte fixa do servico: entra uma unica vez, sem multiplicar pela area
    if (servicoForm.precoFixo > 0) {
      novosItens.push({
        id: `servico-fixo-${servicoForm.servicoId}-${timestamp}`,
        nome: `${servico.nome} - valor fixo`,
        descricao: "Itens e equipamentos que nao acompanham a area (cobrados uma unica vez)",
        quantidade: 1,
        unidade: servicoForm.unidade,
        precoUnitario: round2(servicoForm.precoFixo),
        custoUnitario: round2(servicoForm.precoFixo),
        total: round2(servicoForm.precoFixo),
        valorFixo: true,
        tipo: "servico",
        servicoId: servicoForm.servicoId,
      })
    }

    setFormData({
      ...formData,
      itens: [...formData.itens, ...novosItens],
      servicosSelecionados: [...formData.servicosSelecionados, servicoForm.servicoId],
      // Transporte do servico soma na linha final do orcamento
      transporte: round2(formData.transporte + servicoForm.transporte),
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

    const novoItem = buildMaoObraItem(funcionario, maoObraForm.quantidade, maoObraForm.unidade)

    setFormData({
      ...formData,
      itens: [...formData.itens, novoItem],
      funcionariosSelecionados: [...new Set([...formData.funcionariosSelecionados, maoObraForm.funcionarioId])],
    })
    setMaoObraForm(getDefaultMaoObraForm())
  }

  /**
   * Monta um item de mao de obra. O nome do funcionario fica apenas no uso interno:
   * o PDF de venda usa a descricao para o cliente (funcao, sem nome).
   */
  const buildMaoObraItem = (funcionario: Funcionario, quantidade: number, unidade: string): ItemOrcamento => {
    const precoUnitario = round2(funcionario.custoHora || 0)
    const custoUnitario = round2(funcionario.custoHoraCalculado ?? funcionario.custoHora ?? 0)

    return {
      id: `funcionario-${funcionario.id}-${Date.now()}-${Math.round(Math.random() * 1000)}`,
      nome: `Mao de obra - ${funcionario.nome}`,
      descricao: `Mao de obra - ${funcionario.nome}${funcionario.funcao ? ` (${funcionario.funcao})` : ""}`,
      descricaoCliente: funcionario.funcao ? `Mao de obra - ${funcionario.funcao}` : "Mao de obra",
      quantidade: round2(quantidade),
      unidade,
      precoUnitario,
      custoUnitario,
      total: calculateItemTotal(quantidade, precoUnitario),
      valorFixo: false,
      tipo: "mao_obra",
      funcionarioId: funcionario.id,
      funcionarioNome: funcionario.nome,
      funcionarioFuncao: funcionario.funcao,
    }
  }

  const handleDuplicarMaoObra = () => {
    if (!duplicandoItem) return

    const funcionario = funcionarios.find((item) => item.id === duplicarFuncionarioId)
    if (!funcionario) {
      toast({
        title: "Selecione um funcionario",
        description: "Escolha o funcionario que vai receber a copia da mao de obra.",
        variant: "destructive",
      })
      return
    }

    const novoItem = buildMaoObraItem(funcionario, duplicandoItem.quantidade, duplicandoItem.unidade)

    setFormData({
      ...formData,
      itens: [...formData.itens, novoItem],
      funcionariosSelecionados: [...new Set([...formData.funcionariosSelecionados, funcionario.id!])],
    })

    toast({
      title: "Mao de obra duplicada",
      description: `${toFixed2(duplicandoItem.quantidade)} ${duplicandoItem.unidade} atribuidas a ${funcionario.nome}.`,
    })

    setDuplicandoItem(null)
    setDuplicarFuncionarioId("")
  }

  const handleItemUpdate = (
    itemId: string,
    field: keyof ItemOrcamento,
    value: string | number | boolean,
  ) => {
    const updatedItens = formData.itens.map((item) => {
      if (item.id !== itemId) return item

      const updatedItem = {
        ...item,
        [field]: value,
      } as ItemOrcamento

      if (field === "quantidade" || field === "precoUnitario" || field === "custoUnitario" || field === "valorFixo") {
        updatedItem.total = calculateItemTotal(
          updatedItem.quantidade,
          updatedItem.precoUnitario,
          updatedItem.valorFixo,
        )
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
    let transporte = formData.transporte

    if (target?.tipo === "servico" && target.servicoId) {
      const aindaTemServico = updatedItens.some(
        (item) => item.tipo === "servico" && item.servicoId === target.servicoId,
      )

      if (!aindaTemServico) {
        servicosSelecionados = formData.servicosSelecionados.filter((id) => id !== target.servicoId)
        // Devolve o transporte que este servico tinha somado na linha final
        const servico = servicos.find((item) => item.id === target.servicoId)
        if (servico) {
          transporte = round2(Math.max(0, transporte - getServicoPrecos(servico).transporte))
        }
      }
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
      transporte,
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
    const subtotalCusto = calculateSubtotalCusto(formData.itens)
    const transporte = round2(formData.transporte)
    const valorTotal = calculateTotal(subtotal, formData.margemLucro, transporte)
    const valorTotalCusto = calculateTotalCusto(subtotalCusto, transporte)

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
        subtotalCusto,
        transporte,
        impostos: 0,
        margemLucro: round2(formData.margemLucro),
        valorTotal,
        valorTotalCusto,
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
      transporte: round2(orcamento.transporte || 0),
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

  const handleOpenDocument = async (orcamento: Orcamento, shouldPrint: boolean, tipo: TipoDocumento) => {
    if (!user) return
    if (!orcamento.id) return

    try {
      setGeneratingDocId(orcamento.id)
      const termos = tipo === "venda" ? await FirebaseService.getTermosServico(user.uid, true) : []
      const html = buildOrcamentoDocumentHtml(orcamento, termos, tipo)
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
  const subtotalCustoAtual = calculateSubtotalCusto(formData.itens)
  const transporteAtual = round2(formData.transporte)
  const valorTotalAtual = calculateTotal(subtotalAtual, formData.margemLucro, transporteAtual)
  const valorTotalCustoAtual = calculateTotalCusto(subtotalCustoAtual, transporteAtual)
  const lucroPrevisto = round2(valorTotalAtual - valorTotalCustoAtual)
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
                            <Label>Valor por {servicoForm.unidade || "unidade"} (automatico)</Label>
                            <Input value={toFixed2(servicoForm.precoUnitario)} readOnly className="rounded-full bg-muted" />
                          </div>
                        </div>

                        <div className="p-3 bg-muted rounded-lg space-y-1 text-sm">
                          <div className="flex items-center justify-between">
                            <span>
                              {toFixed2(servicoForm.quantidade)} {servicoForm.unidade} x{" "}
                              {formatCurrency(servicoForm.precoUnitario)}
                            </span>
                            <span>{formatCurrency(calculateItemTotal(servicoForm.quantidade, servicoForm.precoUnitario))}</span>
                          </div>
                          {servicoForm.precoFixo > 0 && (
                            <div className="flex items-center justify-between">
                              <span>Valor fixo (nao multiplica pela area)</span>
                              <span>{formatCurrency(servicoForm.precoFixo)}</span>
                            </div>
                          )}
                          {servicoForm.transporte > 0 && (
                            <div className="flex items-center justify-between text-muted-foreground">
                              <span>Transporte (vai para a linha final)</span>
                              <span>{formatCurrency(servicoForm.transporte)}</span>
                            </div>
                          )}
                          <div className="flex items-center justify-between border-t pt-1 font-medium">
                            <span>Total do item</span>
                            <span className="text-lg font-bold">
                              {formatCurrency(
                                round2(
                                  calculateItemTotal(servicoForm.quantidade, servicoForm.precoUnitario) +
                                    servicoForm.precoFixo,
                                ),
                              )}
                            </span>
                          </div>
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
                            <Label>Valor de venda/hora (automatico)</Label>
                            <Input value={toFixed2(maoObraForm.precoUnitario)} readOnly className="rounded-full bg-muted" />
                          </div>
                        </div>

                        <div className="p-3 bg-muted rounded-lg space-y-1 text-sm">
                          <div className="flex items-center justify-between text-muted-foreground">
                            <span>Custo real ({toFixed2(maoObraForm.custoUnitario)}/hora)</span>
                            <span>
                              {formatCurrency(calculateItemTotal(maoObraForm.quantidade, maoObraForm.custoUnitario))}
                            </span>
                          </div>
                          <div className="flex items-center justify-between border-t pt-1">
                            <span className="font-medium">Total do item (venda)</span>
                            <span className="text-lg font-bold">
                              {formatCurrency(calculateItemTotal(maoObraForm.quantidade, maoObraForm.precoUnitario))}
                            </span>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          O nome do funcionario fica so no uso interno e no PDF de custo. No PDF de venda o item aparece
                          como &quot;Mao de obra&quot; com a funcao.
                        </p>

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
                      const custoUnitario = item.custoUnitario ?? item.precoUnitario
                      return (
                        <div key={item.id} className="p-4 border rounded-lg">
                          <div className="flex items-start justify-between mb-2 gap-2">
                            <div className="flex-1 space-y-2">
                              <div>
                                <Label className="text-xs">Nome do item</Label>
                                <Input
                                  value={item.nome ?? item.descricao}
                                  onChange={(e) => handleItemUpdate(item.id, "nome", e.target.value)}
                                  className="h-8 text-sm font-medium"
                                />
                              </div>
                              <div>
                                <Label className="text-xs">Descricao do item</Label>
                                <Textarea
                                  value={item.descricao}
                                  onChange={(e) => handleItemUpdate(item.id, "descricao", e.target.value)}
                                  rows={2}
                                  className="text-sm"
                                  placeholder="Descricao detalhada impressa no orcamento"
                                />
                              </div>
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge variant="outline" className="text-xs">
                                  {item.tipo === "servico" ? "Servico" : item.tipo === "mao_obra" ? "Mao de obra" : "Material"}
                                </Badge>
                                {item.valorFixo && (
                                  <Badge variant="secondary" className="text-xs">
                                    Valor fixo
                                  </Badge>
                                )}
                                {item.tipo === "mao_obra" && (
                                  <Badge variant="secondary" className="text-xs">
                                    No PDF do cliente: {item.descricaoCliente || "Mao de obra"}
                                  </Badge>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              {item.tipo === "mao_obra" && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  title="Duplicar mao de obra para outro funcionario"
                                  onClick={() => {
                                    setDuplicandoItem(item)
                                    setDuplicarFuncionarioId(item.funcionarioId || "")
                                  }}
                                  className="h-6 w-6"
                                >
                                  <Copy className="h-3 w-3" />
                                </Button>
                              )}
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
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                            <div>
                              <Label className="text-xs">Quantidade</Label>
                              <Input
                                type="number"
                                step="0.01"
                                value={item.quantidade}
                                disabled={item.valorFixo}
                                onChange={(e) =>
                                  handleItemUpdate(item.id, "quantidade", round2(Number.parseFloat(e.target.value) || 0))
                                }
                                className={`h-8 text-sm ${item.valorFixo ? "bg-muted" : ""}`}
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
                              <Label className="text-xs">Custo Unit. (EUR)</Label>
                              <Input
                                type="number"
                                step="0.01"
                                value={custoUnitario}
                                onChange={(e) =>
                                  handleItemUpdate(
                                    item.id,
                                    "custoUnitario",
                                    round2(Number.parseFloat(e.target.value) || 0),
                                  )
                                }
                                className="h-8 text-sm"
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Venda Unit. (EUR)</Label>
                              <Input
                                type="number"
                                step="0.01"
                                value={item.precoUnitario}
                                onChange={(e) =>
                                  handleItemUpdate(
                                    item.id,
                                    "precoUnitario",
                                    round2(Number.parseFloat(e.target.value) || 0),
                                  )
                                }
                                className="h-8 text-sm"
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Total venda (EUR)</Label>
                              <Input value={toFixed2(item.total)} readOnly className="h-8 text-sm bg-muted" />
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center justify-between gap-2 mt-2">
                            <label className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Checkbox
                                checked={!!item.valorFixo}
                                onCheckedChange={(checked) => handleItemUpdate(item.id, "valorFixo", checked === true)}
                              />
                              Valor fixo: nao multiplica pela quantidade/area
                            </label>
                            <span className="text-xs text-muted-foreground">
                              Custo do item:{" "}
                              {formatCurrency(calculateItemTotal(item.quantidade, custoUnitario, item.valorFixo))}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              <div className="space-y-4">
                <h3 className="text-lg font-medium">Precificacao</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="margemLucro">Margem de lucro (%)</Label>
                    <Input
                      id="margemLucro"
                      type="number"
                      step="0.01"
                      value={formData.margemLucro}
                      onChange={(e) =>
                        setFormData({ ...formData, margemLucro: round2(Number.parseFloat(e.target.value) || 0) })
                      }
                      required
                      className="rounded-full"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="transporte">Custo de transporte (EUR)</Label>
                    <Input
                      id="transporte"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.transporte}
                      onChange={(e) =>
                        setFormData({ ...formData, transporte: round2(Number.parseFloat(e.target.value) || 0) })
                      }
                      className="rounded-full"
                    />
                    <p className="text-xs text-muted-foreground">
                      Somado automaticamente a partir dos servicos e lancado como linha propria no final do orcamento.
                    </p>
                  </div>
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
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2 p-4 bg-muted rounded-lg">
                    <h4 className="font-medium">Orcamento de Venda (cliente)</h4>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span>Subtotal:</span>
                        <span>{formatCurrency(subtotalAtual)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Margem ({toFixed2(formData.margemLucro)}%):</span>
                        <span>{formatCurrency(round2((subtotalAtual * formData.margemLucro) / 100))}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Transporte:</span>
                        <span>{formatCurrency(transporteAtual)}</span>
                      </div>
                      <div className="flex justify-between font-medium border-t pt-1">
                        <span>Total de venda:</span>
                        <span>{formatCurrency(valorTotalAtual)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2 p-4 border rounded-lg">
                    <h4 className="font-medium">Orcamento de Custo (interno)</h4>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span>Custo dos itens:</span>
                        <span>{formatCurrency(subtotalCustoAtual)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Transporte:</span>
                        <span>{formatCurrency(transporteAtual)}</span>
                      </div>
                      <div className="flex justify-between font-medium border-t pt-1">
                        <span>Total de custo:</span>
                        <span>{formatCurrency(valorTotalCustoAtual)}</span>
                      </div>
                      <div className="flex justify-between text-primary font-medium">
                        <span>Lucro previsto:</span>
                        <span>{formatCurrency(lucroPrevisto)}</span>
                      </div>
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

            {/* Duplicar mao de obra para outro funcionario */}
            <Dialog
              open={!!duplicandoItem}
              onOpenChange={(open) => {
                if (!open) {
                  setDuplicandoItem(null)
                  setDuplicarFuncionarioId("")
                }
              }}
            >
              <DialogContent className="sm:max-w-[480px]">
                <DialogHeader>
                  <DialogTitle>Duplicar Mao de Obra</DialogTitle>
                  <DialogDescription>
                    Copia {toFixed2(duplicandoItem?.quantidade || 0)} {duplicandoItem?.unidade} para outro funcionario.
                    O valor/hora usado e o do funcionario escolhido.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-2">
                  <Label>Funcionario da copia</Label>
                  <Select value={duplicarFuncionarioId} onValueChange={setDuplicarFuncionarioId}>
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

                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setDuplicandoItem(null)}>
                    Cancelar
                  </Button>
                  <Button type="button" onClick={handleDuplicarMaoObra} className="rounded-full">
                    <Copy className="h-4 w-4 mr-2" />
                    Duplicar
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </DialogContent>
        </Dialog>
      </div>

      <ListToolbar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        onClear={clearSearch}
        placeholder="Pesquisar por numero, cliente, email, cidade, NIF ou status..."
        resultCount={filteredOrcamentos.length}
        totalCount={orcamentos.length}
      >
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
      </ListToolbar>

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
                  <p>
                    Custo:{" "}
                    {formatCurrency(
                      orcamento.valorTotalCusto ??
                        calculateTotalCusto(calculateSubtotalCusto(orcamento.itens || []), orcamento.transporte),
                    )}
                    {orcamento.transporte ? ` | Transporte: ${formatCurrency(orcamento.transporte)}` : ""}
                  </p>
                </div>
                <div className="flex space-x-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        className="rounded-full bg-transparent"
                        title="Abrir orcamento (venda ou custo)"
                        disabled={generatingDocId === orcamento.id}
                      >
                        {generatingDocId === orcamento.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <FileText className="h-4 w-4" />
                        )}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Orcamento de Venda (cliente)</DropdownMenuLabel>
                      <DropdownMenuItem onClick={() => handleOpenDocument(orcamento, false, "venda")}>
                        <FileText className="h-4 w-4 mr-2" />
                        Visualizar venda - {formatCurrency(orcamento.valorTotal)}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleOpenDocument(orcamento, true, "venda")}>
                        <Download className="h-4 w-4 mr-2" />
                        Imprimir / PDF de venda
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuLabel>Orcamento de Custo (interno)</DropdownMenuLabel>
                      <DropdownMenuItem onClick={() => handleOpenDocument(orcamento, false, "custo")}>
                        <FileText className="h-4 w-4 mr-2" />
                        Visualizar custo -{" "}
                        {formatCurrency(
                          orcamento.valorTotalCusto ??
                            calculateTotalCusto(calculateSubtotalCusto(orcamento.itens || []), orcamento.transporte),
                        )}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleOpenDocument(orcamento, true, "custo")}>
                        <Download className="h-4 w-4 mr-2" />
                        Imprimir / PDF de custo
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
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
                  clearSearch()
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
