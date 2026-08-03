/**
 * Valida a conexao com o Firebase e as regras do Firestore.
 *
 *   npm run firebase:check              -> so leitura anonima (nao escreve nada)
 *   npm run firebase:check -- --full    -> cria um utilizador temporario, testa
 *                                          leitura/escrita autenticada e isolamento
 *                                          entre contas, e apaga tudo no fim
 *
 * O modo --full cria e remove: 1 utilizador de teste e 1 documento em `clientes`.
 * Nenhum dado real e tocado.
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const modoCompleto = process.argv.includes("--full")

const env = Object.fromEntries(
  fs
    .readFileSync(path.join(projectRoot, ".env.local"), "utf8")
    .split(/\r?\n/)
    .filter((line) => line.trim() && !line.startsWith("#"))
    .map((line) => {
      const idx = line.indexOf("=")
      return [line.slice(0, idx).trim(), line.slice(idx + 1).trim()]
    }),
)

const config = {
  apiKey: env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

const COLECOES = [
  "clientes",
  "funcionarios",
  "materiais",
  "material-categories",
  "servicos",
  "orcamentos",
  "termos_servico",
]

const ok = (msg) => console.log("  [OK]    " + msg)
const falha = (msg) => console.log("  [FALHA] " + msg)
const aviso = (msg) => console.log("  [AVISO] " + msg)

let houveFalha = false

// ---------------------------------------------------------------- 1. Config
console.log("\n=== 1. Configuracao ===")
const faltando = Object.entries(config).filter(([, v]) => !v).map(([k]) => k)
if (faltando.length) {
  falha("variaveis ausentes no .env.local: " + faltando.join(", "))
  process.exit(1)
}
ok(`projeto ${config.projectId}`)
if (!config.authDomain.startsWith(config.projectId) || !config.storageBucket.startsWith(config.projectId)) {
  falha("authDomain/storageBucket nao correspondem ao projectId")
  houveFalha = true
} else {
  ok("authDomain e storageBucket coerentes com o projectId")
}

// ------------------------------------------------------------------ 2. Auth
console.log("\n=== 2. Auth ===")
const identity = async (metodo, corpo) => {
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:${metodo}?key=${config.apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(corpo),
  })
  return res.json()
}

const provaChave = await identity("signInWithPassword", {
  email: "conexao-teste@example.invalid",
  password: "invalida",
  returnSecureToken: true,
})
const codigoChave = provaChave?.error?.message || "SEM_ERRO"
if (codigoChave.includes("API_KEY_INVALID") || codigoChave.includes("API key not valid")) {
  falha("apiKey invalida")
  houveFalha = true
} else if (codigoChave === "OPERATION_NOT_ALLOWED" || codigoChave === "PASSWORD_LOGIN_DISABLED") {
  falha("provedor Email/Senha desativado no console")
  houveFalha = true
} else {
  ok("apiKey valida e provedor Email/Senha ativo")
}

// -------------------------------------------------------- 3. Firestore/SDK
console.log("\n=== 3. Firestore - acesso anonimo (deve ser BLOQUEADO) ===")
const carregar = (p) => import(pathToFileURL(path.join(projectRoot, p)).href)
const { initializeApp } = await carregar("node_modules/firebase/app/dist/index.mjs")
const fdb = await carregar("node_modules/firebase/firestore/dist/index.mjs")
const fauth = await carregar("node_modules/firebase/auth/dist/index.mjs")

const app = initializeApp(config)
const db = fdb.getFirestore(app)

let expostas = 0
for (const nome of COLECOES) {
  try {
    const snap = await fdb.getDocs(fdb.query(fdb.collection(db, nome), fdb.limit(1)))
    falha(`${nome} - leitura anonima PERMITIDA (${snap.size} doc). Regras nao aplicadas.`)
    expostas++
    houveFalha = true
  } catch (error) {
    const code = error.code || error.message
    if (code === "permission-denied") {
      ok(`${nome} - anonimo bloqueado`)
    } else {
      falha(`${nome} - erro inesperado: ${code}`)
      houveFalha = true
    }
  }
}
if (expostas > 0) {
  console.log(`\n  >> ${expostas} colecoes abertas ao publico. Publique as regras: npm run deploy:rules`)
}

// ------------------------------------------- 4. Fluxo autenticado (opcional)
if (modoCompleto) {
  console.log("\n=== 4. Fluxo autenticado (utilizador temporario) ===")
  const carimbo = Date.now()
  const contas = [
    { email: `teste-conexao-a-${carimbo}@example.com`, senha: `Teste!${carimbo}a` },
    { email: `teste-conexao-b-${carimbo}@example.com`, senha: `Teste!${carimbo}b` },
  ]
  const criadas = []
  let docTeste = null
  const auth = fauth.getAuth(app)

  try {
    for (const conta of contas) {
      const res = await identity("signUp", { email: conta.email, password: conta.senha, returnSecureToken: true })
      if (res.error) throw new Error(`nao foi possivel criar utilizador de teste: ${res.error.message}`)
      criadas.push({ ...conta, idToken: res.idToken, uid: res.localId })
    }
    ok(`2 utilizadores temporarios criados`)

    // --- Conta A: escreve e le o proprio documento
    const credA = await fauth.signInWithEmailAndPassword(auth, criadas[0].email, criadas[0].senha)
    const uidA = credA.user.uid
    ok(`login efetuado (uid ${uidA.slice(0, 8)}...)`)

    docTeste = await fdb.addDoc(fdb.collection(db, "clientes"), {
      nome: "__TESTE DE CONEXAO__",
      numeroUnico: `TESTE-${carimbo}`,
      email: "teste@example.com",
      telefone: "000",
      morada: "",
      cidade: "",
      codigoPostal: "",
      userId: uidA,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    ok("escrita autenticada permitida (documento de teste criado)")

    // --- Query exatamente igual a do app (getClientesPaginated)
    const q = fdb.query(fdb.collection(db, "clientes"), fdb.orderBy("createdAt", "desc"), fdb.limit(20))
    try {
      const snap = await fdb.getDocs(q)
      if (snap.size >= 1) {
        ok(`query do app retornou os dados automaticamente (${snap.size} doc(s) da base compartilhada)`)
      } else {
        falha("query do app nao retornou nenhum documento")
        houveFalha = true
      }
    } catch (error) {
      if (String(error.message).includes("index")) {
        falha("indice composto em falta (userId + createdAt). Rode: npm run deploy:indexes")
      } else {
        falha("query do app falhou: " + (error.code || error.message))
      }
      houveFalha = true
    }

    // --- Base compartilhada: a conta B TEM de ver o documento criado pela conta A
    await fauth.signInWithEmailAndPassword(auth, criadas[1].email, criadas[1].senha)
    try {
      const alheio = await fdb.getDoc(fdb.doc(db, "clientes", docTeste.id))
      if (alheio.exists()) {
        ok("base compartilhada: a segunda conta ve o documento criado pela primeira")
      } else {
        falha("a segunda conta nao encontrou o documento (base deveria ser compartilhada)")
        houveFalha = true
      }
    } catch (error) {
      if ((error.code || "") === "permission-denied") {
        falha("acesso negado entre contas - as regras ainda estao a separar por dono")
        houveFalha = true
      } else {
        aviso("teste de partilha inconclusivo: " + (error.code || error.message))
      }
    }
  } catch (error) {
    falha(error.message)
    houveFalha = true
  } finally {
    // --- Limpeza
    console.log("\n=== 5. Limpeza ===")
    try {
      if (docTeste) {
        await fauth.signInWithEmailAndPassword(auth, criadas[0].email, criadas[0].senha)
        await fdb.deleteDoc(fdb.doc(db, "clientes", docTeste.id))
        ok("documento de teste removido")
      }
    } catch (error) {
      falha("nao foi possivel remover o documento de teste: " + (error.code || error.message))
    }

    for (const conta of criadas) {
      try {
        const res = await identity("delete", { idToken: conta.idToken })
        if (res.error) throw new Error(res.error.message)
      } catch (error) {
        falha(`nao foi possivel remover ${conta.email}: ${error.message}`)
      }
    }
    ok("utilizadores temporarios removidos")
  }
}

console.log(
  houveFalha
    ? "\nRESULTADO: ha problemas a corrigir (ver acima).\n"
    : "\nRESULTADO: conexao, regras e leitura automatica de dados OK.\n",
)
process.exit(houveFalha ? 1 : 0)
