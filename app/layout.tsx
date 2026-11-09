import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import { cookies, headers } from "next/headers"
import "./globals.css"
import { Providers } from "./providers"
import { COOKIE_IDIOMA, ehIdioma, idiomaDoNavegador, t } from "@/lib/i18n"

const inter = Inter({ subsets: ["latin"] })

/** Idioma do pedido: o escolhido (cookie) ou, na primeira visita, o do browser. */
async function idiomaDoPedido() {
  const escolhido = (await cookies()).get(COOKIE_IDIOMA)?.value
  if (ehIdioma(escolhido)) return { idioma: escolhido, escolhido: true }
  return { idioma: idiomaDoNavegador((await headers()).get("accept-language")), escolhido: false }
}

/**
 * Título e ícone neutros: a identidade real (nome da empresa, logótipo e cores)
 * é aplicada em tempo de execução a partir das Configurações, para o sistema
 * poder ser usado por qualquer empresa sem tocar no código.
 */
export async function generateMetadata(): Promise<Metadata> {
  const { idioma } = await idiomaDoPedido()
  return {
    title: t("Sistema de Orçamentos", undefined, idioma),
    description: t("Orçamentos, composição de preços e gestão de obra.", undefined, idioma),
  }
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const { idioma, escolhido } = await idiomaDoPedido()
  return (
    <html lang={idioma} suppressHydrationWarning>
      <body className={inter.className}>
        <Providers idioma={idioma} idiomaEscolhido={escolhido}>{children}</Providers>
      </body>
    </html>
  )
}
