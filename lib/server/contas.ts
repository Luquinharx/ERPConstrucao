import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual, type BinaryLike, type ScryptOptions } from "crypto"
import { cookies } from "next/headers"

import { consultar } from "./pg"

/**
 * CONTAS E SESSOES
 *
 * - Palavras-passe com scrypt (N=2^15), nunca em texto.
 * - Sessao num cookie httpOnly com um token aleatorio; na base so fica o hash
 *   do token, para uma copia da base nao dar sessoes validas.
 * - Contas vindas do Firebase: no primeiro login a palavra-passe confirma-se
 *   no Firebase Auth e, se estiver certa, passa a ser guardada aqui. Assim
 *   ninguem tem de criar uma palavra-passe nova com a mudanca.
 */

export const COOKIE_SESSAO = "erp_sessao"
const DURACAO_SESSAO_DIAS = 30

export interface UtilizadorSessao {
  uid: string
  email: string
  displayName: string | null
}

export class ErroAuth extends Error {
  constructor(
    public code: string,
    message = code,
  ) {
    super(message)
  }
}

// ------------------------------------------------------------ Palavras-passe

const scrypt = (senha: BinaryLike, sal: BinaryLike, tamanho: number, opcoes: ScryptOptions) =>
  new Promise<Buffer>((ok, falha) => scryptCb(senha, sal, tamanho, opcoes, (e, chave) => (e ? falha(e) : ok(chave))))

const OPCOES_SCRYPT = { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }

export async function cifrarSenha(senha: string): Promise<string> {
  const sal = randomBytes(16)
  const chave = await scrypt(senha.normalize("NFKC"), sal, 64, OPCOES_SCRYPT)
  return `scrypt$${sal.toString("base64")}$${chave.toString("base64")}`
}

export async function confirmarSenha(senha: string, guardado: string): Promise<boolean> {
  const [algoritmo, sal64, chave64] = guardado.split("$")
  if (algoritmo !== "scrypt" || !sal64 || !chave64) return false
  const esperado = Buffer.from(chave64, "base64")
  const chave = await scrypt(senha.normalize("NFKC"), Buffer.from(sal64, "base64"), esperado.length, OPCOES_SCRYPT)
  return chave.length === esperado.length && timingSafeEqual(chave, esperado)
}

export function validarSenhaNova(senha: unknown): string {
  if (typeof senha !== "string" || senha.length === 0) throw new ErroAuth("auth/missing-password")
  if (senha.length < 6) throw new ErroAuth("auth/weak-password")
  if (senha.length > 200) throw new ErroAuth("auth/weak-password")
  return senha
}

export function validarEmail(email: unknown): string {
  const e = typeof email === "string" ? email.trim() : ""
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) || e.length > 200) throw new ErroAuth("auth/invalid-email")
  return e
}

// ------------------------------------------------------------ Tentativas falhadas

const tentativas = new Map<string, { n: number; desde: number }>()
const JANELA_MS = 15 * 60_000
const MAX_FALHAS = 10

function bloqueado(chave: string): boolean {
  const t = tentativas.get(chave)
  if (!t) return false
  if (Date.now() - t.desde > JANELA_MS) {
    tentativas.delete(chave)
    return false
  }
  return t.n >= MAX_FALHAS
}

function registarFalha(chave: string) {
  const t = tentativas.get(chave)
  if (!t || Date.now() - t.desde > JANELA_MS) tentativas.set(chave, { n: 1, desde: Date.now() })
  else t.n++
}

// ------------------------------------------------------------ Contas

interface LinhaConta {
  uid: string
  email: string
  nome: string | null
  hash: string | null
  firebase: boolean
  desativada: boolean
}

export function paraUtilizador(c: Pick<LinhaConta, "uid" | "email" | "nome">): UtilizadorSessao {
  return { uid: c.uid, email: c.email, displayName: c.nome }
}

export async function contaPorEmail(email: string): Promise<LinhaConta | null> {
  const [c] = await consultar<LinhaConta>("SELECT * FROM contas WHERE lower(email) = lower($1)", [email])
  return c || null
}

export async function contaPorUid(uid: string): Promise<LinhaConta | null> {
  const [c] = await consultar<LinhaConta>("SELECT * FROM contas WHERE uid = $1", [uid])
  return c || null
}

function novoUid(): string {
  // 28 letras, como os uid do Firebase (os antigos mantem-se)
  const letras = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
  return Array.from(randomBytes(28), (b) => letras[b % letras.length]).join("")
}

export async function criarConta(email: string, senha: string, nome?: string | null): Promise<LinhaConta> {
  validarEmail(email)
  validarSenhaNova(senha)
  if (await contaPorEmail(email)) throw new ErroAuth("auth/email-already-in-use")
  const hash = await cifrarSenha(senha)
  const [c] = await consultar<LinhaConta>(
    "INSERT INTO contas (uid, email, nome, hash) VALUES ($1, $2, $3, $4) RETURNING *",
    [novoUid(), email.trim(), nome || null, hash],
  )
  return c
}

/**
 * Confirma email e palavra-passe no Firebase Auth (contas ainda nao migradas).
 * Devolve o uid do Firebase, ou null se estiver errada.
 */
