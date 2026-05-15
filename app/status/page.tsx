"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AlertCircle, CheckCircle, RefreshCw, Database } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { FirebaseService } from "@/lib/firebase-service"

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
            Status da Conexão
          </CardTitle>
          <CardDescription>
            Verifique a conexão com o banco de dados Firebase
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col items-center justify-center py-6 space-y-4">
            {status === 'loading' && (
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <RefreshCw className="h-10 w-10 animate-spin" />
                <p>Verificando conexão...</p>
              </div>
            )}

            {status === 'connected' && (
              <div className="flex flex-col items-center gap-2 text-green-500">
                <CheckCircle className="h-16 w-16" />
                <p className="text-xl font-medium">Conectado</p>
                <p className="text-sm text-muted-foreground text-center">
                  A comunicação com o banco de dados está funcionando corretamente.
                </p>
              </div>
            )}

            {status === 'error' && (
              <div className="flex flex-col items-center gap-2 text-red-500">
                <AlertCircle className="h-16 w-16" />
                <p className="text-xl font-medium">Erro de Conexão</p>
                <p className="text-sm text-muted-foreground text-center">
                  Não foi possível conectar ao banco de dados. Verifique sua internet ou as configurações do Firebase.
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
              {status === 'loading' ? 'Verificando...' : 'Testar Novamente'}
            </Button>
            
            {lastChecked && (
              <p className="text-xs text-center text-muted-foreground">
                Última verificação: {lastChecked.toLocaleTimeString()}
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
