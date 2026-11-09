/**
 * Formato dos ficheiros de textos (lib/i18n/textos/*.ts).
 *
 * A chave é o texto em português de Portugal, exatamente como está no código.
 * Cada entrada tem a versão do Brasil e a inglesa (mesmo quando a do Brasil é
 * igual à de Portugal, escreve-se na mesma: o verificador exige as duas).
 */
export type Dicionario = Record<string, { "pt-BR": string; en: string }>
