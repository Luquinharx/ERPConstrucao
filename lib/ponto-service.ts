import {
  Timestamp,
  collection,
  db,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
} from "@/lib/db/cliente"
import { pedirAuth } from "@/hooks/use-auth"
import { CARGO_TRABALHADOR, PERMISSOES_TRABALHADOR } from "@/lib/permissoes"
import { t } from "@/lib/i18n"
import { CONFIG_PONTO_PADRAO, dataHora, diaLocal, emailDePonto, normalizarNumero, novoToken, pinValido, senhaDoPin } from "@/lib/ponto"
import type {
  AcessoPonto,
  ConfigPonto,
  Funcionario,
  ObraPonto,
  PedidoPonto,
  Picagem,
  RegistoHoras,
  TipoPicagem,
} from "@/lib/types"

/**
 * Acesso ao Firestore da picagem de ponto.
 *
 * Colecoes:
 * - acessosPonto/{numero}: numero do funcionario -> conta. Lido antes do login.
 * - picagens: nunca se editam nem apagam (as regras nao deixam).
 * - pedidosPonto: ferias, faltas e correcoes, com aprovacao.
 * - obrasPonto/{orcamentoId}: as obras onde se pode picar, sem valores.
 * - pontoConfig/geral: validacao do local, raio, hora limite, dias de ferias.
 */

const converter = <T>(id: string, data: Record<string, any>): T =>
  ({
    id,
    ...data,
    hora: data.hora?.toDate?.() ?? data.hora,
    createdAt: data.createdAt?.toDate?.() ?? undefined,
    decididoEm: data.decididoEm?.toDate?.() ?? undefined,
  }) as T

// ------------------------------------------------------------ Configuracao

export async function getConfigPonto(): Promise<ConfigPonto> {
  const snap = await getDoc(doc(db, "pontoConfig", "geral")).catch(() => null)
  return { ...CONFIG_PONTO_PADRAO, ...(snap?.exists() ? (snap.data() as Partial<ConfigPonto>) : {}) }
}

export async function guardarConfigPonto(config: ConfigPonto): Promise<void> {
  await setDoc(doc(db, "pontoConfig", "geral"), { ...config, updatedAt: Timestamp.now() })
}

// ------------------------------------------------------------ Acessos (n.o + PIN)

export async function getAcessos(): Promise<AcessoPonto[]> {
  const snap = await getDocs(collection(db, "acessosPonto"))
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AcessoPonto, "id">) }))
}

/**
 * Cria (ou substitui) a conta de picagem de um funcionario.
 *
 * O servidor cria a conta de login sem mexer na sessao do gestor. Trocar o
 * PIN cria uma conta nova e desativa a anterior, como antes.
 */
export async function criarAcessoPonto(funcionario: Funcionario, pin: string): Promise<void> {
  if (!funcionario.id) throw new Error(t("Funcionário sem id."))
  const numero = normalizarNumero(funcionario.numeroFuncionario || "")
  if (!numero) throw new Error(t("Indique primeiro o número do funcionário na ficha dele."))
  if (!pinValido(pin)) throw new Error(t("O PIN tem de ter 4 a 6 dígitos."))

  const anterior = await getDoc(doc(db, "acessosPonto", numero))
  if (anterior.exists() && anterior.data().funcionarioId !== funcionario.id) {
    throw new Error(t("O número {numero} já está a ser usado por outro funcionário.", { numero }))
  }

  {
    const email = emailDePonto(numero, novoToken(6))
    const { uid } = await pedirAuth<{ uid: string }>("conta-ponto", { email, senha: senhaDoPin(pin), nome: funcionario.nome })

    const lote = writeBatch(db)
    lote.set(doc(db, "utilizadores", uid), {
      email,
      nome: funcionario.nome,
      cargo: CARGO_TRABALHADOR,
      permissoes: PERMISSOES_TRABALHADOR,
      ativo: true,
      funcionarioId: funcionario.id,
      numeroPonto: numero,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    })
    // A conta anterior (PIN antigo) deixa de entrar
    if (anterior.exists() && anterior.data().uid) {
      lote.set(doc(db, "utilizadores", anterior.data().uid), { ativo: false, updatedAt: Timestamp.now() }, { merge: true })
    }
    lote.set(doc(db, "acessosPonto", numero), { email, uid, funcionarioId: funcionario.id, ativo: true })
    await lote.commit()
  }
}

