import {
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  query,
  Timestamp,
  limit,
  onSnapshot,
  orderBy,
  startAfter,
  getCountFromServer,
  DocumentSnapshot,
} from "firebase/firestore"
import { db } from "./firebase"

/**
 * BASE COMPARTILHADA
 *
 * As consultas nao filtram por `userId`: qualquer conta autenticada ve toda a
 * base (clientes, funcionarios, materiais, servicos, orcamentos e termos).
 * As regras em `firestore.rules` seguem a mesma decisao.
 *
 * O `userId` continua a ser gravado em cada documento e as funcoes continuam a
 * receber esse parametro, mas apenas como registo de quem criou - nao restringe
 * o acesso. Para voltar a separar por conta, repor o `where("userId", "==", userId)`
 * nas consultas e as regras de dono em firestore.rules.
 */
import type {
  Cliente,
  Funcionario,
  Material,
  Categoria,
  Servico,
  Orcamento,
  MaterialCategory,
  TermoServico,
} from "./types"

// Função para gerar número único
function generateUniqueNumber(prefix: string): string {
  const timestamp = Date.now().toString().slice(-6)
  const random = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, "0")
  return `${prefix}-${timestamp}${random}`
}

// Função para testar conexão
export async function testFirebaseConnection(): Promise<boolean> {
  try {
    console.log("🔄 Testando conexão com Firebase...")
    const testCollection = collection(db, "test")
    await getDocs(query(testCollection, limit(1)))
    console.log("✅ Conexão com Firebase estabelecida com sucesso")
    return true
  } catch (error) {
    console.error("❌ Erro na conexão com Firebase:", error)
    return false
  }
}

// CLIENTES
export async function addCliente(
  cliente: Omit<Cliente, "id" | "numeroUnico" | "createdAt" | "updatedAt">,
  userId: string,
): Promise<string> {
  try {
    console.log("🔄 Adicionando cliente:", cliente.nome)

    const numeroUnico = generateUniqueNumber("CLI")
    const now = new Date()

    const clienteData = {
      ...cliente,
      numeroUnico,
      userId,
      createdAt: Timestamp.fromDate(now),
      updatedAt: Timestamp.fromDate(now),
    }

    const docRef = await addDoc(collection(db, "clientes"), clienteData)
    console.log("✅ Cliente adicionado com ID:", docRef.id)
    return docRef.id
  } catch (error) {
    console.error("❌ Erro ao adicionar cliente:", error)
    throw error
  }
}

// Helper para paginação
export interface PaginatedResult<T> {
  data: T[]
  lastVisible: DocumentSnapshot | null
  hasMore: boolean
}

export async function getClientesPaginated(
  userId: string,
  pageSize: number = 20,
  lastDoc: unknown = null,
): Promise<PaginatedResult<Cliente>> {
  try {
    console.log("🔄 Buscando clientes paginados para usuário:", userId)

    let q = query(
      collection(db, "clientes"),
      orderBy("createdAt", "desc"),
      limit(pageSize)
    )

    if (lastDoc) {
      q = query(
        collection(db, "clientes"),
        orderBy("createdAt", "desc"),
        startAfter(lastDoc),
        limit(pageSize)
      )
    }

    let querySnapshot
    try {
      querySnapshot = await getDocs(q)
    } catch (error: any) {
      if (error.code === 'failed-precondition') {
        // Fallback para quando o índice composto ainda não existe
        console.warn("⚠️ Índice composto ausente. Buscando sem ordenação no servidor.", error.message)
        const fallbackQuery = query(
          collection(db, "clientes"), 
          limit(pageSize)
        );
        querySnapshot = await getDocs(fallbackQuery)
      } else {
        throw error
      }
    }

    const clientes: Cliente[] = []

    querySnapshot.forEach((doc) => {
      const data = doc.data()
      clientes.push({
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
      } as Cliente)
    })

    // Ordenação em memória como fallback seguro
    clientes.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())

    // Nota: A paginação pode não funcionar corretamente no modo fallback sem índices
    const lastVisible = querySnapshot.docs.length > 0 ? querySnapshot.docs[querySnapshot.docs.length - 1] : null
    const hasMore = querySnapshot.docs.length === pageSize

    console.log(`✅ ${clientes.length} clientes encontrados (paginado)`)
    
    return {
      data: clientes,
      lastVisible,
      hasMore
    }
  } catch (error: any) {
    console.error("❌ Erro ao buscar clientes paginados:", error)
    throw error
  }
}

