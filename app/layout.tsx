import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { Providers } from "./providers"

const inter = Inter({ subsets: ["latin"] })

/**
 * Titulo e icone neutros: a identidade real (nome da empresa, logotipo e cores)
 * e aplicada em tempo de execucao a partir de Configuracoes, para o sistema
 * poder ser usado por qualquer empresa sem tocar no codigo.
 */
export const metadata: Metadata = {
  title: "Sistema de Orcamentos",
  description: "Orcamentos, composicao de precos e gestao de obra.",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
