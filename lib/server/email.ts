import nodemailer from "nodemailer"

/**
 * Envio de emails (recuperar a palavra-passe).
 *
 * Usa a caixa de email do dominio (ex.: noreply@tecknowhow.pt na Hostinger).
 * Sem SMTP_HOST configurado, o envio fica desligado e o ecra explica que e
 * preciso pedir a palavra-passe nova a quem administra o sistema.
 */
export function emailConfigurado(): boolean {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS)
}

export async function enviarEmail(para: string, assunto: string, texto: string, html: string): Promise<void> {
  const porta = Number(process.env.SMTP_PORT || 465)
  const transporte = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: porta,
    secure: porta === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  })
  await transporte.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: para,
    subject: assunto,
    text: texto,
    html,
  })
}
