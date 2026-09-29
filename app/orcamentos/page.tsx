"use client"

import type React from "react"

import { useState, useEffect, useMemo, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import {
  Plus,
  Edit,
  Trash2,
  Calculator,
  Search,
  FileText,
  Download,
  Loader2,
  Copy,
  ArrowRightLeft,
  Lock,
  Building2,
  Receipt,
} from "lucide-react"
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
  Cliente,
  TermoServico,
  ConfiguracaoEmpresa,
  StatusOrcamento,
} from "@/lib/types"
import { FirebaseService } from "@/lib/firebase-service"
import { formatCurrency, formatNumber2, matchesSearch, round2, toFixed2 } from "@/lib/utils"
import { ListToolbar } from "@/components/ui/list-toolbar"
import { useSearchQuery } from "@/hooks/use-search-query"
import { useConfiguracao } from "@/hooks/use-configuracao"
import { usePermissoes } from "@/hooks/use-permissoes"
import { CustosObraDialog } from "@/components/orcamentos/custos-obra-dialog"
import { analisarCustoObra, CUSTOS_OBRA_ATIVO, valoresVendidosDoOrcamento } from "@/lib/custos-obra"
import {
  FASES_ORCAMENTO,
  getFase,
  nomeDaVersao,
  normalizarFase,
  podeCriarRevisao,
  podeEditar,
  podePassarAObra,
} from "@/lib/orcamento-fases"
import {
  getTipoDocumento,
  numeroAoPassarAObra,
  numeroCompleto,
  tipoDoDocumento,
} from "@/lib/numeracao"
import { CONFIGURACAO_PADRAO, corDeTexto } from "@/lib/brand"
import {
  type TipoDocumento,
  SEM_AMBIENTE,
  agruparPorAmbiente,
  calculateItemTotal,
  calculateSubtotalCusto,
  calculateTotalCusto,
  escapeHtml,
  getItemDescricaoDocumento,
  resumoDeValores,
} from "@/lib/orcamento-calculos"

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

  const { subtotal, subtotalCusto, transporte, margem, margemValor, totalVenda, taxaIVA, valorIVA, baseTributavel, totalCusto } =
    resumoDeValores(orcamento)
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
        /*
           A margem superior da folha vem daqui.

           Com @page margin 0 - preciso para o navegador nao desenhar a data e o
           "about:blank" - nao ha margem nenhuma no papel. Como esta faixa vive
           no thead da moldura, repete-se em todas as paginas e e ela que afasta
           o conteudo da borda. Sem o padding-top, a primeira coisa impressa
           ficava a 0,7 mm da borda, dentro da area que muitas impressoras nem
           conseguem imprimir.
        */
        .faixa-marca {
          display: flex; justify-content: flex-end; align-items: center;
          height: 26mm; padding-top: 10mm; padding-bottom: 4mm;
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
        /* A moldura e estrutura, nao uma tabela de dados: sem margem propria */
        table.moldura { margin-top: 0; }
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
        section { page-break-inside: avoid; break-inside: avoid; }
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
        /*
           As condicoes gerais podem partir entre folhas.

           Com page-break-inside: avoid herdado do "section", o bloco inteiro das
           condicoes so cabia se coubesse todo, por isso saltava para uma folha
           nova e deixava a anterior a meio. Agora a lista parte onde for preciso;
           o que nunca se parte a meio e cada clausula (.termo), e um titulo nunca
           fica sozinho no fundo da pagina (page-break-after: avoid).
        */
        .termos, .termos section { page-break-inside: auto; break-inside: auto; }
        .termos h3 { page-break-after: avoid; break-after: avoid; }
        .termo {
          margin-top: 9px; font-size: 10.5px; line-height: 1.55;
          page-break-inside: avoid; break-inside: avoid;
        }
        .termo strong { display: block; color: ${corEscura}; margin-bottom: 2px; }

        /*
           Margem inferior da folha, pela mesma razao que a faixa do topo.

           O rodape esta fixo ao fundo da pagina em vez de viver no tfoot: no
           tfoot ele subia atras do conteudo e, na ultima folha, aparecia a meio
           da pagina. Fixo, o navegador desenha-o no fundo de todas as folhas.
           O tfoot fica com um espaco vazio da mesma altura, para o conteudo
           nunca lhe passar por cima.
        */
        .rodape {
          position: fixed; left: 10mm; right: 10mm; bottom: 0;
          height: 18mm; padding-top: 3mm; padding-bottom: 8mm;
          border-top: 1px solid #e5e7eb;
          display: flex; justify-content: space-between; align-items: flex-start;
          font-size: 8.5px; color: #9ca3af;
          background: #fff;
        }
        .rodape-espaco { height: 18mm; }
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
          <tr><td><div class="rodape-espaco"></div></td></tr>
        </tfoot>
        <tbody><tr><td>
      <header class="topo">
        <div class="topo-dados">
          <div class="ref">${escapeHtml(numeroCompleto(orcamento, marca))}</div>
          <div class="muted">${escapeHtml(getTipoDocumento(tipoDoDocumento(orcamento)).nome)}</div>
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
          <div><span>Margem (${formatNumber2(margem)}%):</span><span>${formatCurrency(margemValor)}</span></div>
          <div><span>Venda sem IVA (base):</span><span>${formatCurrency(baseTributavel)}</span></div>
          <div><span>IVA (${formatNumber2(taxaIVA)}%) a entregar:</span><span>${formatCurrency(valorIVA)}</span></div>
          <div><span>Total cobrado ao cliente:</span><span>${formatCurrency(totalVenda)}</span></div>
        `
            : `
          <div><span>Subtotal:</span><span>${formatCurrency(baseTributavel)}</span></div>
          <div><span>IVA (${formatNumber2(taxaIVA)}%):</span><span>${formatCurrency(valorIVA)}</span></div>
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

      <div class="rodape">
        <span>${escapeHtml(marca.nome)}${marca.website ? ` · ${escapeHtml(marca.website)}` : ""}</span>
        <span>${escapeHtml(numeroCompleto(orcamento, marca))} · emitido em ${new Date().toLocaleDateString("pt-PT")}</span>
      </div>
    </body>
  </html>
  `
}

export default function OrcamentosPage() {
  const router = useRouter()
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([])
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([])
  const [servicos, setServicos] = useState<Servico[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(false)
  const { searchTerm, setSearchTerm, clearSearch } = useSearchQuery()
  const { configuracao } = useConfiguracao()
  const { pode } = usePermissoes()
  const [statusFilter, setStatusFilter] = useState("all")
  const [generatingDocId, setGeneratingDocId] = useState<string | null>(null)



  // Folha de custos reais: vive num ecra proprio porque se preenche depois da
  // obra adjudicada, quando a proposta ja esta bloqueada para edicao.
  const [custosObraDe, setCustosObraDe] = useState<Orcamento | null>(null)


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
          numeroCompleto(orcamento, configuracao),
          getTipoDocumento(tipoDoDocumento(orcamento)).nome,
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
    // Dar a proposta por adjudicada e um acto comercial, como emitir
    if (destino === "aceite") return pode("orcamentos.aprovar")
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
    // Sair de Cancelado apaga o motivo: senao a proposta reaberta continuava a
    // mostrar "Motivo: ..." de um cancelamento que ja nao existe.
    if (novaFase !== "cancelado" && orcamento.motivoPerda) alteracoes.motivoPerda = ""

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
      // dataEmissao fica de fora em vez de ir a undefined: a revisao nasce por
      // emitir, e o Firestore recusa o documento todo se receber undefined.
      const { id, dataEmissao, ...dados } = orcamento
      await FirebaseService.addOrcamento(
        {
          ...dados,
          numero: `${numeroBase}${String.fromCharCode(64 + proximaRevisao)}`,
          numeroBase,
          revisao: proximaRevisao,
          orcamentoOrigemId: orcamento.id,
          status: "rascunho",
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
      console.error("Erro ao criar revisao:", error)
      toast({
        title: "Erro ao criar revisao",
        description: error instanceof Error ? error.message : "Tente novamente.",
        variant: "destructive",
      })
    }
  }

  /**
   * Passa um concurso adjudicado a obra.
   *
   * Muda so o tipo: o numero sequencial mantem-se, por isso CO26/0007 fica
   * O26/0007 e ve-se logo de que proposta a obra veio. Se esse numero ja
   * estiver ocupado por outra obra, avanca para o proximo livre e avisa.
   * A partir daqui a contabilidade sabe que ja pode faturar.
   */
  const passarAObra = async (orcamento: Orcamento) => {
    if (!user || !orcamento.id) return

    const antes = numeroCompleto(orcamento, configuracao)
    const { numero, manteve } = numeroAoPassarAObra(orcamentos, orcamento)
    const depois = numeroCompleto({ ...orcamento, numero, tipoDocumento: "obra" }, configuracao)

    const aviso = manteve
      ? ""
      : `

Atencao: ${numeroCompleto({ ...orcamento, tipoDocumento: "obra" }, configuracao)} ja esta ocupado por outra obra, por isso esta fica com o proximo numero livre.`

    if (!confirm(`Passar ${antes} a obra?

O documento passa a ${depois}. A proposta nao muda de valores nem de conteudo.${aviso}`)) return

    try {
      await FirebaseService.updateOrcamento(orcamento.id, {
        tipoDocumento: "obra",
        numero,
        historicoFases: [
          ...(orcamento.historicoFases || []),
          {
            estado: normalizarFase(orcamento.status),
            data: new Date(),
            utilizador: user.email || user.uid,
            nota: `Passou a obra: ${antes} passa a ${depois}.`,
          },
        ],
        updatedAt: new Date(),
      })

      toast({
        title: `Agora e obra ${depois}`,
        description: manteve
          ? "O numero manteve-se. A contabilidade ja pode faturar."
          : `O numero de origem estava ocupado, por isso ficou ${depois}.`,
      })
      await loadData()
    } catch (error) {
      console.error("Erro ao passar a obra:", error)
      toast({
        title: "Erro ao passar a obra",
        description: error instanceof Error ? error.message : "Tente novamente.",
        variant: "destructive",
      })
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
        <Button onClick={() => router.push("/orcamentos/novo")} className="rounded-full">
          <Plus className="h-4 w-4 mr-2" />
          Novo Orcamento
        </Button>
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
                    {numeroCompleto(orcamento, configuracao)}
                    <Badge
                      variant="outline"
                      className={`text-xs ${getTipoDocumento(tipoDoDocumento(orcamento)).cor}`}
                      title={getTipoDocumento(tipoDoDocumento(orcamento)).descricao}
                    >
                      {getTipoDocumento(tipoDoDocumento(orcamento)).nome}
                    </Badge>
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
                  {/* O motivo pertence ao cancelamento: reaberta a proposta, deixa de fazer sentido */}
                  {normalizarFase(orcamento.status) === "cancelado" && orcamento.motivoPerda && (
                    <p className="text-destructive">Motivo: {orcamento.motivoPerda}</p>
                  )}

                  {/*
                    Decomposicao do valor, para se ver de que e feito o total sem
                    abrir a proposta. Custo e margem sao informacao interna, por
                    isso ficam atras da permissao; base e IVA vao no documento do
                    cliente, logo qualquer um os pode ver.
                  */}
                  {(() => {
                    const resumo = resumoDeValores(orcamento)
                    const linha = (rotulo: string, valor: string, destaque = false) => (
                      <>
                        <dt className={destaque ? "text-foreground" : ""}>{rotulo}</dt>
                        <dd className={`text-right tabular-nums ${destaque ? "font-medium text-foreground" : ""}`}>
                          {valor}
                        </dd>
                      </>
                    )
                    return (
                      <dl className="mt-2 grid w-fit grid-cols-[auto_auto] gap-x-4 gap-y-0.5">
                        {pode("orcamentos.verCusto") && (
                          <>
                            {linha("Custo", formatCurrency(resumo.totalCusto))}
                            {resumo.transporte > 0 && linha("Transporte", formatCurrency(resumo.transporte))}
                            {linha(`Margem (${formatNumber2(resumo.margem)}%)`, formatCurrency(resumo.margemValor))}
                          </>
                        )}
                        {linha("Base sem IVA", formatCurrency(resumo.baseTributavel))}
                        {linha(`IVA (${formatNumber2(resumo.taxaIVA)}%)`, formatCurrency(resumo.valorIVA))}
                        {linha("Total", formatCurrency(resumo.totalVenda), true)}
                        {/*
                          Com custos lancados, a margem real e a unica que
                          interessa: e a que sobreviveu ao estaleiro.
                        */}
                        {CUSTOS_OBRA_ATIVO &&
                          pode("orcamentos.verCusto") &&
                          (orcamento.custosObra?.length ?? 0) > 0 &&
                          (() => {
                            const analise = analisarCustoObra(
                              valoresVendidosDoOrcamento(orcamento, resumo.totalCusto),
                              orcamento.custosObra || [],
                            )
                            return (
                              <>
                                {linha("Custo real", formatCurrency(analise.custoReal))}
                                {linha(
                                  `Margem real (${formatNumber2(analise.margemRealPercent)}%)`,
                                  formatCurrency(analise.margemReal),
                                  true,
                                )}
                              </>
                            )
                          })()}
                      </dl>
                    )
                  })()}
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
                      {podePassarAObra(orcamento.status, orcamento.tipoDocumento) && pode("orcamentos.editar") && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => void passarAObra(orcamento)}>
                            <Building2 className="h-4 w-4 mr-2" />
                            Passar a obra
                          </DropdownMenuItem>
                        </>
                      )}
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

                  {CUSTOS_OBRA_ATIVO && pode("orcamentos.verCusto") && (
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setCustosObraDe(orcamento)}
                      title="Custos reais da obra e margem real"
                      className="rounded-full"
                    >
                      <Receipt className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => router.push(`/orcamentos/${orcamento.id}`)}
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
              <Button onClick={() => router.push("/orcamentos/novo")} className="rounded-full">
                <Plus className="h-4 w-4 mr-2" />
                Criar primeiro orcamento
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Fecha o ciclo: o que se vendeu contra o que a obra custou de facto. */}
      <CustosObraDialog
        orcamento={custosObraDe}
        open={custosObraDe !== null}
        onOpenChange={(aberto) => {
          if (!aberto) setCustosObraDe(null)
        }}
        custoOrcado={custosObraDe ? resumoDeValores(custosObraDe).totalCusto : 0}
        podeLancar={pode("orcamentos.custosObra")}
        onGuardado={(orcamentoId, linhas) => {
          setOrcamentos((atuais) =>
            atuais.map((item) => (item.id === orcamentoId ? { ...item, custosObra: linhas } : item)),
          )
        }}
      />
    </div>
  )
}