async function confirmarNoFirebase(email: string, senha: string): Promise<{ uid: string; nome: string | null } | null> {
  const chave = process.env.FIREBASE_API_KEY || process.env.NEXT_PUBLIC_FIREBASE_API_KEY
  if (!chave) return null
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(chave)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: senha, returnSecureToken: false }),
  }).catch(() => null)
  if (!r) throw new ErroAuth("auth/network-request-failed")
  const corpo = await r.json().catch(() => ({}))
  if (r.ok && corpo.localId) return { uid: corpo.localId, nome: corpo.displayName || null }
  const msg: string = corpo?.error?.message || ""
  if (msg.startsWith("USER_DISABLED")) throw new ErroAuth("auth/user-disabled")
  if (msg.startsWith("TOO_MANY_ATTEMPTS")) throw new ErroAuth("auth/too-many-requests")
  return null
}

/** Login com email e palavra-passe. Erros com os mesmos codigos do Firebase. */
export async function autenticar(emailBruto: unknown, senha: unknown, ip: string): Promise<LinhaConta> {
  const email = validarEmail(emailBruto)
  if (typeof senha !== "string" || !senha) throw new ErroAuth("auth/missing-password")
  const chaveFalhas = `${ip}|${email.toLowerCase()}`
  if (bloqueado(chaveFalhas) || bloqueado(email.toLowerCase())) throw new ErroAuth("auth/too-many-requests")

  const conta = await contaPorEmail(email)
  if (conta?.desativada) throw new ErroAuth("auth/user-disabled")

  if (conta?.hash) {
    if (await confirmarSenha(senha, conta.hash)) return conta
  } else if (conta?.firebase) {
    // Conta trazida do Firebase e ainda sem palavra-passe aqui: confirma lá uma vez.
    // Emails que só existem no Firebase NÃO entram: contas novas só pelo administrador.
    const fb = await confirmarNoFirebase(email, senha)
    if (fb && conta.uid === fb.uid) {
      const [c] = await consultar<LinhaConta>(
        "UPDATE contas SET hash = $2, firebase = false, nome = coalesce(nome, $3), atualizado_em = now() WHERE uid = $1 RETURNING *",
        [conta.uid, await cifrarSenha(senha), fb.nome],
      )
      return c
    }
  }

  registarFalha(chaveFalhas)
  registarFalha(email.toLowerCase())
  throw new ErroAuth("auth/invalid-credential")
}

export async function mudarSenha(uid: string, nova: string): Promise<void> {
  validarSenhaNova(nova)
  await consultar("UPDATE contas SET hash = $2, firebase = false, atualizado_em = now() WHERE uid = $1", [uid, await cifrarSenha(nova)])
}

// ------------------------------------------------------------ Sessoes

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex")

export async function abrirSessao(uid: string): Promise<void> {
  const token = randomBytes(32).toString("base64url")
  const expira = new Date(Date.now() + DURACAO_SESSAO_DIAS * 86_400_000)
  await consultar("INSERT INTO sessoes (id, uid, expira_em) VALUES ($1, $2, $3)", [hashToken(token), uid, expira])
  // Limpeza de sessoes expiradas, de vez em quando
  if (Math.random() < 0.05) await consultar("DELETE FROM sessoes WHERE expira_em < now()").catch(() => undefined)
  const jar = await cookies()
  jar.set(COOKIE_SESSAO, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expira,
  })
}

export async function fecharSessao(): Promise<void> {
  const jar = await cookies()
  const token = jar.get(COOKIE_SESSAO)?.value
  if (token) await consultar("DELETE FROM sessoes WHERE id = $1", [hashToken(token)]).catch(() => undefined)
  jar.delete(COOKIE_SESSAO)
}

/** Termina as sessoes de uma conta noutros aparelhos (ao mudar a palavra-passe). */
export async function fecharOutrasSessoes(uid: string): Promise<void> {
  const jar = await cookies()
  const token = jar.get(COOKIE_SESSAO)?.value
  await consultar("DELETE FROM sessoes WHERE uid = $1 AND id <> $2", [uid, token ? hashToken(token) : ""])
}

/** Conta da sessao atual, ou null. */
export async function contaDaSessao(): Promise<LinhaConta | null> {
  const jar = await cookies()
  const token = jar.get(COOKIE_SESSAO)?.value
  if (!token) return null
  const [c] = await consultar<LinhaConta>(
    `SELECT c.* FROM sessoes s JOIN contas c ON c.uid = s.uid
     WHERE s.id = $1 AND s.expira_em > now() AND NOT c.desativada`,
    [hashToken(token)],
  )
  return c || null
}

export async function uidDaSessao(): Promise<string | null> {
  return (await contaDaSessao())?.uid || null
}

// ------------------------------------------------------------ Recuperacao

export async function criarTokenRecuperacao(uid: string): Promise<string> {
  const token = randomBytes(32).toString("base64url")
  await consultar("INSERT INTO tokens_recuperacao (id, uid, expira_em) VALUES ($1, $2, now() + interval '1 hour')", [
    hashToken(token),
    uid,
  ])
  return token
}

export async function usarTokenRecuperacao(token: string): Promise<string | null> {
  const [t] = await consultar<{ uid: string }>(
    `UPDATE tokens_recuperacao SET usado = true
     WHERE id = $1 AND NOT usado AND expira_em > now() RETURNING uid`,
    [hashToken(token)],
  )
  return t?.uid || null
}
