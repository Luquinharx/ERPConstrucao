/**
 * Grava os funcionarios e servicos no formato corrigido.
 *
 * A aplicacao ja corrige estes registos ao carregar, mas so em memoria: a base
 * fica com os valores antigos ate alguem abrir e gravar cada um. Como o
 * custo/hora gravado no funcionario alimenta cada linha de mao de obra dos
 * orcamentos, isso significa que propostas novas usavam numeros velhos.
 *
 * Usa exatamente as mesmas funcoes do ecra, importadas do projeto, para nao
 * haver hipotese de o script e a aplicacao divergirem.
 */
import { initializeApp, cert } from "firebase-admin/app"
import { getFirestore, Timestamp } from "firebase-admin/firestore"
import path from "path"

import { calcularFuncionario, normalizarFuncionario } from "../lib/calculo-funcionario"
import { migrarComposicaoLegada } from "../lib/service-composition"
import { round2 } from "../lib/utils"

const CHAVE = process.argv[2]
const APLICAR = process.argv.includes("--aplicar")

if (!CHAVE) {
  console.error("Uso: npx tsx scripts/migrar-dados.ts <chave.json> [--aplicar]")
  console.error("Sem --aplicar faz uma simulacao e nao grava nada.")
  process.exit(1)
}

const app = initializeApp({ credential: cert(require(path.resolve(CHAVE))) })
const db = getFirestore(app)

function eur(v: number | undefined): string {
  return (Number(v) || 0).toFixed(2).replace(".", ",") + " EUR"
}

async function funcionarios() {
  console.log("=".repeat(70))
  console.log("FUNCIONARIOS")
  console.log("=".repeat(70))

  const snap = await db.collection("funcionarios").get()
  let alterados = 0

  for (const documento of snap.docs) {
    const dados = documento.data() as any
    const calculo = calcularFuncionario(normalizarFuncionario(dados))

    const antesCusto = round2(Number(dados.custoHoraCalculado) || 0)
    const antesVenda = round2(Number(dados.custoHora) || 0)
    const depoisCusto = calculo.custoHoraCalculado
    const depoisVenda = calculo.valorDeVendaCalculado

    const mudou = antesCusto !== depoisCusto || antesVenda !== depoisVenda

    console.log("")
    console.log(dados.nome + "  (" + (dados.funcao || "sem funcao") + ")")
    console.log("  base de horas    " + calculo.baseDias.dias + " dias x " +
      (dados.horasPorDia || 8) + "h = " + calculo.horasPorMes + " h/mes")
    console.log("  custo/hora       " + eur(antesCusto) + "  ->  " + eur(depoisCusto) +
      (mudou ? "   ALTERADO" : "   (igual)"))
    console.log("  venda/hora       " + eur(antesVenda) + "  ->  " + eur(depoisVenda))
    console.log("  custo mensal     " + eur(calculo.salarioTotal) +
      "  (" + calculo.percentualSobreSalario + "% da bruta)")
    console.log("  liquido a receber " + eur(calculo.salarioTotalLiquido) +
      "  (descontos " + calculo.taxaEfetivaDesconto + "%)")

    if (!APLICAR) continue

    await documento.ref.update({
      custoHora: depoisVenda,
      custoHoraCalculado: depoisCusto,
      custoHoraLiquido: calculo.custoHoraLiquido,
      horasPorMes: calculo.horasPorMes,
      valorBeneficios: calculo.valorBeneficiosCalculado,
      valorSeguranca: calculo.seguranca.valor,
      valorSeguroAcidentes: calculo.seguroAcidentes.valor,
      valorSegurancaLiquido: calculo.segurancaLiquido.valor,
      valorIRSLiquido: calculo.irsLiquido.valor,
      totalEncargos: calculo.totalEncargos,
      salarioTotal: calculo.salarioTotal,
      salarioTotalLiquido: calculo.salarioTotalLiquido,
      // Repoe os campos normalizados, para o registo deixar de ser "antigo"
      ...normalizarFuncionario(dados),
      updatedAt: Timestamp.now(),
    })
    if (mudou) alterados++
  }

  console.log("")
  console.log("Total: " + snap.size + " funcionarios" + (APLICAR ? ", " + alterados + " com valores alterados" : ""))
}

async function servicos() {
  console.log("")
  console.log("=".repeat(70))
  console.log("SERVICOS")
  console.log("=".repeat(70))

  const snap = await db.collection("servicos").get()
  let antigos = 0

  for (const documento of snap.docs) {
    const dados = documento.data() as any
    const jaMigrado = Array.isArray(dados.composicao) && dados.composicao.length > 0

    const { composicao, quantidadeReferencia } = migrarComposicaoLegada({ ...dados, id: documento.id })

    console.log("")
    console.log(dados.nome)
    if (jaMigrado) {
      console.log("  ja estava no formato novo (" + composicao.length + " itens)")
      continue
    }

    antigos++
    console.log("  FORMATO ANTIGO -> " + composicao.length + " itens de composicao, " +
      "quantidade de referencia " + quantidadeReferencia)
    const total = composicao.reduce((acc: number, i: any) => acc + (Number(i.total) || 0), 0)
    console.log("  total da composicao " + eur(round2(total)) +
      "  -> preco unitario " + eur(round2(total / (quantidadeReferencia || 1))))

    if (!APLICAR) continue

    await documento.ref.update({
      composicao,
      quantidadeReferencia,
      updatedAt: Timestamp.now(),
    })
  }

  console.log("")
  console.log("Total: " + snap.size + " servicos, " + antigos + " no formato antigo")
}

;(async () => {
  if (!APLICAR) {
    console.log(">>> SIMULACAO: nada e gravado. Acrescente --aplicar para gravar.\n")
  }
  await funcionarios()
  await servicos()
  console.log("")
  console.log(APLICAR ? ">>> Gravado." : ">>> Simulacao terminada, nada foi gravado.")
})().catch((e) => {
  console.error("FALHOU: " + (e as Error).message)
  process.exit(1)
})
