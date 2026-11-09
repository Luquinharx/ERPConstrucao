/**
 * Verifica as traduções (Português de Portugal, Português do Brasil, English).
 *
 *   npx tsx scripts/verificar-traducoes.ts              # tudo
 *   npx tsx scripts/verificar-traducoes.ts app/login    # só os ficheiros cujo caminho contém o texto
 *
 * Falha (código 1) se:
 *  1. um t("...") ou m("...") não tiver tradução pt-BR e en no dicionário;
 *  2. a mesma chave estiver em dois ficheiros de textos com traduções diferentes;
 *  3. as variáveis {nome} da chave e das traduções não coincidirem;
 *  4. sobrar texto visível por traduzir no código (texto solto no JSX, atributos
 *     title/placeholder/aria-label/alt/description, toast, throw new Error, confirm/alert).
 */
import { readdirSync, readFileSync, statSync } from "fs"
import path from "path"

import { FICHEIROS_DE_TEXTOS, TEXTOS } from "../lib/i18n/textos"

const RAIZ = path.resolve(__dirname, "..")
const PASTAS = ["app", "components", "hooks", "lib"]
const IGNORAR = [/lib[\\/]i18n[\\/]/, /lib[\\/]server[\\/]/, /lib[\\/]db[\\/]/, /app[\\/]api[\\/]/, /\.d\.ts$/]
const filtro = process.argv[2]

function ficheiros(dir: string, lista: string[] = []): string[] {
  for (const nome of readdirSync(dir)) {
    const p = path.join(dir, nome)
    if (statSync(p).isDirectory()) ficheiros(p, lista)
    else if (/\.(ts|tsx)$/.test(nome) && !IGNORAR.some((r) => r.test(p))) lista.push(p)
  }
  return lista
}

/** Lê o literal de string que começa em s[i] (", ' ou `). Devolve [texto, fim] ou null se tiver ${}. */
function lerLiteral(s: string, i: number): [string, number] | null {
  const aspa = s[i]
  let j = i + 1
  let out = ""
  while (j < s.length && s[j] !== aspa) {
    if (s[j] === "\\") {
      const c = s[j + 1]
      out += c === "n" ? "\n" : c === "t" ? "\t" : c
      j += 2
      continue
    }
    if (aspa === "`" && s[j] === "$" && s[j + 1] === "{") return null
    out += s[j]
    j++
  }
  return [out, j]
}

const erros: string[] = []
const avisos: string[] = []
let chamadas = 0

// ---- 2 e 3: dicionários coerentes
const vistas = new Map<string, { ficheiro: string; br: string; en: string }>()
const vars = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",")
for (const [ficheiro, dic] of Object.entries(FICHEIROS_DE_TEXTOS)) {
  for (const [chave, tr] of Object.entries(dic)) {
    if (!tr || typeof tr["pt-BR"] !== "string" || typeof tr.en !== "string" || !tr["pt-BR"].trim() || !tr.en.trim()) {
      erros.push(`textos/${ficheiro}.ts: tradução vazia para ${JSON.stringify(chave)}`)
      continue
    }
    const v = vars(chave)
    if (vars(tr["pt-BR"]) !== v || vars(tr.en) !== v) erros.push(`textos/${ficheiro}.ts: variáveis {..} diferentes em ${JSON.stringify(chave)}`)
    const antes = vistas.get(chave)
    if (antes && (antes.br !== tr["pt-BR"] || antes.en !== tr.en)) {
      erros.push(`chave repetida com traduções diferentes em textos/${antes.ficheiro}.ts e textos/${ficheiro}.ts: ${JSON.stringify(chave)}`)
    }
    vistas.set(chave, { ficheiro, br: tr["pt-BR"], en: tr.en })
  }
}

// ---- 1 e 4: código
const PADRAO_CHAMADA = /\b(t|m)\(\s*(["'`])/g
const linhaDe = (s: string, i: number) => s.slice(0, i).split("\n").length

for (const f of ficheiros(RAIZ).filter((x) => PASTAS.some((p) => path.relative(RAIZ, x).startsWith(p)))) {
  const rel = path.relative(RAIZ, f).replace(/\\/g, "/")
  if (filtro && !rel.includes(filtro)) continue
  const s = readFileSync(f, "utf8")

  for (const m of s.matchAll(PADRAO_CHAMADA)) {
    const ini = m.index! + m[0].length - 1
    const lit = lerLiteral(s, ini)
    if (!lit) {
      erros.push(`${rel}:${linhaDe(s, ini)}: t(\`...\${}...\`) com interpolação de template - use t("... {nome} ...", { nome })`)
      continue
    }
    chamadas++
    const tr = TEXTOS[lit[0]]
    if (!tr) erros.push(`${rel}:${linhaDe(s, ini)}: sem tradução: ${JSON.stringify(lit[0])}`)
  }

  // Texto visível por traduzir (heurística)
  const semComentarios = s.replace(/\/\*[\s\S]*?\*\//g, (x) => x.replace(/[^\n]/g, " ")).replace(/(^|[^:"'`])\/\/.*$/gm, (x, a) => a + " ".repeat(x.length - a.length))
  const suspeitos: Array<[number, string]> = []
  if (rel.endsWith(".tsx")) {
    // texto solto entre tags: >Texto<
    for (const m of semComentarios.matchAll(/>([^<>{}]*[A-Za-zÀ-ÿ]{2,}[^<>{}]*)</g)) {
      const txt = m[1].trim()
      if (!txt || /^[\s\d.,:;%€$()+\-/*=|&#!?·•—–]+$/.test(txt)) continue
      if (/^(=>|&&|\|\|)/.test(txt) || /[=;]\s*$/.test(txt) || /^[a-z]+\s*=/.test(txt)) continue
      suspeitos.push([linhaDe(s, m.index!), txt])
    }
    // atributos com texto
    for (const m of semComentarios.matchAll(/\b(title|placeholder|aria-label|alt|description|label|texto|titulo|descricao|rotulo|vazio|placeholderBusca)=(["'])([^"']*[A-Za-zÀ-ÿ]{2,}[^"']*)\2/g)) {
      suspeitos.push([linhaDe(s, m.index!), `${m[1]}="${m[3]}"`])
    }
  }
  // toast / erros / confirm com literal
  for (const m of semComentarios.matchAll(/\b(title|description):\s*(["'`])([^"'`]*[A-Za-zÀ-ÿ]{3,}[^"'`]*)\2/g)) {
    suspeitos.push([linhaDe(s, m.index!), `${m[1]}: "${m[3]}"`])
  }
  for (const m of semComentarios.matchAll(/\b(new Error|confirm|alert)\(\s*(["'`])([^"'`]*[A-Za-zÀ-ÿ]{3,}[^"'`]*)\2/g)) {
    suspeitos.push([linhaDe(s, m.index!), `${m[1]}("${m[3]}")`])
  }
  for (const [linha, txt] of suspeitos) avisos.push(`${rel}:${linha}: por traduzir? ${txt.slice(0, 90)}`)
}

for (const a of avisos) console.log("AVISO  " + a)
for (const e of erros) console.log("ERRO   " + e)
console.log(`\n${chamadas} textos traduzíveis no código · ${Object.keys(TEXTOS).length} no dicionário · ${erros.length} erros · ${avisos.length} avisos`)
process.exit(erros.length || (process.argv.includes("--estrito") && avisos.length) ? 1 : 0)
