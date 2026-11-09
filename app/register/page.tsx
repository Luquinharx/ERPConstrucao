import { redirect } from "next/navigation"

/**
 * O registo livre foi desligado: as contas são criadas pelo administrador em
 * Utilizadores. Links antigos para /register vão para o login.
 */
export default function RegisterPage() {
  redirect("/login")
}