export async function getClientes(userId: string): Promise<Cliente[]> {
  try {
    console.log("🔄 Buscando clientes para usuário:", userId)

    const q = query(collection(db, "clientes"))
    const querySnapshot = await getDocs(q)
    const clientes: Cliente[] = []

    querySnapshot.forEach((doc) => {
      const data = doc.data()
      clientes.push({
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
      } as Cliente)
    })

    clientes.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    console.log(`✅ ${clientes.length} clientes encontrados`)
    return clientes
  } catch (error) {
    console.error("❌ Erro ao buscar clientes:", error)
    throw error
  }
}

export async function updateCliente(id: string, cliente: Partial<Cliente>): Promise<void> {
  try {
    console.log("🔄 Atualizando cliente:", id)
    const clienteRef = doc(db, "clientes", id)
    await updateDoc(clienteRef, {
      ...cliente,
      updatedAt: Timestamp.fromDate(new Date()),
    })
    console.log("✅ Cliente atualizado com sucesso")
  } catch (error) {
    console.error("❌ Erro ao atualizar cliente:", error)
    throw error
  }
}

export async function deleteCliente(id: string): Promise<void> {
  try {
    console.log("🔄 Deletando cliente:", id)
    await deleteDoc(doc(db, "clientes", id))
    console.log("✅ Cliente deletado com sucesso")
  } catch (error) {
    console.error("❌ Erro ao deletar cliente:", error)
    throw error
  }
}

// FUNCIONÁRIOS
export async function addFuncionario(
  funcionario: Omit<Funcionario, "id" | "createdAt" | "updatedAt">,
  userId: string,
): Promise<string> {
  try {
    console.log("🔄 Adicionando funcionário:", funcionario.nome)

    const now = new Date()
    const funcionarioData = {
      ...funcionario,
      userId,
      createdAt: Timestamp.fromDate(now),
      updatedAt: Timestamp.fromDate(now),
    }

    const docRef = await addDoc(collection(db, "funcionarios"), funcionarioData)
    console.log("✅ Funcionário adicionado com ID:", docRef.id)
    return docRef.id
  } catch (error) {
    console.error("❌ Erro ao adicionar funcionário:", error)
    throw error
  }
}

export async function getFuncionarios(userId: string): Promise<Funcionario[]> {
  try {
    console.log("🔄 Buscando funcionários para usuário:", userId)

    const q = query(collection(db, "funcionarios"))
    const querySnapshot = await getDocs(q)
    const funcionarios: Funcionario[] = []

    querySnapshot.forEach((doc) => {
      const data = doc.data()
      funcionarios.push({
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
      } as Funcionario)
    })

    funcionarios.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    console.log(`✅ ${funcionarios.length} funcionários encontrados`)
    return funcionarios
  } catch (error) {
    console.error("❌ Erro ao buscar funcionários:", error)
    throw error
  }
}

export async function updateFuncionario(id: string, funcionario: Partial<Funcionario>): Promise<void> {
  try {
    console.log("🔄 Atualizando funcionário:", id)
    const funcionarioRef = doc(db, "funcionarios", id)
    await updateDoc(funcionarioRef, {
      ...funcionario,
      updatedAt: Timestamp.fromDate(new Date()),
    })
    console.log("✅ Funcionário atualizado com sucesso")
  } catch (error) {
    console.error("❌ Erro ao atualizar funcionário:", error)
    throw error
  }
}

