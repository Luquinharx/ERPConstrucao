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
import {
  Plus,
  Edit,
  Trash2,
  Calculator,
  Search,
  FileText,
  Download,
  X,
  Loader2,
  Copy,
  ChevronDown,
  ChevronRight,
  ArrowRightLeft,
  Lock,
} from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { SeletorComBusca } from "@/components/ui/seletor-com-busca"
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
import type {
  Orcamento,
  Funcionario,
  Servico,
  ItemOrcamento,
  Cliente,
  TermoServico,
  ConfiguracaoEmpresa,
  StatusOrcamento,
} from "@/lib/types"
import { FirebaseService } from "@/lib/firebase-service"
import { formatCurrency, matchesSearch, round2, toFixed2 } from "@/lib/utils"
import { getServiceCategoryName } from "@/lib/service-categories"
import { ListToolbar } from "@/components/ui/list-toolbar"
import { useSearchQuery } from "@/hooks/use-search-query"
import { useConfiguracao } from "@/hooks/use-configuracao"
import { usePermissoes } from "@/hooks/use-permissoes"
import {
  FASES_ORCAMENTO,
  getFase,
  nomeDaVersao,
  normalizarFase,
  podeCriarRevisao,
  podeEditar,
} from "@/lib/orcamento-fases"
import { CONFIGURACAO_PADRAO, corDeTexto } from "@/lib/brand"

/** Documento gerado: venda (cliente) ou custo (interno). */
type TipoDocumento = "venda" | "custo"

interface OrcamentoFormState {
  /** Numero da proposta, editavel para corrigir sequencias. */
  numero: string
  clienteId: string
  cliente: Orcamento["cliente"]
  dataOrcamento: string
  dataValidade: string
  funcionariosSelecionados: string[]
  servicosSelecionados: string[]
  itens: ItemOrcamento[]
  /** Comodos do orcamento, pela ordem de apresentacao. */
  ambientes: string[]
  margemLucro: number
  /** Custo de transporte: linha propria no final do orcamento. */
  transporte: number
  /** Taxa de IVA (%) aplicada sobre a base tributavel. */
  taxaIVA: number
  observacoes: string
}

/** Taxas de IVA em Portugal (continente). */
const TAXAS_IVA = [
  { valor: 23, label: "23% - Taxa normal" },
  { valor: 13, label: "13% - Taxa intermedia" },
  { valor: 6, label: "6% - Taxa reduzida (ex.: obras em habitacao)" },
  { valor: 0, label: "0% - Isento / autoliquidacao" },
]

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
    numero: "",
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
    ambientes: [],
    margemLucro: 20,
    transporte: 0,
    taxaIVA: 23,
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

/** Item sem comodo definido cai neste grupo. */
const SEM_AMBIENTE = "Sem comodo"

/**
 * Agrupa os itens por comodo, respeitando a ordem definida no orcamento.
 * Devolve tambem o subtotal de cada grupo, como no formato usado em obra
 * (1 Sala, 1.1, 1.2 ... com o total da divisao no cabecalho).
 */
