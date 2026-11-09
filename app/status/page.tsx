"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AlertCircle, CheckCircle, RefreshCw, Database } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { FirebaseService } from "@/lib/firebase-service"
import { localeIntl, t } from "@/lib/i18n"

export default function StatusPage() {
  const [status, setStatus] = useState<'loading' | 'connected' | 'error'>('loading')
  const [lastChecked, setLastChecked] = useState<Date | null>(null)

  const checkConnection = async () => {
    setStatus('loading')
    try {
      const isConnected = await FirebaseService.testConnection()
      if (isConnected) {
        setStatus('connected')
      } else {
        setStatus('error')
      }
    } catch (error) {
      console.error("Erro ao verificar conexão:", error)
      setStatus('error')
    } finally {
      setLastChecked(new Date())
    }
  }

  useEffect(() => {
    checkConnection()
  }, [])

  return (
    <div className="container mx-auto py-10 flex justify-center items-center min-h-[60vh]">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-6 w-6" />
            {t("Estado da ligação")}
          </CardTitle>
          <CardDescription>
            {t("Verifique a ligação à base de dados")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col items-center justify-center py-6 space-y-4">
            {status === 'loading' && (
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <RefreshCw className="h-10 w-10 animate-spin" />
                <p>{t("A verificar a ligação...")}</p>
              </div>
            )}

            {status === 'connected' && (
              <div className="flex flex-col items-center gap-2 text-green-500">
                <CheckCircle className="h-16 w-16" />
                <p className="text-xl font-medium">{t("Ligado")}</p>
                <p className="text-sm text-muted-foreground text-center">
                  {t("A comunicação com a base de dados está a funcionar corretamente.")}
                </p>
              </div>
            )}

            {status === 'error' && (
              <div className="flex flex-col items-center gap-2 text-red-500">
                <AlertCircle className="h-16 w-16" />
                <p className="text-xl font-medium">{t("Erro de ligação")}</p>
                <p className="text-sm text-muted-foreground text-center">
                  {t("Não foi possível ligar à base de dados. Verifique a Internet ou a configuração do servidor.")}
                </p>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Button 
              className="w-full" 
              onClick={checkConnection} 
              disabled={status === 'loading'}
            >
              {status === 'loading' ? t("A verificar...") : t("Testar de novo")}
            </Button>
            
            {lastChecked && (
              <p className="text-xs text-center text-muted-foreground">
                {t("Última verificação: {hora}", { hora: lastChecked.toLocaleTimeString(localeIntl()) })}
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