export async function deleteFuncionario(id: string): Promise<void> {
  try {
    console.log("🔄 Deletando funcionário:", id)
    await deleteDoc(doc(db, "funcionarios", id))
    console.log("✅ Funcionário deletado com sucesso")
  } catch (error) {
    console.error("❌ Erro ao deletar funcionário:", error)
    throw error
  }
}

// MATERIAIS
export async function addMaterial(
  material: Omit<Material, "id" | "createdAt" | "updatedAt">,
  userId: string,
): Promise<string> {
  try {
    console.log("🔄 Adicionando material:", material.nome)

    const now = new Date()
    const materialData = {
      ...material,
      userId,
      createdAt: Timestamp.fromDate(now),
      updatedAt: Timestamp.fromDate(now),
    }

    const docRef = await addDoc(collection(db, "materiais"), materialData)
    console.log("✅ Material adicionado com ID:", docRef.id)
    return docRef.id
  } catch (error) {
    console.error("❌ Erro ao adicionar material:", error)
    throw error
  }
}

export async function getMateriais(userId: string): Promise<Material[]> {
  try {
    console.log("🔄 Buscando materiais para usuário:", userId)

    const q = query(collection(db, "materiais"))
    const querySnapshot = await getDocs(q)
    const materiais: Material[] = []

    querySnapshot.forEach((doc) => {
      const data = doc.data()
      materiais.push({
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
      } as Material)
    })

    materiais.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    console.log(`✅ ${materiais.length} materiais encontrados`)
    return materiais
  } catch (error) {
    console.error("❌ Erro ao buscar materiais:", error)
    throw error
  }
}

export async function updateMaterial(id: string, material: Partial<Material>): Promise<void> {
  try {
    console.log("🔄 Atualizando material:", id)
    const materialRef = doc(db, "materiais", id)
    await updateDoc(materialRef, {
      ...material,
      updatedAt: Timestamp.fromDate(new Date()),
    })
    console.log("✅ Material atualizado com sucesso")
  } catch (error) {
    console.error("❌ Erro ao atualizar material:", error)
    throw error
  }
}

export async function deleteMaterial(id: string): Promise<void> {
  try {
    console.log("🔄 Deletando material:", id)
    await deleteDoc(doc(db, "materiais", id))
    console.log("✅ Material deletado com sucesso")
  } catch (error) {
    console.error("❌ Erro ao deletar material:", error)
    throw error
  }
}

// CATEGORIAS DE MATERIAIS
export async function addMaterialCategory(
  categoria: Omit<MaterialCategory, "id" | "createdAt" | "updatedAt">,
  userId: string,
): Promise<string> {
  try {
    console.log("🔄 Adicionando categoria de material:", categoria.nome)

    const now = new Date()
    const categoriaData = {
      ...categoria,
      userId,
      createdAt: Timestamp.fromDate(now),
      updatedAt: Timestamp.fromDate(now),
    }

    const docRef = await addDoc(collection(db, "material-categories"), categoriaData)
    console.log("✅ Categoria de material adicionada com ID:", docRef.id)
    return docRef.id
  } catch (error) {
    console.error("❌ Erro ao adicionar categoria de material:", error)
    throw error
  }
}

export async function getMaterialCategories(userId: string): Promise<MaterialCategory[]> {
  try {
    console.log("🔄 Buscando categorias de materiais para usuário:", userId)

    const q = query(collection(db, "material-categories"))
    const querySnapshot = await getDocs(q)
    const categorias: MaterialCategory[] = []

    querySnapshot.forEach((doc) => {
      const data = doc.data()
      categorias.push({
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
      } as MaterialCategory)
    })

    categorias.sort((a, b) => a.nome.localeCompare(b.nome))
    console.log(`✅ ${categorias.length} categorias de materiais encontradas`)
    return categorias
  } catch (error) {
    console.error("❌ Erro ao buscar categorias de materiais:", error)
    throw error
  }
}