function agruparPorAmbiente(itens: ItemOrcamento[], ambientes: string[] = []) {
  const grupos = new Map<string, ItemOrcamento[]>()

  for (const nome of ambientes) grupos.set(nome, [])
  for (const item of itens) {
    const chave = item.ambiente?.trim() || SEM_AMBIENTE
    if (!grupos.has(chave)) grupos.set(chave, [])
    grupos.get(chave)!.push(item)
  }

  return Array.from(grupos.entries())
    .filter(([, lista]) => lista.length > 0)
    .map(([nome, lista]) => ({
      nome,
      itens: lista,
      subtotal: round2(lista.reduce((acc, item) => acc + (Number(item.total) || 0), 0)),
    }))
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

/**
 * Base tributavel: subtotal + margem + transporte. E sobre este valor que
 * incide o IVA, e e este o valor comparado com o custo para apurar o lucro
 * (o IVA nao e receita, e cobrado para o Estado).
 */
function calculateBaseTributavel(subtotal: number, margemLucro: number, transporte = 0): number {
  return round2(subtotal * (1 + (Number(margemLucro) || 0) / 100) + (Number(transporte) || 0))
}

function calculateIVA(baseTributavel: number, taxaIVA = 0): number {
  return round2(baseTributavel * ((Number(taxaIVA) || 0) / 100))
}

/** Total final que o cliente paga: base tributavel + IVA. */
function calculateTotal(subtotal: number, margemLucro: number, transporte = 0, taxaIVA = 0): number {
  const base = calculateBaseTributavel(subtotal, margemLucro, transporte)
  return round2(base + calculateIVA(base, taxaIVA))
}

/** Total de custo: custo real dos itens + transporte, sem margem. */
function calculateTotalCusto(subtotalCusto: number, transporte = 0): number {
  return round2(subtotalCusto + (Number(transporte) || 0))
}

/**
 * Preco unitario do servico. Na composicao por quantidade de referencia tudo
 * (incluindo transporte e aluguer) ja esta diluido no preco por unidade, entao
 * basta multiplicar pela quantidade do orcamento.
 *
 * Servicos ainda no formato antigo tinham o transporte somado ao preco: nesse
 * caso ele e retirado, para nao ser cobrado duas vezes com a linha de transporte
 * do orcamento.
 */
function getServicoPrecos(servico: Servico) {
  const temComposicao = Boolean(servico.composicao)
  if (temComposicao) {
    return { precoVariavel: round2(servico.preco ?? 0), precoFixo: 0, transporte: 0 }
  }

  const transporte = round2(servico.transporte ?? 0)
  const temSplit = servico.precoVariavel !== undefined || servico.precoFixo !== undefined

  return {
    precoVariavel: temSplit ? round2(servico.precoVariavel ?? 0) : round2(Number(servico.preco ?? 0) - transporte),
    precoFixo: temSplit ? round2(servico.precoFixo ?? 0) : 0,
    transporte,
  }
}


/**
 * Cor de cada comodo, atribuida pela ordem em que aparece.
 * Serve para distinguir as seccoes de relance, sobretudo no tema escuro.
 * A lista repete-se se houver mais comodos do que cores.
 */
const CORES_AMBIENTE = [
  { cabecalho: "bg-sky-500/15 text-sky-700 dark:text-sky-300", barra: "border-l-sky-500" },
  { cabecalho: "bg-violet-500/15 text-violet-700 dark:text-violet-300", barra: "border-l-violet-500" },
  { cabecalho: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300", barra: "border-l-emerald-500" },
  { cabecalho: "bg-amber-500/15 text-amber-700 dark:text-amber-300", barra: "border-l-amber-500" },
  { cabecalho: "bg-rose-500/15 text-rose-700 dark:text-rose-300", barra: "border-l-rose-500" },
  { cabecalho: "bg-teal-500/15 text-teal-700 dark:text-teal-300", barra: "border-l-teal-500" },
]

function getCorAmbiente(indice: number) {
  return CORES_AMBIENTE[indice % CORES_AMBIENTE.length]
}

/** Cor de fundo e borda por tipo de item, para distinguir a olho na lista. */
function getItemEstilo(tipo: ItemOrcamento["tipo"]) {
  switch (tipo) {
    case "mao_obra":
      return {
        card: "border-l-4 border-l-blue-500 bg-blue-500/10",
        badge: "bg-blue-500/20 text-blue-600 dark:text-blue-300 border-blue-500/40",
        label: "Mao de obra",
      }
    case "material":
      return {
        card: "border-l-4 border-l-amber-500 bg-amber-500/10",
        badge: "bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/40",
        label: "Material",
      }
    default:
      return {
        card: "border-l-4 border-l-emerald-500 bg-emerald-500/10",
        badge: "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/40",
        label: "Servico",
      }
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
  return getFase(status).nome
}

function buildOrcamentoDocumentHtml(
  orcamento: Orcamento,
  termos: TermoServico[],
  tipo: TipoDocumento = "venda",
  config?: ConfiguracaoEmpresa,
): string {
  const isCusto = tipo === "custo"
  const itens = orcamento.itens || []

  const subtotal = round2(orcamento.subtotal || 0)
  const subtotalCusto = round2(orcamento.subtotalCusto ?? calculateSubtotalCusto(itens))
  const transporte = round2(orcamento.transporte || 0)
  const margem = round2(orcamento.margemLucro || 0)
  const margemValor = round2((subtotal * margem) / 100)
  const totalVenda = round2(orcamento.valorTotal || 0)
  const taxaIVA = round2(orcamento.taxaIVA ?? 0)
  // Orcamentos antigos nao tinham IVA: nesse caso o total ja e a propria base
  const baseTributavel = round2(orcamento.baseTributavel ?? totalVenda - (orcamento.valorIVA ?? 0))
  const valorIVA = round2(orcamento.valorIVA ?? 0)
  const totalCusto = round2(orcamento.valorTotalCusto ?? calculateTotalCusto(subtotalCusto, transporte))
  const total = isCusto ? totalCusto : totalVenda

  const termosAtivos = termos.filter((item) => item.ativo)
  const grouped = {
    termos: termosAtivos.filter((item) => item.tipo === "termos"),
    regras: termosAtivos.filter((item) => item.tipo === "regras"),
    condicoes: termosAtivos.filter((item) => item.tipo === "condicoes"),
  }

  /**
   * No documento de venda a margem e o transporte nao aparecem como linhas
   * separadas: sao diluidos no preco de cada item, para o cliente ver apenas
   * o valor final e as linhas somarem exatamente a base tributavel.
   */
  const fatorVenda = !isCusto && subtotal > 0 ? baseTributavel / subtotal : 1
  const totaisVenda = itens.map((item) =>
    round2(calculateItemTotal(item.quantidade, item.precoUnitario, item.valorFixo) * fatorVenda),
  )
  // O arredondamento por item pode desviar alguns centimos: o ultimo item absorve a diferenca
  if (!isCusto && totaisVenda.length > 0) {
    const somaAjustada = round2(totaisVenda.reduce((acc, valor) => acc + valor, 0))
    totaisVenda[totaisVenda.length - 1] = round2(
      totaisVenda[totaisVenda.length - 1] + (baseTributavel - somaAjustada),
    )
  }

  // Numeracao hierarquica por comodo: 1 Sala / 1.1, 1.2 ... como nas propostas de obra
  const gruposDocumento = agruparPorAmbiente(itens, orcamento.ambientes)
  const temAmbientes = gruposDocumento.length > 1 || gruposDocumento[0]?.nome !== SEM_AMBIENTE
  const indicePorItem = new Map(itens.map((item, indice) => [item.id, indice]))

  const itensRows = gruposDocumento
    .map((grupo, indiceGrupo) => {
      // Subtotal do comodo ja com a margem diluida, para bater com o total do documento
      const subtotalGrupo = grupo.itens.reduce((acc, item) => {
        const indice = indicePorItem.get(item.id) ?? 0
        return acc + (isCusto
          ? calculateItemTotal(item.quantidade, item.custoUnitario ?? item.precoUnitario, item.valorFixo)
          : totaisVenda[indice])
      }, 0)

      const cabecalho = temAmbientes
        ? `
        <tr class="grupo">
          <td>${indiceGrupo + 1}</td>
          <td colspan="4">${escapeHtml(grupo.nome)}</td>
          <td style="text-align:right">${formatCurrency(round2(subtotalGrupo))}</td>
        </tr>`
        : ""

      const linhas = grupo.itens
        .map((item, indiceItem) => {
          const indice = indicePorItem.get(item.id) ?? 0
          const nome = getItemDescricaoDocumento(item, tipo)
          const detalhe = item.nome && item.descricao && item.descricao !== item.nome ? item.descricao : ""
          const totalItem = isCusto
            ? calculateItemTotal(item.quantidade, item.custoUnitario ?? item.precoUnitario, item.valorFixo)
            : totaisVenda[indice]
          const precoUnitario =
            item.valorFixo || !item.quantidade ? totalItem : round2(totalItem / Number(item.quantidade))
          const quantidadeLabel = item.valorFixo ? "Valor fixo" : toFixed2(item.quantidade)
          const numero = temAmbientes ? `${indiceGrupo + 1}.${indiceItem + 1}` : String(indice + 1)

          return `
        <tr>
          <td style="text-align:center; color:#64748b">${numero}</td>
          <td>${escapeHtml(detalhe || nome)}</td>
          <td style="text-align:center">${escapeHtml(item.valorFixo ? "-" : item.unidade)}</td>
          <td style="text-align:right">${quantidadeLabel}</td>
          <td style="text-align:right">${formatCurrency(precoUnitario)}</td>
          <td style="text-align:right">${formatCurrency(totalItem)}</td>
        </tr>`
        })
        .join("")

      return cabecalho + linhas
    })
    .join("")

  const marca = { ...CONFIGURACAO_PADRAO, ...(config || {}) }
  const corPrimaria = marca.corPrimaria
  const corEscura = marca.corEscura
  const textoPrimaria = corDeTexto(corPrimaria)

  const renderTermSection = (title: string, items: TermoServico[]) => {
    if (items.length === 0) return ""
    const content = items
      .map(
        (item) => `
          <div class="termo">
            <strong>${escapeHtml(item.titulo)}</strong>
            <div>${escapeHtml(item.conteudo)}</div>
          </div>
        `,
      )
      .join("")
    return `<section><h3>${title}</h3>${content}</section>`
  }

  /**
   * Cabecalho das condicoes gerais, no formato do documento oficial da empresa:
   * titulo a esquerda, logotipo a direita e os dados fiscais em duas colunas.
   */
  const cabecalhoCondicoes = `
    <div class="condicoes-topo">
      <div class="condicoes-titulo">Condicoes gerais da ${escapeHtml(marca.nome)}</div>
    </div>
    <div class="condicoes-dados">
      <div>
        ${marca.razaoSocial ? `<div><strong>${escapeHtml(marca.razaoSocial)}</strong></div>` : ""}
        ${marca.morada ? `<div>${escapeHtml(marca.morada)}</div>` : ""}
        ${
          marca.codigoPostal || marca.cidade
            ? `<div>${escapeHtml([marca.codigoPostal, marca.cidade].filter(Boolean).join(" "))}</div>`
            : ""
        }
        ${marca.nif ? `<div>Contribuinte n.o ${escapeHtml(marca.nif)}</div>` : ""}
        ${marca.capitalSocial ? `<div>Capital Social ${escapeHtml(marca.capitalSocial)}</div>` : ""}
      </div>
      <div style="text-align:right">
        ${marca.telefone ? `<div>Tel: ${escapeHtml(marca.telefone)}</div>` : ""}
        ${marca.email ? `<div>E-mail: ${escapeHtml(marca.email)}</div>` : ""}
        ${marca.website ? `<div>Homepage: ${escapeHtml(marca.website)}</div>` : ""}
      </div>
    </div>
    <div class="barra"></div>
  `

  const termosHtml =
    termosAtivos.length > 0
      ? `
    <section class="termos">
      ${cabecalhoCondicoes}
      ${renderTermSection("1. Inclusoes", grouped.termos)}
      ${renderTermSection("2. Exclusoes", grouped.regras)}
      ${renderTermSection("3. Condicoes gerais", grouped.condicoes)}
    </section>
  `
      : ""


  const notas = (marca.notasOrcamento || []).filter((nota) => nota.trim())
  const notasHtml = notas.length
    ? `
      <section class="notas">
        <div class="notas-titulo">Notas</div>
        <ol>
          ${notas.map((nota) => `<li>${escapeHtml(nota)}</li>`).join("")}
        </ol>
      </section>`
    : ""

  return `
  <!doctype html>
  <html lang="pt">
    <head>
      <meta charset="utf-8" />
      <title>${escapeHtml(marca.nome)} - Proposta ${isCusto ? "CUSTO " : ""}${escapeHtml(orcamento.numero)}</title>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link href="https://fonts.googleapis.com/css2?family=${encodeURIComponent(
        marca.fonte || "Montserrat",
      )}:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      <style>
        /* Sem isto o navegador imprime os fundos a branco */
        * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; box-sizing: border-box; }
        /* Margem a zero: e no espaco da margem que o navegador desenha a data,
           o titulo e o "about:blank". Sem margem, nao ha onde os desenhar.
           O espacamento real da folha passa a ser o padding do body. */
        @page { size: A4; margin: 0; }

        body {
          font-family: '${marca.fonte || "Montserrat"}', Arial, sans-serif;
          margin: 0;
          padding: 0 10mm;
          color: #111827;
          font-size: 12px;
        }
        h1, h2, h3 { margin: 0; }

        /* Moldura que garante margem no topo e no fundo de cada pagina.
           O thead de uma tabela repete-se em todas as paginas impressas, o que
           nao acontece com o padding do body. */
        table.moldura { width: 100%; border-collapse: collapse; }
        table.moldura > thead > tr > td,
        table.moldura > tfoot > tr > td,
        table.moldura > tbody > tr > td { border: none; padding: 0; background: none; }
        /* Faixa de marca e rodape: vivem no thead/tfoot da moldura, por isso
           repetem-se no topo e no fundo de todas as paginas impressas. */
        .faixa-marca {
          display: flex; justify-content: flex-end; align-items: center;
          height: 16mm; padding-bottom: 4mm;
        }
        .logo-faixa { max-height: 11mm; max-width: 52mm; object-fit: contain; }
        .nome-faixa { font-size: 13px; font-weight: 800; color: ${corEscura}; }
        .muted { color: #6b7280; }

        /* Cabecalho */
        .topo { display: block; }
        .topo-dados { line-height: 1.5; }
        .topo-dados .ref { font-size: 17px; font-weight: 800; letter-spacing: .3px; }
        .logo { max-height: 58px; max-width: 230px; object-fit: contain; }
        .empresa { text-align: right; font-size: 10px; color: #4b5563; line-height: 1.5; }
        .empresa .nome { font-size: 13px; font-weight: 700; color: #111827; }
        .barra { height: 4px; background: ${corPrimaria}; margin: 10px 0 14px; border-radius: 2px; }

        .selo {
          display: inline-block; padding: 2px 10px; border-radius: 999px;
          font-size: 10px; font-weight: 700; letter-spacing: .4px;
        }
        .selo-venda { background: #dcfce7; color: #166534; }
        .selo-custo { background: #fee2e2; color: #991b1b; }

        /* Tabela */
        table { width: 100%; border-collapse: collapse; margin-top: 12px; }
        th, td { border: 1px solid #d1d5db; padding: 6px 8px; font-size: 11px; vertical-align: middle; }
        thead th {
          background: ${corEscura}; color: #fff; text-align: left;
          font-size: 10px; text-transform: uppercase; letter-spacing: .4px;
        }
        thead { display: table-header-group; }
        tr { page-break-inside: avoid; }
        tr.grupo td {
          background: ${corPrimaria} !important; color: ${textoPrimaria} !important;
          font-weight: 700; font-size: 11px;
        }
        tr.grupo td:first-child, tr.grupo td:last-child { text-align: center; }
        tr.grupo td:last-child { text-align: right; }
        tbody tr:nth-child(even):not(.grupo) td { background: #f9fafb; }

        /* Totais */
        .totais { margin-top: 14px; margin-left: auto; width: 320px; font-size: 12px; }
        .totais div { display: flex; justify-content: space-between; padding: 3px 0; }
        .total-final {
          font-weight: 800; font-size: 15px; border-top: 2px solid ${corEscura};
          padding-top: 6px !important; margin-top: 4px;
        }

        /* Blocos de texto */
        section { page-break-inside: avoid; }
        .observacoes { margin-top: 18px; font-size: 11px; line-height: 1.6; }
        .notas { margin-top: 18px; border: 1px solid #d1d5db; border-radius: 6px; padding: 10px 12px; }
        .notas-titulo {
          font-size: 10px; font-weight: 700; text-transform: uppercase;
          letter-spacing: .5px; color: ${corPrimaria};
        }
        .notas ol { margin: 6px 0 0; padding-left: 18px; font-size: 10px; line-height: 1.6; color: #374151; }
        /* Pagina das condicoes gerais, no formato do documento oficial */
        .termos { margin-top: 18px; padding-top: 4px; }
        .condicoes-topo { display: flex; justify-content: space-between; align-items: center; gap: 20px; }
        .condicoes-titulo { font-size: 16px; font-weight: 800; color: ${corEscura}; }
        .condicoes-dados {
          display: flex; justify-content: space-between; gap: 20px;
          margin-top: 6px; font-size: 9px; color: #4b5563; line-height: 1.5;
        }
        .termos h3 {
          font-size: 12px; margin-top: 16px; color: ${corPrimaria};
          border-bottom: 1px solid #e5e7eb; padding-bottom: 3px;
        }
        .termo { margin-top: 9px; font-size: 10.5px; line-height: 1.55; page-break-inside: avoid; }
        .termo strong { display: block; color: ${corEscura}; margin-bottom: 2px; }

        .rodape {
          height: 10mm; padding-top: 3mm; border-top: 1px solid #e5e7eb;
          display: flex; justify-content: space-between; align-items: flex-start;
          font-size: 8.5px; color: #9ca3af;
        }
      </style>
    </head>
    <body>
      <table class="moldura">
        <thead>
          <tr><td>
            <div class="faixa-marca">
              ${
                marca.logoUrl
                  ? `<img class="logo-faixa" src="${escapeHtml(marca.logoUrl)}" alt="${escapeHtml(marca.nome)}" />`
                  : `<span class="nome-faixa">${escapeHtml(marca.nome)}</span>`
              }
            </div>
          </td></tr>
        </thead>
        <tfoot>
          <tr><td>
            <div class="rodape">
              <span>${escapeHtml(marca.nome)}${marca.website ? ` · ${escapeHtml(marca.website)}` : ""}</span>
              <span>${escapeHtml(marca.prefixoOrcamento || "")}${escapeHtml(orcamento.numero)}${escapeHtml(
                marca.sufixoOrcamento || "",
              )} · emitido em ${new Date().toLocaleDateString("pt-PT")}</span>
            </div>
          </td></tr>
        </tfoot>
        <tbody><tr><td>
      <header class="topo">
        <div class="topo-dados">
          <div class="ref">${escapeHtml(marca.prefixoOrcamento || "")}${escapeHtml(orcamento.numero)}${escapeHtml(marca.sufixoOrcamento || "")}</div>
          <div class="muted">Versao: ${escapeHtml(nomeDaVersao(orcamento.revisao))}</div>
          <div>Cliente: <strong>${escapeHtml(orcamento.cliente.nome)}</strong></div>
          ${
            orcamento.cliente.morada
              ? `<div>Morada: ${escapeHtml(
                  [orcamento.cliente.morada, orcamento.cliente.cidade, orcamento.cliente.codigoPostal]
                    .filter(Boolean)
                    .join(", "),
                )}</div>`
              : ""
          }
          ${orcamento.cliente.nif ? `<div>NIF: ${escapeHtml(orcamento.cliente.nif)}</div>` : ""}
          <div>Responsavel: ${escapeHtml(orcamento.orcamentista)}</div>
          <div class="muted">
            Data: ${new Date(orcamento.dataOrcamento).toLocaleDateString("pt-PT")} &nbsp;·&nbsp;
            Validade: ${new Date(orcamento.dataValidade).toLocaleDateString("pt-PT")}
          </div>
          <div style="margin-top:6px">
            <span class="selo ${isCusto ? "selo-custo" : "selo-venda"}">
              ${isCusto ? "USO INTERNO - NAO ENVIAR AO CLIENTE" : "PROPOSTA"}
            </span>
          </div>
        </div>

      </header>

      <div class="barra"></div>

      <table>
        <thead>
          <tr>
            <th style="width:46px; text-align:center">Item</th>
            <th>Descricao</th>
            <th style="width:44px; text-align:center">UN</th>
            <th style="width:62px; text-align:right">Qtd.</th>
            <th style="width:86px; text-align:right">Valor unitario</th>
            <th style="width:92px; text-align:right">Valor total</th>
          </tr>
        </thead>
        <tbody>
          ${itensRows}
        </tbody>
      </table>

      <section class="totais">
        ${
          isCusto
            ? `
          <div><span>Subtotal (custo real):</span><span>${formatCurrency(subtotalCusto)}</span></div>
          <div><span>Transporte:</span><span>${formatCurrency(transporte)}</span></div>
          <div class="total-final"><span>Total de custo:</span><span>${formatCurrency(totalCusto)}</span></div>
          <div style="margin-top:8px"><span>Subtotal de venda:</span><span>${formatCurrency(subtotal)}</span></div>
          <div><span>Margem (${toFixed2(margem)}%):</span><span>${formatCurrency(margemValor)}</span></div>
          <div><span>Venda sem IVA (base):</span><span>${formatCurrency(baseTributavel)}</span></div>
          <div><span>IVA (${toFixed2(taxaIVA)}%) a entregar:</span><span>${formatCurrency(valorIVA)}</span></div>
          <div><span>Total cobrado ao cliente:</span><span>${formatCurrency(totalVenda)}</span></div>
        `
            : `
          <div><span>Subtotal:</span><span>${formatCurrency(baseTributavel)}</span></div>
          <div><span>IVA (${toFixed2(taxaIVA)}%):</span><span>${formatCurrency(valorIVA)}</span></div>
          <div class="total-final"><span>Total a pagar:</span><span>${formatCurrency(totalVenda)}</span></div>
        `
        }
      </section>

      ${
        orcamento.observacoes?.trim()
          ? `<section class="observacoes"><strong>Observacoes</strong><div>${escapeHtml(
              orcamento.observacoes.trim(),
            )}</div></section>`
          : ""
      }

      ${isCusto ? "" : notasHtml}
      ${isCusto ? "" : termosHtml}

        </td></tr></tbody>
      </table>
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
  const { configuracao } = useConfiguracao()
  const { pode } = usePermissoes()
  const [statusFilter, setStatusFilter] = useState("all")
  const [generatingDocId, setGeneratingDocId] = useState<string | null>(null)

  const [servicoForm, setServicoForm] = useState<ServicoFormState>(getDefaultServicoForm())
  const [maoObraForm, setMaoObraForm] = useState<MaoObraFormState>(getDefaultMaoObraForm())
  const [formData, setFormData] = useState<OrcamentoFormState>(getDefaultFormData())

  // Duplicar mao de obra: item de origem + funcionario escolhido para a copia
  // Comodo em que os proximos itens serao lancados
  const [ambienteAtual, setAmbienteAtual] = useState("")
  const [novoAmbiente, setNovoAmbiente] = useState("")
  /** Comodos recolhidos, para nao ter de rolar tanto em orcamentos grandes. */
  const [ambientesRecolhidos, setAmbientesRecolhidos] = useState<string[]>([])

  const [duplicandoItem, setDuplicandoItem] = useState<ItemOrcamento | null>(null)
  const [duplicarFuncionarioId, setDuplicarFuncionarioId] = useState("")
  const [duplicarAmbienteDestino, setDuplicarAmbienteDestino] = useState("")

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
      filtered = filtered.filter((orcamento) => normalizarFase(orcamento.status) === statusFilter)
    }

    return filtered
  }, [orcamentos, searchTerm, statusFilter])

  /**
   * Numeracao no formato das propostas de obra: 26/0001 (o prefixo da empresa,
   * por exemplo "CO", e acrescentado na impressao).
   *
   * O contador olha para o maior numero ja existente no ano, para nao repetir
   * quando um orcamento e apagado.
   */
  const generateOrcamentoNumber = () => {
    const ano = String(new Date().getFullYear()).slice(-2)
    const doAno = orcamentos
      .map((item) => item.numero || "")
      .filter((numero) => numero.startsWith(`${ano}/`))
      .map((numero) => Number(numero.split("/")[1]) || 0)

    const proximo = (doAno.length ? Math.max(...doAno) : 0) + 1
    return `${ano}/${String(proximo).padStart(4, "0")}`
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

    // O mesmo servico pode entrar em varios comodos (ex.: pintura na sala e no quarto).
    // So se bloqueia a repeticao dentro do MESMO comodo, onde bastaria somar a quantidade.
    const repetidoNoMesmoAmbiente = formData.itens.some(
      (item) =>
        item.tipo === "servico" &&
        item.servicoId === servicoForm.servicoId &&
        (item.ambiente || "") === (ambienteAtual || ""),
    )
    if (repetidoNoMesmoAmbiente) {
      toast({
        title: "Servico ja consta neste comodo",
        description: ambienteAtual
          ? `Este servico ja esta em "${ambienteAtual}". Escolha outro comodo ou ajuste a quantidade do item existente.`
          : "Este servico ja foi adicionado. Escolha um comodo ou ajuste a quantidade do item existente.",
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
        ambiente: ambienteAtual,
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
        ambiente: ambienteAtual,
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
      ambiente: ambienteAtual,
      tipo: "mao_obra",
      funcionarioId: funcionario.id,
      funcionarioNome: funcionario.nome,
      funcionarioFuncao: funcionario.funcao,
    }
  }

  /**
   * Duplica um item para outro comodo (ou para o mesmo).
   * Em mao de obra pode-se ainda trocar o funcionario, recalculando o valor/hora.
   */
  const handleDuplicarItem = () => {
    if (!duplicandoItem) return

    const destino = duplicarAmbienteDestino === "__sem" ? "" : duplicarAmbienteDestino
    let novoItem: ItemOrcamento

    if (duplicandoItem.tipo === "mao_obra") {
      const funcionario = funcionarios.find((item) => item.id === duplicarFuncionarioId)
      if (!funcionario) {
        toast({
          title: "Selecione um funcionario",
          description: "Escolha o funcionario que vai receber a copia da mao de obra.",
          variant: "destructive",
        })
        return
      }
      novoItem = { ...buildMaoObraItem(funcionario, duplicandoItem.quantidade, duplicandoItem.unidade), ambiente: destino }
    } else {
      novoItem = {
        ...duplicandoItem,
        id: `${duplicandoItem.tipo}-copia-${Date.now()}-${Math.round(Math.random() * 1000)}`,
        ambiente: destino,
      }
    }

    setFormData({
      ...formData,
      itens: [...formData.itens, novoItem],
      funcionariosSelecionados: novoItem.funcionarioId
        ? [...new Set([...formData.funcionariosSelecionados, novoItem.funcionarioId])]
        : formData.funcionariosSelecionados,
    })

    toast({
      title: "Item duplicado",
      description: destino ? `Copia criada em "${destino}".` : "Copia criada sem comodo.",
    })

    setDuplicandoItem(null)
    setDuplicarFuncionarioId("")
    setDuplicarAmbienteDestino("")
  }

  /** Renomeia um comodo e leva junto todos os itens que estavam nele. */
  const renomearAmbiente = (antigo: string, novo: string) => {
    setFormData((prev) => ({
      ...prev,
      ambientes: prev.ambientes.map((nome) => (nome === antigo ? novo : nome)),
      itens: prev.itens.map((item) => (item.ambiente === antigo ? { ...item, ambiente: novo } : item)),
    }))
    setAmbienteAtual((atual) => (atual === antigo ? novo : atual))
  }

  /**
   * Duplica um comodo inteiro com todos os seus itens.
   * Util quando o Quarto 02 leva os mesmos trabalhos do Quarto 01.
   */
  const duplicarAmbiente = (nome: string) => {
    const itensOrigem = formData.itens.filter((item) => (item.ambiente || "") === (nome === SEM_AMBIENTE ? "" : nome))
    if (itensOrigem.length === 0) return

    // Encontra um nome livre: "Quarto 01" -> "Quarto 01 (copia)" -> "... (copia 2)"
    let destino = `${nome} (copia)`
    let sufixo = 2
    while (formData.ambientes.includes(destino)) {
      destino = `${nome} (copia ${sufixo})`
      sufixo++
    }

    const carimbo = Date.now()
    const copias = itensOrigem.map((item, indice) => ({
      ...item,
      id: `${item.tipo}-copia-${carimbo}-${indice}`,
      ambiente: destino,
    }))

    setFormData({
      ...formData,
      ambientes: [...formData.ambientes, destino],
      itens: [...formData.itens, ...copias],
    })
    setAmbienteAtual(destino)

    toast({
      title: "Comodo duplicado",
      description: `${copias.length} item(s) copiados para "${destino}".`,
    })
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

  // --- Comodos (Sala, Cozinha, Quarto...): agrupam os itens no documento

  const adicionarAmbiente = () => {
    const nome = novoAmbiente.trim()
    if (!nome) return
    if (formData.ambientes.some((item) => item.toLowerCase() === nome.toLowerCase())) {
      toast({ title: "Comodo ja existe", description: `"${nome}" ja esta na lista.`, variant: "destructive" })
      return
    }
    setFormData({ ...formData, ambientes: [...formData.ambientes, nome] })
    setNovoAmbiente("")
    if (!ambienteAtual) setAmbienteAtual(nome)
  }

  const removerAmbiente = (nome: string) => {
    setFormData({
      ...formData,
      ambientes: formData.ambientes.filter((item) => item !== nome),
      // Os itens do comodo removido ficam sem comodo, nao se perdem
      itens: formData.itens.map((item) => (item.ambiente === nome ? { ...item, ambiente: "" } : item)),
    })
    if (ambienteAtual === nome) setAmbienteAtual("")
  }

  const alternarAmbiente = (nome: string) => {
    setAmbientesRecolhidos((atual) =>
      atual.includes(nome) ? atual.filter((item) => item !== nome) : [...atual, nome],
    )
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
    const baseTributavel = calculateBaseTributavel(subtotal, formData.margemLucro, transporte)
    const taxaIVA = round2(formData.taxaIVA)
    const valorIVA = calculateIVA(baseTributavel, taxaIVA)
    const valorTotal = round2(baseTributavel + valorIVA)
    const valorTotalCusto = calculateTotalCusto(subtotalCusto, transporte)

    setLoading(true)
    try {
      const clienteId = await resolveCliente()
      const dataOrcamento = new Date(formData.dataOrcamento)
      const dataValidade = new Date(formData.dataValidade)

      const orcamentoData: Omit<Orcamento, "id"> = {
        numero: formData.numero.trim() || editingOrcamento?.numero || generateOrcamentoNumber(),
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
        ambientes: formData.ambientes,
        funcionariosSelecionados: formData.funcionariosSelecionados,
        servicosSelecionados: formData.servicosSelecionados,
        subtotal,
        subtotalCusto,
        transporte,
        impostos: valorIVA,
        margemLucro: round2(formData.margemLucro),
        baseTributavel,
        taxaIVA,
        valorIVA,
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
      numero: orcamento.numero || "",
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
      ambientes: orcamento.ambientes || [],
      margemLucro: orcamento.margemLucro || 0,
      transporte: round2(orcamento.transporte || 0),
      // Orcamentos criados antes do campo de IVA ficam com 0 para nao alterar o total ja acordado
      taxaIVA: round2(orcamento.taxaIVA ?? 0),
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

  /** A permissao necessaria depende da transicao pretendida. */
  const podeMudarPara = (destino: StatusOrcamento) => {
    if (destino === "cancelado") return pode("orcamentos.cancelar")
    if (destino === "emitido") return pode("orcamentos.aprovar")
    if (destino === "em_revisao") return pode("orcamentos.submeter")
    // Devolver a rascunho e reabrir sao actos de quem aprova
    return pode("orcamentos.aprovar") || pode("orcamentos.editar")
  }

  // --- Fases da proposta

  /** Muda a fase, registando quem mudou e quando. */
  const mudarFase = async (orcamento: Orcamento, novaFase: StatusOrcamento, motivo?: string) => {
    if (!user || !orcamento.id) return

    const registo = {
      estado: novaFase,
      data: new Date(),
      utilizador: user.email || user.uid,
      ...(motivo ? { nota: motivo } : {}),
    }

    const alteracoes: Partial<Orcamento> = {
      status: novaFase,
      historicoFases: [...(orcamento.historicoFases || []), registo],
      updatedAt: new Date(),
    }

    // Emitir congela a versao: guarda-se a data e fixa-se o numero base
    if (novaFase === "emitido" && !orcamento.dataEmissao) {
      alteracoes.dataEmissao = new Date()
      alteracoes.revisao = orcamento.revisao ?? 0
      alteracoes.numeroBase = orcamento.numeroBase || orcamento.numero
    }
    if (novaFase === "cancelado" && motivo) alteracoes.motivoPerda = motivo

    try {
      await FirebaseService.updateOrcamento(orcamento.id, alteracoes)
      toast({
        title: `Proposta em ${getFase(novaFase).nome}`,
        description: getFase(novaFase).descricao,
      })
      await loadData()
    } catch (error) {
      toast({ title: "Erro ao mudar de fase", description: "Tente novamente.", variant: "destructive" })
    }
  }

  /**
   * Cria uma revisao a partir de uma proposta emitida.
   *
   * A original fica intacta (e o que o cliente recebeu) e a copia nasce em
   * Rascunho, com o mesmo numero base e a letra da revisao seguinte.
   */
  const criarRevisao = async (orcamento: Orcamento) => {
    if (!user || !orcamento.id) return

    const proximaRevisao = (orcamento.revisao ?? 0) + 1
    const numeroBase = orcamento.numeroBase || orcamento.numero

    if (
      !confirm(
        `Criar a ${nomeDaVersao(proximaRevisao)} desta proposta?

A versao atual fica guardada como foi entregue ao cliente, e a nova abre em Rascunho para poder ser alterada.`,
      )
    )
      return

    try {
      const { id, ...dados } = orcamento
      await FirebaseService.addOrcamento(
        {
          ...dados,
          numero: `${numeroBase}${String.fromCharCode(64 + proximaRevisao)}`,
          numeroBase,
          revisao: proximaRevisao,
          orcamentoOrigemId: orcamento.id,
          status: "rascunho",
          dataEmissao: undefined,
          motivoPerda: "",
          historicoFases: [
            {
              estado: "rascunho" as StatusOrcamento,
              data: new Date(),
              utilizador: user.email || user.uid,
              nota: `Revisao criada a partir de ${orcamento.numero}`,
            },
          ],
          createdAt: new Date(),
          updatedAt: new Date(),
        } as Omit<Orcamento, "id">,
        user.uid,
      )

      toast({
        title: `${nomeDaVersao(proximaRevisao)} criada`,
        description: "A nova versao abriu em Rascunho. A anterior fica como esta.",
      })
      await loadData()
    } catch (error) {
      toast({ title: "Erro ao criar revisao", description: "Tente novamente.", variant: "destructive" })
    }
  }

  const handleOpenDocument = async (orcamento: Orcamento, shouldPrint: boolean, tipo: TipoDocumento) => {
    if (!user) return
    if (!orcamento.id) return

    try {
      setGeneratingDocId(orcamento.id)
      const termos = tipo === "venda" ? await FirebaseService.getTermosServico(user.uid, true) : []
      const html = buildOrcamentoDocumentHtml(orcamento, termos, tipo, configuracao)
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
    // Margem, IVA e validade vem dos padroes definidos em Configuracoes
    const base = getDefaultFormData()
    const hoje = new Date()
    setFormData({
      ...base,
      margemLucro: configuracao.margemPadrao ?? base.margemLucro,
      taxaIVA: configuracao.taxaIVAPadrao ?? base.taxaIVA,
      dataValidade: toDateInput(addDays(hoje, configuracao.validadeDiasPadrao ?? 30)),
    })
    setEditingOrcamento(null)
    setServicoForm(getDefaultServicoForm())
    setMaoObraForm(getDefaultMaoObraForm())
  }

  const subtotalAtual = calculateSubtotal(formData.itens)
  const subtotalCustoAtual = calculateSubtotalCusto(formData.itens)
  const transporteAtual = round2(formData.transporte)
  const baseTributavelAtual = calculateBaseTributavel(subtotalAtual, formData.margemLucro, transporteAtual)
  const valorIVAAtual = calculateIVA(baseTributavelAtual, formData.taxaIVA)
  const valorTotalAtual = round2(baseTributavelAtual + valorIVAAtual)
  const valorTotalCustoAtual = calculateTotalCusto(subtotalCustoAtual, transporteAtual)
  // O IVA nao entra no lucro: e cobrado ao cliente e entregue ao Estado
  const lucroPrevisto = round2(baseTributavelAtual - valorTotalCustoAtual)
  const selectedClientValue =
    formData.clienteId && clientes.some((cliente) => cliente.id === formData.clienteId) ? formData.clienteId : "__novo"

  const getStatusBadge = (status: Orcamento["status"]) => {
    const fase = getFase(status)
    return (
      <Badge variant="outline" className={fase.cor} title={fase.descricao}>
        {fase.nome}
      </Badge>
    )
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

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="numero">Numero da proposta</Label>
                  <Input
                    id="numero"
                    value={formData.numero}
                    onChange={(e) => setFormData({ ...formData, numero: e.target.value })}
                    placeholder={generateOrcamentoNumber()}
                    className="rounded-full"
                  />
                  <p className="text-xs text-muted-foreground">
                    Sai como {configuracao.prefixoOrcamento || ""}
                    {formData.numero || generateOrcamentoNumber()}
                    {configuracao.sufixoOrcamento || ""}. Deixe vazio para numerar automaticamente.
                  </p>
                </div>
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
                <div>
                  <h3 className="text-lg font-medium">Comodos</h3>
                  <p className="text-sm text-muted-foreground">
                    Organize o orcamento por divisao da casa. No documento cada comodo sai como uma seccao com o seu
                    subtotal, e os itens ficam numerados 1.1, 1.2, 2.1...
                  </p>
                </div>

                <Card className="p-4 border-2 border-dashed space-y-3">
                  <div className="flex gap-2">
                    <Input
                      value={novoAmbiente}
                      onChange={(e) => setNovoAmbiente(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault()
                          adicionarAmbiente()
                        }
                      }}
                      placeholder="Ex.: Sala, Hall, Cozinha, Quarto 01, Marquise"
                      className="rounded-full"
                    />
                    <Button type="button" onClick={adicionarAmbiente} className="rounded-full">
                      <Plus className="h-4 w-4 mr-1" />
                      Adicionar
                    </Button>
                  </div>

                  {formData.ambientes.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {formData.ambientes.map((nome) => (
                        <Badge
                          key={nome}
                          variant={ambienteAtual === nome ? "default" : "outline"}
                          className="cursor-pointer gap-1 py-1"
                          onClick={() => setAmbienteAtual(ambienteAtual === nome ? "" : nome)}
                        >
                          {nome}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              removerAmbiente(nome)
                            }}
                            aria-label={`Remover ${nome}`}
                            className="ml-1 opacity-70 hover:opacity-100"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}

                  <p className="text-xs text-muted-foreground">
                    {ambienteAtual
                      ? `Os proximos itens vao para: ${ambienteAtual}. Clique no comodo para trocar.`
                      : "Nenhum comodo selecionado: os proximos itens ficam sem comodo. Clique num comodo para o escolher."}
                  </p>
                </Card>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-medium">Servico no orcamento</h3>
                <Card className="p-4 border-2 border-dashed">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Selecionar servico</Label>
                      <SeletorComBusca
                        valor={servicoForm.servicoId}
                        onChange={handleServicoSelect}
                        placeholder="Escolha um servico"
                        placeholderBusca="Procurar servico..."
                        vazio="Nenhum servico encontrado."
                        className="rounded-full"
                        opcoes={servicos.map((servico) => ({
                          valor: servico.id!,
                          rotulo: servico.nome,
                          detalhe: `${getServiceCategoryName(servico.categoriaId, servico.categoriaNome)} - ${formatCurrency(
                            servico.preco || 0,
                          )} / ${servico.unidade}`,
                        }))}
                      />
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
                <div>
                  <h3 className="text-lg font-medium">Mao de obra avulsa (opcional)</h3>
                  <p className="text-sm text-muted-foreground">
                    A mao de obra normal ja vem dentro do preco do servico, pelo grupo Mao de obra da composicao. Use
                    esta seccao apenas para horas extra que fogem ao padrao do servico.
                  </p>
                </div>
                <Card className="p-4 border-2 border-dashed">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Selecionar funcionario</Label>
                      <SeletorComBusca
                        valor={maoObraForm.funcionarioId}
                        onChange={handleFuncionarioSelect}
                        placeholder="Escolha um funcionario"
                        placeholderBusca="Procurar funcionario..."
                        vazio="Nenhum funcionario encontrado."
                        className="rounded-full"
                        opcoes={funcionarios.map((funcionario) => ({
                          valor: funcionario.id!,
                          rotulo: funcionario.nome,
                          detalhe: `${funcionario.funcao} - ${formatCurrency(funcionario.custoHora)}/hora`,
                        }))}
                      />
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
                  {agruparPorAmbiente(formData.itens, formData.ambientes).map((grupo, indiceGrupo) => {
                  const recolhido = ambientesRecolhidos.includes(grupo.nome)
                  return (
                  <div key={grupo.nome} className="space-y-3">
                    <div
                      className={`flex items-center justify-between gap-2 rounded-md px-3 py-2 ${
                        getCorAmbiente(indiceGrupo).cabecalho
                      }`}
                    >
                      <div className="flex flex-1 items-center gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 shrink-0"
                          title={recolhido ? "Expandir comodo" : "Recolher comodo"}
                          onClick={() => alternarAmbiente(grupo.nome)}
                        >
                          {recolhido ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </Button>
                        <span className="text-sm font-semibold">{indiceGrupo + 1}.</span>
                        {grupo.nome === SEM_AMBIENTE ? (
                          <span className="text-sm font-semibold">{grupo.nome}</span>
                        ) : (
                          <Input
                            value={grupo.nome}
                            onChange={(e) => renomearAmbiente(grupo.nome, e.target.value)}
                            className="h-7 max-w-[240px] border-none bg-transparent px-1 text-sm font-semibold shadow-none focus-visible:bg-background"
                            title="Clique para renomear o comodo"
                          />
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {recolhido && (
                          <span className="text-xs opacity-80">
                            {grupo.itens.length} {grupo.itens.length === 1 ? "item" : "itens"}
                          </span>
                        )}
                        <span className="text-sm font-semibold">{formatCurrency(grupo.subtotal)}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 gap-1 text-xs"
                          title={`Duplicar "${grupo.nome}" com todos os itens`}
                          onClick={() => duplicarAmbiente(grupo.nome)}
                        >
                          <Copy className="h-3 w-3" />
                          Duplicar comodo
                        </Button>
                      </div>
                    </div>
                    {!recolhido && grupo.itens.map((item, indiceItem) => {
                      const indice = formData.itens.indexOf(item)
                      const readOnlyServico = item.tipo === "servico"
                      const custoUnitario = item.custoUnitario ?? item.precoUnitario
                      const estilo = getItemEstilo(item.tipo)
                      return (
                        <div key={item.id} className={`p-4 border rounded-lg ${estilo.card}`}>
                          <div className="flex items-center gap-2 mb-2">
                            <span className="flex h-6 shrink-0 items-center justify-center rounded-full bg-background px-2 text-xs font-semibold">
                              {indiceGrupo + 1}.{indiceItem + 1}
                            </span>
                            <Badge variant="outline" className={`text-xs ${estilo.badge}`}>
                              {estilo.label}
                            </Badge>
                            {formData.ambientes.length > 0 && (
                              <Select
                                value={item.ambiente || "__sem"}
                                onValueChange={(value) =>
                                  handleItemUpdate(item.id, "ambiente", value === "__sem" ? "" : value)
                                }
                              >
                                <SelectTrigger className="h-6 w-auto gap-1 rounded-full border-none bg-background/60 px-2 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__sem">Sem comodo</SelectItem>
                                  {formData.ambientes.map((nome) => (
                                    <SelectItem key={nome} value={nome}>
                                      {nome}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                            <span className="ml-auto text-sm font-semibold">{formatCurrency(item.total)}</span>
                          </div>
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
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                title="Duplicar este item para outro comodo"
                                onClick={() => {
                                  setDuplicandoItem(item)
                                  setDuplicarFuncionarioId(item.funcionarioId || "")
                                  setDuplicarAmbienteDestino(item.ambiente || "__sem")
                                }}
                                className="h-6 w-6"
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
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
                  )
                  })}
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

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="taxaIVA">IVA (%)</Label>
                    <Select
                      value={TAXAS_IVA.some((t) => t.valor === formData.taxaIVA) ? String(formData.taxaIVA) : "outra"}
                      onValueChange={(value) => {
                        if (value === "outra") return
                        setFormData({ ...formData, taxaIVA: Number(value) })
                      }}
                    >
                      <SelectTrigger className="rounded-full">
                        <SelectValue placeholder="Selecione a taxa" />
                      </SelectTrigger>
                      <SelectContent>
                        {TAXAS_IVA.map((taxa) => (
                          <SelectItem key={taxa.valor} value={String(taxa.valor)}>
                            {taxa.label}
                          </SelectItem>
                        ))}
                        <SelectItem value="outra">Outra taxa (indicar ao lado)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="taxaIVAValor">Taxa aplicada (%)</Label>
                    <Input
                      id="taxaIVAValor"
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={formData.taxaIVA}
                      onChange={(e) =>
                        setFormData({ ...formData, taxaIVA: round2(Number.parseFloat(e.target.value) || 0) })
                      }
                      className="rounded-full"
                    />
                    <p className="text-xs text-muted-foreground">
                      Incide sobre subtotal + margem + transporte. Nao entra no lucro: e cobrado ao cliente e entregue
                      ao Estado.
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
                      <div className="flex justify-between border-t pt-1">
                        <span>Base tributavel:</span>
                        <span>{formatCurrency(baseTributavelAtual)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>IVA ({toFixed2(formData.taxaIVA)}%):</span>
                        <span>{formatCurrency(valorIVAAtual)}</span>
                      </div>
                      <div className="flex justify-between font-medium border-t pt-1">
                        <span>Total com IVA:</span>
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
                      <p className="text-xs text-muted-foreground pt-1">
                        Lucro = base tributavel ({formatCurrency(baseTributavelAtual)}) - custo, sem o IVA.
                      </p>
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

            {/* Duplicar item: escolhe o comodo de destino e, na mao de obra, o funcionario */}
            <Dialog
              open={!!duplicandoItem}
              onOpenChange={(open) => {
                if (!open) {
                  setDuplicandoItem(null)
                  setDuplicarFuncionarioId("")
                  setDuplicarAmbienteDestino("")
                }
              }}
            >
              <DialogContent className="sm:max-w-[480px]">
                <DialogHeader>
                  <DialogTitle>Duplicar item</DialogTitle>
                  <DialogDescription>
                    Copia &quot;{duplicandoItem?.nome || duplicandoItem?.descricao}&quot; ({
                      toFixed2(duplicandoItem?.quantidade || 0)
                    }{" "}
                    {duplicandoItem?.unidade}) para outro comodo. Util quando o Quarto 02 leva os mesmos trabalhos do
                    Quarto 01.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Comodo de destino</Label>
                    <Select value={duplicarAmbienteDestino} onValueChange={setDuplicarAmbienteDestino}>
                      <SelectTrigger className="rounded-full">
                        <SelectValue placeholder="Escolha o comodo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__sem">Sem comodo</SelectItem>
                        {formData.ambientes.map((nome) => (
                          <SelectItem key={nome} value={nome}>
                            {nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {duplicandoItem?.tipo === "mao_obra" && (
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
                  )}
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setDuplicandoItem(null)}>
                    Cancelar
                  </Button>
                  <Button type="button" onClick={handleDuplicarItem} className="rounded-full">
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
            {FASES_ORCAMENTO.map((fase) => (
              <SelectItem key={fase.id} value={fase.id}>
                {fase.nome}
              </SelectItem>
            ))}
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
                    {(orcamento.revisao ?? 0) > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        {nomeDaVersao(orcamento.revisao)}
                      </Badge>
                    )}
                  </CardTitle>
                  <CardDescription>
                    {orcamento.cliente.nome}
                    {orcamento.dataEmissao && (
                      <> · emitida em {new Date(orcamento.dataEmissao).toLocaleDateString("pt-PT")}</>
                    )}
                  </CardDescription>
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
                  {orcamento.motivoPerda && (
                    <p className="text-destructive">Motivo: {orcamento.motivoPerda}</p>
                  )}
                  {pode("orcamentos.verCusto") && (
                  <p>
                    Custo:{" "}
                    {formatCurrency(
                      orcamento.valorTotalCusto ??
                        calculateTotalCusto(calculateSubtotalCusto(orcamento.itens || []), orcamento.transporte),
                    )}
                    {orcamento.transporte ? ` | Transporte: ${formatCurrency(orcamento.transporte)}` : ""}
                  </p>
                  )}
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
                      {pode("orcamentos.verCusto") && (
                      <>
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
                      </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  {/* Mudar de fase: so aparecem as transicoes permitidas */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="icon" className="rounded-full" title="Mudar de fase">
                        <ArrowRightLeft className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>
                        Fase atual: {getFase(orcamento.status).nome}
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {getFase(orcamento.status).seguintes.filter(podeMudarPara).map((proxima) => (
                        <DropdownMenuItem
                          key={proxima}
                          onClick={() => {
                            if (proxima === "cancelado") {
                              const motivo = window.prompt(
                                "Motivo do cancelamento (fica registado para analise):",
                              )
                              if (motivo === null) return
                              void mudarFase(orcamento, proxima, motivo.trim() || "Nao indicado")
                              return
                            }
                            void mudarFase(orcamento, proxima)
                          }}
                        >
                          {getFase(proxima).nome}
                        </DropdownMenuItem>
                      ))}
                      {podeCriarRevisao(orcamento.status) && pode("orcamentos.criar") && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => void criarRevisao(orcamento)}>
                            <Copy className="h-4 w-4 mr-2" />
                            Criar {nomeDaVersao((orcamento.revisao ?? 0) + 1)}
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handleEdit(orcamento)}
                    disabled={!podeEditar(orcamento.status) || !pode("orcamentos.editar")}
                    title={
                      !pode("orcamentos.editar")
                        ? "O seu cargo nao permite editar propostas"
                        : podeEditar(orcamento.status)
                          ? "Editar proposta"
                          : `Bloqueada em ${getFase(orcamento.status).nome}. Crie uma revisao para alterar.`
                    }
                    className="rounded-full"
                  >
                    {podeEditar(orcamento.status) ? <Edit className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handleDelete(orcamento.id)}
                    disabled={!pode("orcamentos.apagar")}
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
