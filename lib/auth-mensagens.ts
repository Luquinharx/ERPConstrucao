/**
 * Traduz os codigos de erro dos logins (os mesmos que o Firebase Auth usava,
 * que o servidor em /api/auth manteve) para linguagem corrente.
 *
 * Fica num ficheiro proprio para o ecra e o hook dizerem exatamente o mesmo:
 * antes o hook calculava a causa certa e o ecra mostrava por cima um
 * "Falha no login" generico, escondendo-a.
 */
import { t } from "@/lib/i18n"

export function mensagemDeErroAuth(erro: unknown, alternativa: string): string {
  const codigo = (erro as { code?: string })?.code

  switch (codigo) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      // O Firebase deixou de distinguir os tres, para nao revelar que contas existem
      return t("Email ou palavra-passe incorretos.")
    case "auth/invalid-email":
      return t("O email não tem um formato válido.")
    case "auth/user-disabled":
      return t("Esta conta foi desativada. Contacte quem administra o sistema.")
    case "auth/too-many-requests":
      return t("Demasiadas tentativas seguidas. Aguarde uns minutos e tente de novo.")
    case "auth/network-request-failed":
      return t("Sem ligação ao servidor. Verifique a Internet e tente de novo.")
    case "auth/email-already-in-use":
      return t("Já existe uma conta com este email. Entre em vez de criar outra.")
    case "auth/weak-password":
      return t("A palavra-passe é demasiado fraca. Use pelo menos 6 caracteres.")
    case "auth/missing-password":
      return t("Indique a palavra-passe.")
    case "auth/requires-recent-login":
      return t("Por segurança, saia e volte a entrar antes de alterar as credenciais.")
    case "auth/operation-not-allowed":
      return t("Esta operação está desativada.")
    case "auth/sem-email":
      return t("O envio de emails ainda não está ligado. Peça a quem administra o sistema uma palavra-passe nova.")
    case "auth/link-invalido":
      return t("O link expirou ou já foi usado. Peça um link novo.")
    case "auth/internal-error":
      return t("Erro no servidor. Tente de novo dentro de momentos.")
    default:
      return alternativa
  }
}