export async function updateMaterialCategory(id: string, categoria: Partial<MaterialCategory>): Promise<void> {
  try {
    console.log("🔄 Atualizando categoria de material:", id)
    const categoriaRef = doc(db, "material-categories", id)
    await updateDoc(categoriaRef, {
      ...categoria,
      updatedAt: Timestamp.fromDate(new Date()),
    })
    console.log("✅ Categoria de material atualizada com sucesso")
  } catch (error) {
    console.error("❌ Erro ao atualizar categoria de material:", error)
    throw error
  }
}

export async function deleteMaterialCategory(id: string): Promise<void> {
  try {
    console.log("🔄 Deletando categoria de material:", id)
    await deleteDoc(doc(db, "material-categories", id))
    console.log("✅ Categoria de material deletada com sucesso")
  } catch (error) {
    console.error("❌ Erro ao deletar categoria de material:", error)
    throw error
  }
}

// CATEGORIAS (LEGACY - mantido para compatibilidade)
export async function addCategoria(
  categoria: Omit<Categoria, "id" | "createdAt" | "updatedAt">,
  userId: string,
): Promise<string> {
  try {
    console.log("🔄 Adicionando categoria:", categoria.nome)

    const now = new Date()
    const categoriaData = {
      ...categoria,
      userId,
      createdAt: Timestamp.fromDate(now),
      updatedAt: Timestamp.fromDate(now),
    }

    const docRef = await addDoc(collection(db, "categorias"), categoriaData)
    console.log("✅ Categoria adicionada com ID:", docRef.id)
    return docRef.id
  } catch (error) {
    console.error("❌ Erro ao adicionar categoria:", error)
    throw error
  }
}

export async function getCategorias(userId: string): Promise<Categoria[]> {
  try {
    console.log("🔄 Buscando categorias para usuário:", userId)

    const q = query(collection(db, "categorias"))
    const querySnapshot = await getDocs(q)
    const categorias: Categoria[] = []

    querySnapshot.forEach((doc) => {
      const data = doc.data()
      categorias.push({
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
      } as Categoria)
    })

    categorias.sort((a, b) => a.nome.localeCompare(b.nome))
    console.log(`✅ ${categorias.length} categorias encontradas`)
    return categorias
  } catch (error) {
    console.error("❌ Erro ao buscar categorias:", error)
    throw error
  }
}

export async function updateCategoria(id: string, categoria: Partial<Categoria>): Promise<void> {
  try {
    console.log("🔄 Atualizando categoria:", id)
    const categoriaRef = doc(db, "categorias", id)
    await updateDoc(categoriaRef, {
      ...categoria,
      updatedAt: Timestamp.fromDate(new Date()),
    })
    console.log("✅ Categoria atualizada com sucesso")
  } catch (error) {
    console.error("❌ Erro ao atualizar categoria:", error)
    throw error
  }
}

export async function deleteCategoria(id: string): Promise<void> {
  try {
    console.log("🔄 Deletando categoria:", id)
    await deleteDoc(doc(db, "categorias", id))
    console.log("✅ Categoria deletada com sucesso")
  } catch (error) {
    console.error("❌ Erro ao deletar categoria:", error)
    throw error
  }
}

// SERVIÇOS
export async function addServico(
  servico: Omit<Servico, "id" | "createdAt" | "updatedAt">,
  userId: string,
): Promise<string> {
  try {
    console.log("🔄 Adicionando serviço:", servico.nome)

    const now = new Date()
    const servicoData = {
      ...servico,
      userId,
      createdAt: Timestamp.fromDate(now),
      updatedAt: Timestamp.fromDate(now),
    }

    const docRef = await addDoc(collection(db, "servicos"), servicoData)
    console.log("✅ Serviço adicionado com ID:", docRef.id)
    return docRef.id
  } catch (error) {
    console.error("❌ Erro ao adicionar serviço:", error)
    throw error
  }
}

