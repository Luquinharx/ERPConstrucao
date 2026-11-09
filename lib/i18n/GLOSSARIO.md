# Idiomas do sistema: regras e glossário

Três idiomas, cada um **puro** (nada misturado):

| Código | Nome | Ortografia |
|---|---|---|
| `pt-PT` | Português (Portugal) | Acordo Ortográfico de 1990, como em Portugal hoje (ação, ótimo, direção, receção, facto, contacto). Vocabulário de Portugal. Tratamento por "você" implícito (3.ª pessoa: "Indique o email", "Guarde as alterações"). |
| `pt-BR` | Português (Brasil) | Ortografia e vocabulário do Brasil (recepção, fato, contato, "você"). Imperativo brasileiro ("Informe o e-mail", "Salve as alterações"). |
| `en` | English | Inglês internacional, ortografia britânica (colour, labour, organise, cancelled). Frases curtas e claras. |

## Como se escreve no código

- O texto de origem é sempre **pt-PT correto** (com acentos e cedilhas): `t("Configurações")`, nunca `t("Configuracoes")`.
- `import { t, m } from "@/lib/i18n"`.
- `t("texto")` onde o texto aparece; `t("Olá, {nome}", { nome })` com variáveis (nunca template `${}` dentro de t, nunca concatenar frases aos bocados).
- Em constantes ao nível do módulo (listas de opções, rótulos de estados, colunas), **não** chamar `t()` (ficaria preso no idioma em que o módulo carregou): marcar com `m("texto")` e traduzir na apresentação com `t(item.rotulo)`.
- Plural: duas chaves e escolher no código (`n === 1 ? t("{n} produto", { n }) : t("{n} produtos", { n })`).
- Números, moeda e datas: `formatCurrency`, `formatNumber2`, `formatDate`, `formatDateTime`, `localeDateFns()` de `@/lib/utils` (seguem o idioma). Nunca `"pt-PT"` fixo em `Intl`/`toLocaleString`; usar `localeIntl()` de `@/lib/i18n`.
- Moeda é sempre o euro (EUR) nos três idiomas; só muda o formato.
- Dados gravados pelos utilizadores (nomes de clientes, produtos, notas, termos e condições escritos nas Configurações) **não** se traduzem.
- Códigos guardados na base (ex.: `estado: "pendente"`) não mudam; só o rótulo mostrado.
- Cada tradução vai para o ficheiro de textos da área (`lib/i18n/textos/<area>.ts`), com `pt-BR` e `en` sempre preenchidos (mesmo que o pt-BR seja igual ao pt-PT).
- Verificar: `npx tsx scripts/verificar-traducoes.ts <caminho>` — zero erros e zero avisos que sejam texto visível.

## Glossário (usar sempre estas palavras)

| pt-PT | pt-BR | en |
|---|---|---|
| Orçamento | Orçamento | Quote |
| Proposta | Proposta | Proposal |
| Obra | Obra | Job |
| Cliente | Cliente | Client |
| Funcionário | Funcionário | Employee |
| Função (de mão de obra) | Função | Trade |
| Mão de obra | Mão de obra | Labour |
| Produto | Produto | Product |
| Material / Materiais | Material / Materiais | Material / Materials |
| Stock | Estoque | Stock |
| Armazém | Depósito | Warehouse |
| Entrada / Saída / Ajuste (stock) | Entrada / Saída / Ajuste | Stock in / Stock out / Adjustment |
| Ler código de barras (o antigo "Bipar") | Bipar | Scan barcode |
| Etiquetas | Etiquetas | Labels |
| Categoria | Categoria | Category |
| Serviço | Serviço | Service |
| Cotação (a fornecedor) | Cotação | Supplier quote |
| Fornecedor | Fornecedor | Supplier |
| Fatura | Nota fiscal | Invoice |
| Fatura de fornecedor | Nota fiscal de fornecedor | Supplier invoice |
| IVA | IVA | VAT |
| NIF | NIF | Tax ID (NIF) |
| Código postal | Código postal | Postcode |
| Morada | Endereço | Address |
| Telemóvel | Celular | Mobile |
| Telefone | Telefone | Phone |
| Email | E-mail | Email |
| Utilizador | Usuário | User |
| Palavra-passe | Senha | Password |
| Iniciar sessão / Entrar | Entrar | Sign in |
| Terminar sessão / Sair | Sair | Sign out |
| Criar conta | Criar conta | Create account |
| Guardar | Salvar | Save |
| Eliminar | Excluir | Delete |
| Editar | Editar | Edit |
| Cancelar | Cancelar | Cancel |
| Adicionar / Novo | Adicionar / Novo | Add / New |
| Pesquisar | Pesquisar | Search |
| Filtrar | Filtrar | Filter |
| Transferir (download) | Baixar | Download |
| Carregar (upload) | Enviar | Upload |
| Ficheiro | Arquivo | File |
| Imprimir | Imprimir | Print |
| Ecrã | Tela | Screen |
| Equipa | Equipe | Team |
| Encarregado | Encarregado | Foreman |
| Picagem de ponto / Picar | Registro de ponto / Bater ponto | Time clock / Clock in |
| Ponto da equipa | Ponto da equipe | Team time clock |
| Livro de ponto | Folha de ponto | Timesheet |
| Registo | Registro | Record |
| Férias | Férias | Annual leave |
| Falta | Falta | Absence |
| Feriado | Feriado | Public holiday |
| Mapa de férias | Mapa de férias | Leave calendar |
| Turno / Pausa / Retoma | Turno / Pausa / Retorno | Shift / Break / Resume |
| Adjudicar / Adjudicada | Aprovar / Aprovada (pelo cliente) | Accept / Accepted |
| Rascunho | Rascunho | Draft |
| Pendente | Pendente | Pending |
| Aprovado / Recusado | Aprovado / Recusado | Approved / Rejected |
| Auto de medição | Medição | Progress measurement |
| Diário de obra | Diário de obra | Site diary |
| Garantia | Garantia | Warranty |
| Apuramento (da obra) | Apuração | Job costing |
| Contas a receber / a pagar | Contas a receber / a pagar | Receivables / Payables |
| Pagamento / Recebido | Pagamento / Recebido | Payment / Received |
| Custo / Preço de venda | Custo / Preço de venda | Cost / Sale price |
| Margem | Margem | Margin |
| Desconto | Desconto | Discount |
| Subtotal / Total | Subtotal / Total | Subtotal / Total |
| Quantidade / Unidade | Quantidade / Unidade | Quantity / Unit |
| Painel (dashboard) | Painel | Dashboard |
| Relatórios | Relatórios | Reports |
| Configurações | Configurações | Settings |
| Cargo / Permissões | Cargo / Permissões | Role / Permissions |
| Termos e condições | Termos e condições | Terms and conditions |
| Portal do cliente | Portal do cliente | Client portal |
| Telemóvel | Celular | Mobile phone |
| Câmara | Câmera | Camera |
| A carregar... | Carregando... | Loading... |
| A guardar... | Salvando... | Saving... |
