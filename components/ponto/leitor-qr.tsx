"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Camera, CameraOff } from "lucide-react"

import { Button } from "@/components/ui/button"
import { toast } from "@/hooks/use-toast"
import { t } from "@/lib/i18n"

/**
 * Leitor de QR pela camera (o mesmo do Estoque > Bipar). Le uma vez e
 * desliga: na picagem so interessa o QR da obra.
 */
export function LeitorQR({ onLer, rotulo }: { onLer: (texto: string) => void; rotulo?: string }) {
  const [ligado, setLigado] = useState(false)
  const leitor = useRef<{ stop: () => Promise<void>; clear: () => void } | null>(null)
  const idElemento = useRef(`leitor-qr-${Math.random().toString(36).slice(2, 8)}`)

  const parar = useCallback(async () => {
    if (leitor.current) {
      await leitor.current.stop().catch(() => {})
      leitor.current.clear()
      leitor.current = null
    }
    setLigado(false)
  }, [])

  const ligar = async () => {
    try {
      setLigado(true)
      const { Html5Qrcode, Html5QrcodeSupportedFormats: F } = await import("html5-qrcode")
      const instancia = new Html5Qrcode(idElemento.current, { verbose: false, formatsToSupport: [F.QR_CODE] })
      await instancia.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        (texto) => {
          void parar()
          if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(80)
          onLer(texto)
        },
        () => {},
      )
      leitor.current = instancia
    } catch (erro) {
      setLigado(false)
      console.error(erro)
      toast({
        title: t("Não foi possível abrir a câmara"),
        description: t("Autorize a câmara no browser. A câmara só funciona em HTTPS."),
        variant: "destructive",
      })
    }
  }
  useEffect(() => () => void parar(), [parar])

  return (
    <div className="space-y-2">
      <div id={idElemento.current} className={ligado ? "overflow-hidden rounded-lg" : "hidden"} />
      <Button type="button" variant={ligado ? "outline" : "secondary"} className="w-full rounded-full" onClick={ligado ? parar : ligar}>
        {ligado ? <CameraOff className="mr-2 h-4 w-4" /> : <Camera className="mr-2 h-4 w-4" />}
        {ligado ? t("Fechar câmara") : rotulo || t("Ler QR da obra")}
      </Button>
    </div>
  )
}