export async function getServicos(userId: string): Promise<Servico[]> {
  try {
    console.log("🔄 Buscando serviços para usuário:", userId)

    const q = query(collection(db, "servicos"))
    const querySnapshot = await getDocs(q)
    const servicos: Servico[] = []

    querySnapshot.forEach((doc) => {
      const data = doc.data()
      servicos.push({
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
      } as Servico)
    })

    servicos.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    console.log(`✅ ${servicos.length} serviços encontrados`)
    return servicos
  } catch (error) {
    console.error("❌ Erro ao buscar serviços:", error)
    throw error
  }
}

export async function updateServico(id: string, servico: Partial<Servico>): Promise<void> {
  try {
    console.log("🔄 Atualizando serviço:", id)
    const servicoRef = doc(db, "servicos", id)
    await updateDoc(servicoRef, {
      ...servico,
      updatedAt: Timestamp.fromDate(new Date()),
    })
    console.log("✅ Serviço atualizado com sucesso")
  } catch (error) {
    console.error("❌ Erro ao atualizar serviço:", error)
    throw error
  }
}

export async function deleteServico(id: string): Promise<void> {
  try {
    console.log("🔄 Deletando serviço:", id)
    await deleteDoc(doc(db, "servicos", id))
    console.log("✅ Serviço deletado com sucesso")
  } catch (error) {
    console.error("❌ Erro ao deletar serviço:", error)
    throw error
  }
}

// ORÇAMENTOS
export async function addOrcamento(
  orcamento: Omit<Orcamento, "id" | "createdAt" | "updatedAt">,
  userId: string,
): Promise<string> {
  try {
    console.log("🔄 Adicionando orçamento:", orcamento.numero)

    const now = new Date()
    const orcamentoData = {
      ...orcamento,
      userId,
      createdAt: Timestamp.fromDate(now),
      updatedAt: Timestamp.fromDate(now),
      dataOrcamento: Timestamp.fromDate(orcamento.dataOrcamento),
      dataValidade: Timestamp.fromDate(orcamento.dataValidade),
    }

    const docRef = await addDoc(collection(db, "orcamentos"), orcamentoData)
    console.log("✅ Orçamento adicionado com ID:", docRef.id)
    return docRef.id
  } catch (error) {
    console.error("❌ Erro ao adicionar orçamento:", error)
    throw error
  }
}

export async function getOrcamentos(userId: string): Promise<Orcamento[]> {
  try {
    console.log("🔄 Buscando orçamentos para usuário:", userId)

    const q = query(collection(db, "orcamentos"))
    const querySnapshot = await getDocs(q)
    const orcamentos: Orcamento[] = []

    querySnapshot.forEach((doc) => {
      const data = doc.data()
      orcamentos.push({
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
        dataOrcamento: data.dataOrcamento?.toDate() || new Date(),
        dataValidade: data.dataValidade?.toDate() || new Date(),
      } as Orcamento)
    })

    orcamentos.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    console.log(`✅ ${orcamentos.length} orçamentos encontrados`)
    return orcamentos
  } catch (error) {
    console.error("❌ Erro ao buscar orçamentos:", error)
    throw error
  }
}

export async function updateOrcamento(id: string, orcamento: Partial<Orcamento>): Promise<void> {
  try {
    console.log("🔄 Atualizando orçamento:", id)

    const orcamentoRef = doc(db, "orcamentos", id)
    const updateData = {
      ...orcamento,
      updatedAt: Timestamp.fromDate(new Date()),
    }

    if (orcamento.dataOrcamento) {
      updateData.dataOrcamento = Timestamp.fromDate(orcamento.dataOrcamento)
    }
    if (orcamento.dataValidade) {
      updateData.dataValidade = Timestamp.fromDate(orcamento.dataValidade)
    }

    await updateDoc(orcamentoRef, updateData)
    console.log("✅ Orçamento atualizado com sucesso")
  } catch (error) {
    console.error("❌ Erro ao atualizar orçamento:", error)
    throw error
  }
}

export async function deleteOrcamento(id: string): Promise<void> {
  try {
    console.log("🔄 Deletando orçamento:", id)
    await deleteDoc(doc(db, "orcamentos", id))
    console.log("✅ Orçamento deletado com sucesso")
  } catch (error) {
    console.error("❌ Erro ao deletar orçamento:", error)
    throw error
  }
}

