"use client"

import type React from "react"
import { Suspense } from "react"
import dynamic from "next/dynamic"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/toaster"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { QueryClientProvider } from "@tanstack/react-query"
import { queryClient } from "@/lib/react-query"
import { ConfiguracaoProvider } from "@/hooks/use-configuracao"

// Lazy load AuthProvider para evitar problemas de timeout
const AuthProvider = dynamic(
  () => import("@/hooks/use-auth").then(mod => ({ default: mod.AuthProvider })),
  { 
    ssr: false,
    loading: () => (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }
)

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <QueryClientProvider client={queryClient}>
        <Suspense fallback={
          <div className="min-h-screen flex items-center justify-center">
            <LoadingSpinner size="lg" />
          </div>
        }>
          <AuthProvider>
            <ConfiguracaoProvider>
              {children}
              <Toaster />
            </ConfiguracaoProvider>
          </AuthProvider>
        </Suspense>
      </QueryClientProvider>
    </ThemeProvider>
  )
}