export async function desativarAcessoPonto(acesso: AcessoPonto): Promise<void> {
  const lote = writeBatch(db)
  lote.set(doc(db, "acessosPonto", acesso.id!), { ativo: false }, { merge: true })
  lote.set(doc(db, "utilizadores", acesso.uid), { ativo: false, updatedAt: Timestamp.now() }, { merge: true })
  await lote.commit()
}

export async function reativarAcessoPonto(acesso: AcessoPonto): Promise<void> {
  const lote = writeBatch(db)
  lote.set(doc(db, "acessosPonto", acesso.id!), { ativo: true }, { merge: true })
  lote.set(doc(db, "utilizadores", acesso.uid), { ativo: true, updatedAt: Timestamp.now() }, { merge: true })
  await lote.commit()
}

/** Login do trabalhador. Mensagens simples: quem pica nao precisa de detalhes. */
export async function entrarComPin(numero: string, pin: string): Promise<void> {
  const chave = normalizarNumero(numero)
  if (!chave) throw new Error(t("Indique o seu número de funcionário."))
  if (!pinValido(pin)) throw new Error(t("O PIN tem 4 a 6 dígitos."))
  const snap = await getDoc(doc(db, "acessosPonto", chave))
  if (!snap.exists() || snap.data().ativo === false) throw new Error(t("Número sem acesso ativo. Fale com o seu encarregado."))
  try {
    await pedirAuth("entrar", { email: snap.data().email, senha: senhaDoPin(pin) })
  } catch (e) {
    const codigo = (e as { code?: string }).code || ""
    if (codigo.includes("too-many-requests")) throw new Error(t("Muitas tentativas. Espere uns minutos."))
    throw new Error(t("PIN errado."))
  }
}

// ------------------------------------------------------------ Obras para picar

export async function getObrasPonto(): Promise<ObraPonto[]> {
  const snap = await getDocs(collection(db, "obrasPonto"))
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ObraPonto, "id">) }))
}

export async function guardarObraPonto(obra: ObraPonto): Promise<void> {
  const { id, ...dados } = obra
  await setDoc(doc(db, "obrasPonto", id!), { ...dados, tokenQR: dados.tokenQR || novoToken(), updatedAt: Timestamp.now() }, { merge: true })
}

// ------------------------------------------------------------ Picagens

/** Picagens de uma conta (o trabalhador so pode ler as suas). */
export async function getMinhasPicagens(uid: string): Promise<Picagem[]> {
  const snap = await getDocs(query(collection(db, "picagens"), where("uid", "==", uid)))
  return snap.docs.map((d) => converter<Picagem>(d.id, d.data()))
}

/** Picagens de todos, desde um dia (gestor). */
export async function getPicagensDesde(dia: string): Promise<Picagem[]> {
  const snap = await getDocs(query(collection(db, "picagens"), where("dia", ">=", dia)))
  return snap.docs.map((d) => converter<Picagem>(d.id, d.data()))
}

/**
 * Picagem do proprio trabalhador. A hora e a do servidor (serverTimestamp):
 * mudar o relogio do telemovel nao muda nada, e as regras confirmam-no.
 */
export async function picar(dados: {
  uid: string
  funcionarioId: string
  funcionarioNome: string
  tipo: TipoPicagem
  orcamentoId?: string
  orcamentoNumero?: string
  metodo?: Picagem["metodo"]
  gps?: Picagem["gps"]
}): Promise<void> {
  const ref = doc(collection(db, "picagens"))
  await setDoc(ref, {
    ...dados,
    dia: diaLocal(new Date()),
    hora: serverTimestamp(),
    origem: "app",
    createdAt: serverTimestamp(),
  })
}

/** Correcao do gestor: uma picagem nova com a hora certa e o motivo. */
export async function corrigirPicagem(
  dados: { funcionarioId: string; funcionarioNome: string; uidTrabalhador: string; tipo: TipoPicagem; dia: string; hora: string; orcamentoId?: string; orcamentoNumero?: string; motivo: string; pedidoId?: string },
  gestor: { uid: string; email: string },
): Promise<void> {
  await setDoc(doc(collection(db, "picagens")), {
    uid: dados.uidTrabalhador,
    funcionarioId: dados.funcionarioId,
    funcionarioNome: dados.funcionarioNome,
    tipo: dados.tipo,
    dia: dados.dia,
    hora: Timestamp.fromDate(dataHora(dados.dia, dados.hora)),
    orcamentoId: dados.orcamentoId || "",
    orcamentoNumero: dados.orcamentoNumero || "",
    origem: "correcao",
    motivo: dados.motivo,
    pedidoId: dados.pedidoId || "",
    feitaPor: gestor.email,
    createdAt: serverTimestamp(),
  })
}