// TERMOS DE SERVICO
export async function getTermosServico(userId: string, onlyActive: boolean = false): Promise<TermoServico[]> {
  try {
    console.log("🔄 Buscando termos de servico para usuario:", userId)

    const q = query(collection(db, "termos_servico"))
    const querySnapshot = await getDocs(q)
    const termos: TermoServico[] = []

    querySnapshot.forEach((doc) => {
      const data = doc.data()
      termos.push({
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
      } as TermoServico)
    })

    const filtered = onlyActive ? termos.filter((item) => item.ativo) : termos
    filtered.sort((a, b) => {
      if (a.tipo !== b.tipo) {
        const order = { termos: 1, regras: 2, condicoes: 3 }
        return order[a.tipo] - order[b.tipo]
      }
      return (a.ordem || 0) - (b.ordem || 0)
    })

    console.log(`✅ ${filtered.length} termos encontrados`)
    return filtered
  } catch (error) {
    console.error("❌ Erro ao buscar termos de servico:", error)
    throw error
  }
}

// DASHBOARD STATS
export interface DashboardStats {
  totalOrcamentos: number
  orcamentosAprovados: number
  receitaTotal: number
  clientesAtivos: number
  taxaConversao: number
}

export async function getDashboardStats(userId: string): Promise<DashboardStats> {
  try {
    console.log("🔄 Calculando estatísticas do dashboard para usuário:", userId)

    const [clientes, orcamentos] = await Promise.all([getClientes(userId), getOrcamentos(userId)])

    const orcamentosAprovados = orcamentos.filter((o) => o.status === "aprovado")
    const receitaTotal = orcamentosAprovados.reduce((sum, o) => sum + (o.valorTotal || 0), 0)
    const taxaConversao = orcamentos.length > 0 ? Math.round((orcamentosAprovados.length / orcamentos.length) * 100) : 0

    const stats: DashboardStats = {
      totalOrcamentos: orcamentos.length,
      orcamentosAprovados: orcamentosAprovados.length,
      receitaTotal,
      clientesAtivos: clientes.length,
      taxaConversao,
    }

    console.log("✅ Estatísticas calculadas:", stats)
    return stats
  } catch (error) {
    console.error("❌ Erro ao calcular estatísticas:", error)
    return {
      totalOrcamentos: 0,
      orcamentosAprovados: 0,
      receitaTotal: 0,
      clientesAtivos: 0,
      taxaConversao: 0,
    }
  }
}

// FUNÇÃO PARA SUBSCRIPTION EM TEMPO REAL
export function subscribeToCollection<T>(
  collectionName: string,
  userId: string,
  callback: (data: T[]) => void,
  orderByField?: string,
) {
  try {
    console.log(`🔄 Iniciando subscription para ${collectionName}`)

    const q = query(collection(db, collectionName))

    return onSnapshot(q, (querySnapshot) => {
      const data: T[] = []
      querySnapshot.forEach((doc) => {
        const docData = doc.data()
        data.push({
          id: doc.id,
          ...docData,
          createdAt: docData.createdAt?.toDate() || new Date(),
          updatedAt: docData.updatedAt?.toDate() || new Date(),
        } as T)
      })

      // Ordenar no cliente
      if (orderByField) {
        data.sort((a: any, b: any) => {
          if (orderByField === "createdAt") {
            return b.createdAt.getTime() - a.createdAt.getTime()
          }
          return a[orderByField]?.localeCompare(b[orderByField]) || 0
        })
      }

      console.log(`✅ ${data.length} documentos recebidos para ${collectionName}`)
      callback(data)
    })
  } catch (error) {
    console.error(`❌ Erro na subscription para ${collectionName}:`, error)
    return () => {}
  }
}

// Classe FirebaseService para compatibilidade com código existente
export class FirebaseService {
  // Clientes
  static async getClientes(userId: string) {
    return getClientes(userId)
  }

