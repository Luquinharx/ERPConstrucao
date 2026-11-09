import { NextResponse, type NextRequest } from "next/server"

import {
  ErroAuth,
  abrirSessao,
  autenticar,
  contaDaSessao,
  contaPorEmail,
  criarConta,
  criarTokenRecuperacao,
  fecharOutrasSessoes,
  fecharSessao,
  mudarSenha,
  paraUtilizador,
  usarTokenRecuperacao,
  validarEmail,
  validarSenhaNova,
} from "@/lib/server/contas"
import { pedinteDe } from "@/lib/server/documentos"
import { emailConfigurado, enviarEmail } from "@/lib/server/email"
import { consultar } from "@/lib/server/pg"
import { COOKIE_IDIOMA, ehIdioma, idiomaDoNavegador, t } from "@/lib/i18n"

export const dynamic = "force-dynamic"

const ok = (corpo: Record<string, unknown> = {}) => NextResponse.json({ ok: true, ...corpo })
const falha = (code: string, estado = 400) => NextResponse.json({ erro: { code } }, { status: estado })

function ipDe(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || "local"
}

function origemDe(req: NextRequest): string {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "")
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || req.nextUrl.host
  const proto = req.headers.get("x-forwarded-proto") || req.nextUrl.protocol.replace(":", "")
  return `${proto}://${host}`
}

/** Sessao atual (o hook use-auth chama ao abrir a aplicacao). */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ acao: string }> }) {
  const { acao } = await params
  if (acao !== "sessao") return falha("not-found", 404)
  try {
    const conta = await contaDaSessao()
    return NextResponse.json({ user: conta ? paraUtilizador(conta) : null })
  } catch (e) {
    console.error("[api/auth/sessao]", e)
    return falha("auth/network-request-failed", 503)
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ acao: string }> }) {
  const { acao } = await params
  if (!req.headers.get("content-type")?.includes("application/json")) return falha("invalid-argument", 415)
  const corpo = (await req.json().catch(() => ({}))) as Record<string, any>

  try {
    switch (acao) {
      case "entrar": {
        const conta = await autenticar(corpo.email, corpo.senha, ipDe(req))
        await abrirSessao(conta.uid)
        return ok({ user: paraUtilizador(conta) })
      }

      case "sair":
        await fecharSessao()
        return ok()

      case "registar": {
        const conta = await criarConta(validarEmail(corpo.email), validarSenhaNova(corpo.senha), corpo.nome)
        await abrirSessao(conta.uid)
        return ok({ user: paraUtilizador(conta) })
      }

      case "perfil": {
        const conta = await contaDaSessao()
        if (!conta) return falha("auth/requires-recent-login", 401)
        const nome = String(corpo.nome || "").trim().slice(0, 120)
        await consultar("UPDATE contas SET nome = $2, atualizado_em = now() WHERE uid = $1", [conta.uid, nome || null])
        return ok({ user: paraUtilizador({ ...conta, nome: nome || null }) })
      }

      case "palavra-passe": {
        const conta = await contaDaSessao()
        if (!conta) return falha("auth/requires-recent-login", 401)
        // Confirma que e mesmo a pessoa antes de mexer nas credenciais
        await autenticar(conta.email, corpo.atual, ipDe(req))
        await mudarSenha(conta.uid, validarSenhaNova(corpo.nova))
        await fecharOutrasSessoes(conta.uid)
        return ok()
      }

      case "email": {
        const conta = await contaDaSessao()
        if (!conta) return falha("auth/requires-recent-login", 401)
        await autenticar(conta.email, corpo.senha, ipDe(req))
        const novo = validarEmail(corpo.novoEmail)
        const outra = await contaPorEmail(novo)
        if (outra && outra.uid !== conta.uid) return falha("auth/email-already-in-use")
        await consultar("UPDATE contas SET email = $2, atualizado_em = now() WHERE uid = $1", [conta.uid, novo])
        // O perfil mostra o email na lista de utilizadores: acompanha a conta
        await consultar(
          `UPDATE documentos SET dados = jsonb_set(dados, '{email}', to_jsonb($2::text)), versao = versao + 1, atualizado_em = now()
           WHERE colecao = 'utilizadores' AND id = $1`,
          [conta.uid, novo],
        )
        return ok({ user: paraUtilizador({ ...conta, email: novo }) })
      }

      case "recuperar": {
        const email = validarEmail(corpo.email)
        if (!emailConfigurado()) return falha("auth/sem-email")
        const conta = await contaPorEmail(email)
        // Responde igual exista ou nao a conta, para nao revelar quem tem conta
        if (conta && !conta.desativada) {
          const token = await criarTokenRecuperacao(conta.uid)
          const link = `${origemDe(req)}/recuperar-palavra-passe?token=${token}`
          // No idioma escolhido no aparelho de quem pediu
          const cookieIdioma = req.cookies.get(COOKIE_IDIOMA)?.value
          const idioma = ehIdioma(cookieIdioma) ? cookieIdioma : idiomaDoNavegador(req.headers.get("accept-language"))
          const tr = (texto: string) => t(texto, undefined, idioma)
          await enviarEmail(
            conta.email,
            tr("Definir uma palavra-passe nova"),
            `${tr("Para definir uma palavra-passe nova, abra este link (válido durante 1 hora):")}\n\n${link}\n\n${tr("Se não pediu isto, ignore este email.")}`,
            `<p>${tr("Para definir uma palavra-passe nova, abra este link (válido durante 1 hora):")}</p>
             <p><a href="${link}">${tr("Definir uma palavra-passe nova")}</a></p>
             <p style="color:#666">${tr("Se não pediu isto, ignore este email.")}</p>`,
          )
        }
        return ok()
      }

      case "redefinir": {
        const nova = validarSenhaNova(corpo.senha)
        const uid = typeof corpo.token === "string" ? await usarTokenRecuperacao(corpo.token) : null
        if (!uid) return falha("auth/link-invalido")
        await mudarSenha(uid, nova)
        await consultar("DELETE FROM sessoes WHERE uid = $1", [uid])
        return ok()
      }

      /**
       * Conta de picagem de um trabalhador (n.o + PIN), criada pelo gestor.
       * So cria a conta de login; o perfil e o acesso gravam-se depois pela
       * base de dados, com as regras de sempre.
       */
      case "conta-ponto": {
        const conta = await contaDaSessao()
        if (!conta) return falha("permission-denied", 403)
        const { perfil } = await pedinteDe(conta.uid)
        const permissoes: string[] = perfil?.ativo === true && Array.isArray(perfil.permissoes) ? perfil.permissoes : []
        if (!permissoes.includes("ponto.gerir") && !permissoes.includes("funcionarios.gerir")) {
          return falha("permission-denied", 403)
        }
        const nova = await criarConta(validarEmail(corpo.email), String(corpo.senha || ""), corpo.nome)
        return ok({ uid: nova.uid })
      }

      default:
        return falha("not-found", 404)
    }
  } catch (e) {
    if (e instanceof ErroAuth) return falha(e.code, e.code === "auth/too-many-requests" ? 429 : 400)
    console.error(`[api/auth/${acao}]`, e)
    return falha("auth/internal-error", 500)
  }
}