/** Anula uma picagem errada sem a apagar: fica o registo de quem e porque. */
export async function anularPicagem(p: Picagem, motivo: string, gestor: { uid: string; email: string }): Promise<void> {
  await setDoc(doc(collection(db, "picagens")), {
    uid: p.uid,
    funcionarioId: p.funcionarioId,
    funcionarioNome: p.funcionarioNome,
    tipo: p.tipo,
    dia: p.dia,
    hora: Timestamp.fromDate(p.hora),
    origem: "anulacao",
    anulaId: p.id,
    motivo,
    feitaPor: gestor.email,
    createdAt: serverTimestamp(),
  })
}

// ------------------------------------------------------------ Pedidos

export async function getMeusPedidos(uid: string): Promise<PedidoPonto[]> {
  const snap = await getDocs(query(collection(db, "pedidosPonto"), where("uid", "==", uid)))
  return snap.docs.map((d) => converter<PedidoPonto>(d.id, d.data()))
}

export async function getPedidos(): Promise<PedidoPonto[]> {
  const snap = await getDocs(collection(db, "pedidosPonto"))
  return snap.docs.map((d) => converter<PedidoPonto>(d.id, d.data()))
}

export async function criarPedido(pedido: Omit<PedidoPonto, "id" | "estado" | "createdAt">): Promise<void> {
  await setDoc(doc(collection(db, "pedidosPonto")), { ...pedido, estado: "pendente", createdAt: serverTimestamp() })
}

export async function cancelarPedido(id: string): Promise<void> {
  await setDoc(doc(db, "pedidosPonto", id), { estado: "cancelado", updatedAt: serverTimestamp() }, { merge: true })
}

/**
 * Decide um pedido. Aprovar uma correcao cria a picagem em falta, no mesmo
 * lote: ou fica tudo gravado, ou nada.
 */
export async function decidirPedido(
  pedido: PedidoPonto,
  aprovar: boolean,
  gestor: { uid: string; email: string },
  resposta = "",
): Promise<void> {
  const lote = writeBatch(db)
  lote.set(
    doc(db, "pedidosPonto", pedido.id!),
    { estado: aprovar ? "aprovado" : "recusado", decididoPor: gestor.email, decididoEm: serverTimestamp(), respostaGestor: resposta },
    { merge: true },
  )
  if (aprovar && pedido.tipo === "correcao" && pedido.correcao) {
    const c = pedido.correcao
    lote.set(doc(collection(db, "picagens")), {
      uid: pedido.uid,
      funcionarioId: pedido.funcionarioId,
      funcionarioNome: pedido.funcionarioNome,
      tipo: c.tipo,
      dia: c.dia,
      hora: Timestamp.fromDate(dataHora(c.dia, c.hora)),
      orcamentoId: c.orcamentoId || "",
      orcamentoNumero: c.orcamentoNumero || "",
      origem: "correcao",
      motivo: pedido.observacoes || t("Pedido de correção"),
      pedidoId: pedido.id,
      feitaPor: gestor.email,
      createdAt: serverTimestamp(),
    })
  }
  await lote.commit()
}

// ------------------------------------------------------------ Envio para o livro de ponto

/** Ids de registos de horas ja criados a partir das picagens (para nao duplicar). */
export function chaveRegisto(funcionarioId: string, orcamentoId: string, dia: string): string {
  return `ponto_${funcionarioId}_${orcamentoId}_${dia}`
}

/**
 * Passa horas das picagens para o livro de ponto (custo da obra). Usa um id
 * fixo por funcionario/obra/dia: enviar duas vezes atualiza, nao duplica.
 * Os registos ja aprovados nao se tocam.
 */
export async function enviarParaLivroDePonto(
  linhas: Array<Omit<RegistoHoras, "id" | "createdAt">>,
): Promise<{ criados: number; ignorados: number }> {
  let criados = 0
  let ignorados = 0
  for (const l of linhas) {
    const id = chaveRegisto(l.funcionarioId, l.orcamentoId, l.data)
    const existente = await getDoc(doc(db, "registosHoras", id))
    if (existente.exists() && existente.data().estado === "aprovado") {
      ignorados++
      continue
    }
    await setDoc(doc(db, "registosHoras", id), { ...l, origem: "picagem", createdAt: Timestamp.now() })
    criados++
  }
  return { criados, ignorados }
}
