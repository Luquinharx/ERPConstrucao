/**
 * Traduz os codigos de erro do Firebase Auth para linguagem corrente.
 *
 * Fica num ficheiro proprio para o ecra e o hook dizerem exatamente o mesmo:
 * antes o hook calculava a causa certa e o ecra mostrava por cima um
 * "Falha no login" generico, escondendo-a.
 */
export function mensagemDeErroAuth(erro: unknown, alternativa: string): string {
  const codigo = (erro as { code?: string })?.code

  switch (codigo) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      // O Firebase deixou de distinguir os tres, para nao revelar que contas existem
      return "Email ou palavra-passe incorretos."
    case "auth/invalid-email":
      return "O email nao tem um formato valido."
    case "auth/user-disabled":
      return "Esta conta foi desativada. Contacte quem administra o sistema."
    case "auth/too-many-requests":
      return "Demasiadas tentativas seguidas. Aguarde uns minutos e tente de novo."
    case "auth/network-request-failed":
      return "Sem ligacao ao servidor. Verifique a Internet e tente de novo."
    case "auth/email-already-in-use":
      return "Ja existe uma conta com este email. Entre em vez de criar outra."
    case "auth/weak-password":
      return "A palavra-passe e demasiado fraca. Use pelo menos 6 caracteres."
    case "auth/missing-password":
      return "Indique a palavra-passe."
    case "auth/requires-recent-login":
      return "Por seguranca, saia e volte a entrar antes de alterar as credenciais."
    case "auth/operation-not-allowed":
      return "O registo por email esta desativado no Firebase."
    default:
      return alternativa
  }
}