  static async addCliente(cliente: Omit<Cliente, "id" | "numeroUnico" | "createdAt" | "updatedAt">, userId: string) {
    return addCliente(cliente, userId)
  }

  static async updateCliente(id: string, cliente: Partial<Cliente>) {
    return updateCliente(id, cliente)
  }

  static async deleteCliente(id: string) {
    return deleteCliente(id)
  }

  // Funcionários
  static async getFuncionarios(userId: string) {
    return getFuncionarios(userId)
  }

  static async addFuncionario(funcionario: Omit<Funcionario, "id" | "createdAt" | "updatedAt">, userId: string) {
    return addFuncionario(funcionario, userId)
  }

  static async updateFuncionario(id: string, funcionario: Partial<Funcionario>) {
    return updateFuncionario(id, funcionario)
  }

  static async deleteFuncionario(id: string) {
    return deleteFuncionario(id)
  }

  // Materiais
  static async getMateriais(userId: string) {
    return getMateriais(userId)
  }

  static async addMaterial(material: Omit<Material, "id" | "createdAt" | "updatedAt">, userId: string) {
    return addMaterial(material, userId)
  }

  static async updateMaterial(id: string, material: Partial<Material>) {
    return updateMaterial(id, material)
  }

  static async deleteMaterial(id: string) {
    return deleteMaterial(id)
  }

  // Categorias de Materiais
  static async getMaterialCategories(userId: string) {
    return getMaterialCategories(userId)
  }

  static async addMaterialCategory(
    categoria: Omit<MaterialCategory, "id" | "createdAt" | "updatedAt">,
    userId: string,
  ) {
    return addMaterialCategory(categoria, userId)
  }

  static async updateMaterialCategory(id: string, categoria: Partial<MaterialCategory>) {
    return updateMaterialCategory(id, categoria)
  }

  static async deleteMaterialCategory(id: string) {
    return deleteMaterialCategory(id)
  }

  // Categorias (Legacy)
  static async getCategorias(userId: string) {
    return getCategorias(userId)
  }

  static async addCategoria(categoria: Omit<Categoria, "id" | "createdAt" | "updatedAt">, userId: string) {
    return addCategoria(categoria, userId)
  }

  static async updateCategoria(id: string, categoria: Partial<Categoria>) {
    return updateCategoria(id, categoria)
  }

  static async deleteCategoria(id: string) {
    return deleteCategoria(id)
  }

  // Serviços
  static async getServicos(userId: string) {
    return getServicos(userId)
  }

  static async addServico(servico: Omit<Servico, "id" | "createdAt" | "updatedAt">, userId: string) {
    return addServico(servico, userId)
  }

  static async updateServico(id: string, servico: Partial<Servico>) {
    return updateServico(id, servico)
  }

  static async deleteServico(id: string) {
    return deleteServico(id)
  }

  // Orçamentos
  static async getOrcamentos(userId: string) {
    return getOrcamentos(userId)
  }

  static async addOrcamento(orcamento: Omit<Orcamento, "id" | "createdAt" | "updatedAt">, userId: string) {
    return addOrcamento(orcamento, userId)
  }

  static async updateOrcamento(id: string, orcamento: Partial<Orcamento>) {
    return updateOrcamento(id, orcamento)
  }

  static async deleteOrcamento(id: string) {
    return deleteOrcamento(id)
  }

  // Termos de servico
  static async getTermosServico(userId: string, onlyActive: boolean = false) {
    return getTermosServico(userId, onlyActive)
  }

  // Dashboard
  static async getDashboardStats(userId: string) {
    return getDashboardStats(userId)
  }

  // Subscription
  static subscribeToCollection<T>(
    collectionName: string,
    userId: string,
    callback: (data: T[]) => void,
    orderByField?: string,
  ) {
    return subscribeToCollection<T>(collectionName, userId, callback, orderByField)
  }

  // Teste de conexão
  static async testConnection() {
    return testFirebaseConnection()
  }
}
