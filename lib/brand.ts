import type { ConfiguracaoEmpresa } from "./types"

/**
 * Identidade visual da empresa.
 *
 * Todos os valores sao parametrizaveis em Configuracoes e guardados no Firestore.
 * Os defaults abaixo seguem a marca TEC KNOW HOW (site institucional).
 */
export const CONFIGURACAO_PADRAO: ConfiguracaoEmpresa = {
  nome: "TEC KNOW HOW",
  slogan: "Construcao Civil e Remodelacoes",
  logoUrl: "/marca/logo-tecknowhow.png",
  logoFundo: "auto",

  // Laranja da marca (hsl 24 95% 53%), azul-marinho do simbolo e cinza escuro
  corPrimaria: "#F97316",
  corSecundaria: "#0F1073",
  corEscura: "#262626",
  fonte: "Montserrat",

  nif: "",
  morada: "",
  codigoPostal: "",
  cidade: "",
  telefone: "",
  email: "",
  website: "",

  prefixoOrcamento: "CO",
  validadeDiasPadrao: 30,
  margemPadrao: 20,
  taxaIVAPadrao: 23,

  notasOrcamento: [
    "A proposta so e valida na sua globalidade, reservando a empresa o direito de rever os valores em caso de adjudicacao parcial.",
    "Todos os trabalhos foram considerados em horario normal.",
    "Condicoes de pagamento: 50% na adjudicacao a P.P., 30% a meio dos trabalhos a P.P. e 20% no termo dos trabalhos a P.P. (P.P. = pronto pagamento).",
    "Os valores apresentados estao sujeitos a IVA a taxa legal em vigor.",
    "Em caso de itens nao valorizados na proposta, a pedido do cliente, serao apresentados valores a parte antes e/ou durante a obra.",
  ],
}

/** Fontes disponiveis, todas carregadas do Google Fonts. */
export const FONTES_DISPONIVEIS = [
  { id: "Montserrat", nome: "Montserrat", amostra: "Moderna e geometrica" },
  { id: "Inter", nome: "Inter", amostra: "Neutra, otima para ecra" },
  { id: "Roboto", nome: "Roboto", amostra: "Classica e legivel" },
  { id: "Open Sans", nome: "Open Sans", amostra: "Humanista e suave" },
  { id: "Poppins", nome: "Poppins", amostra: "Arredondada e amigavel" },
  { id: "Lato", nome: "Lato", amostra: "Serena e profissional" },
]

/** Paletas prontas, para quem nao quiser escolher cor a cor. */
export const PALETAS = [
  { nome: "TEC KNOW HOW", primaria: "#F97316", secundaria: "#0F1073", escura: "#262626" },
  { nome: "Azul corporativo", primaria: "#2563EB", secundaria: "#1E293B", escura: "#0F172A" },
  { nome: "Verde obra", primaria: "#16A34A", secundaria: "#14532D", escura: "#1C1917" },
  { nome: "Vermelho industrial", primaria: "#DC2626", secundaria: "#450A0A", escura: "#1C1917" },
  { nome: "Grafite", primaria: "#475569", secundaria: "#0F172A", escura: "#020617" },
]

/** Converte #RRGGBB para a tripla "H S% L%" usada pelas variaveis do Tailwind. */
export function hexParaHsl(hex: string): string {
  const limpo = (hex || "").replace("#", "").trim()
  if (limpo.length !== 6) return "24 95% 53%"

  const r = Number.parseInt(limpo.slice(0, 2), 16) / 255
  const g = Number.parseInt(limpo.slice(2, 4), 16) / 255
  const b = Number.parseInt(limpo.slice(4, 6), 16) / 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  let h = 0
  let s = 0

  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6
    else if (max === g) h = ((b - r) / d + 2) / 6
    else h = ((r - g) / d + 4) / 6
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`
}

/** Preto ou branco, conforme o que contrasta melhor com a cor de fundo. */
export function corDeTexto(hex: string): string {
  const limpo = (hex || "").replace("#", "").trim()
  if (limpo.length !== 6) return "#FFFFFF"
  const r = Number.parseInt(limpo.slice(0, 2), 16)
  const g = Number.parseInt(limpo.slice(2, 4), 16)
  const b = Number.parseInt(limpo.slice(4, 6), 16)
  // Luminancia relativa simplificada
  const luminancia = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminancia > 0.6 ? "#111111" : "#FFFFFF"
}

/**
 * Aplica a identidade ao documento: variaveis de cor do tema e a fonte.
 * Chamado no arranque e sempre que a configuracao muda.
 */

/**
 * Gera um favicon a partir das iniciais da empresa, quando nao ha logotipo.
 * Desenhado num canvas para nao depender de nenhum ficheiro.
 */
function faviconDasIniciais(nome: string, corFundo: string): string {
  if (typeof document === "undefined") return ""

  const canvas = document.createElement("canvas")
  canvas.width = 64
  canvas.height = 64
  const ctx = canvas.getContext("2d")
  if (!ctx) return ""

  const iniciais = (nome || "?")
    .split(/s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((palavra) => palavra[0])
    .join("")
    .toUpperCase()

  ctx.fillStyle = corFundo
  ctx.beginPath()
  ctx.roundRect(0, 0, 64, 64, 14)
  ctx.fill()

  ctx.fillStyle = corDeTexto(corFundo)
  ctx.font = "bold 30px system-ui, sans-serif"
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.fillText(iniciais, 32, 35)

  return canvas.toDataURL("image/png")
}

/** Aplica o titulo do separador e o icone do navegador. */
function aplicarTituloEIcone(config: ConfiguracaoEmpresa) {
  if (typeof document === "undefined") return

  const titulo = [config.nome, config.slogan].filter(Boolean).join(" - ")
  if (titulo) document.title = titulo

  let icone = ""
  try {
    icone = config.logoUrl || faviconDasIniciais(config.nome, config.corPrimaria)
  } catch {
    icone = ""
  }
  if (!icone) return

  let link = document.querySelector<HTMLLinkElement>("link[rel='icon']")
  if (!link) {
    link = document.createElement("link")
    link.rel = "icon"
    document.head.appendChild(link)
  }
  link.href = icone
}

export function aplicarIdentidade(config: ConfiguracaoEmpresa) {
  if (typeof document === "undefined") return

  const raiz = document.documentElement
  raiz.style.setProperty("--primary", hexParaHsl(config.corPrimaria))
  raiz.style.setProperty("--primary-foreground", corDeTexto(config.corPrimaria) === "#111111" ? "0 0% 7%" : "0 0% 100%")
  raiz.style.setProperty("--ring", hexParaHsl(config.corPrimaria))
  raiz.style.setProperty("--marca-primaria", config.corPrimaria)
  raiz.style.setProperty("--marca-secundaria", config.corSecundaria)
  raiz.style.setProperty("--marca-escura", config.corEscura)

  if (config.fonte) {
    const id = "fonte-da-marca"
    const href = `https://fonts.googleapis.com/css2?family=${config.fonte.replace(/ /g, "+")}:wght@400;500;600;700;800&display=swap`
    let link = document.getElementById(id) as HTMLLinkElement | null
    if (!link) {
      link = document.createElement("link")
      link.id = id
      link.rel = "stylesheet"
      document.head.appendChild(link)
    }
    if (link.href !== href) link.href = href
    raiz.style.setProperty("--fonte-da-marca", `'${config.fonte}', system-ui, sans-serif`)
    document.body.style.fontFamily = `var(--fonte-da-marca)`
  }

  aplicarTituloEIcone(config)
}
