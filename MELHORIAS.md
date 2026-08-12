# Melhorias Aplicadas — ERP Construção

Data: 30/07/2026
Branch: `master` · Build: `npm run build` ✅ compila sem erros novos

---

## Índice

| # | Task | Módulo | Status |
|---|------|--------|--------|
| 1 | Busca + Voltar nas listagens | Geral | ✅ Feito |
| 2 | Busca automática ao puxar os dados | Geral | ✅ Feito |
| 3 | Nome e descrição do item | Orçamentos | ✅ Feito |
| 4 | Transporte no final do orçamento | Orçamentos | ✅ Feito |
| 5 | Diferenciar orçamento de Custo e de Venda | Orçamentos | ✅ Feito |
| 6 | Travar valores em 2 casas decimais | Orçamentos / Geral | ✅ Feito |
| 7 | Regra para itens que não multiplicam por m² | Orçamentos / Serviços | ✅ Feito |
| 8 | Ocultar nome do funcionário | Orçamentos | ✅ Feito |
| 9 | Botão Duplicar Mão de Obra | Orçamentos | ✅ Feito |
| 10 | **URGENTE** Cálculo de horas errado | Funcionários | ✅ Corrigido |
| 11 | Aba Encargo Líquido | Funcionários | ✅ Feito |

---

## Arquivos criados

| Arquivo | Função |
|---------|--------|
| `hooks/use-search-query.ts` | Termo de busca sincronizado com a URL (`?q=`), sem exigir Suspense no build |
| `components/ui/list-toolbar.tsx` | Barra padrão das listagens: Voltar + busca + limpar + contador de resultados |
| `MELHORIAS.md` | Este documento |

## Arquivos alterados

`lib/utils.ts` · `lib/types.ts` · `app/funcionarios/page.tsx` · `app/orcamentos/page.tsx` · `app/servicos/page.tsx` · `app/materiais/page.tsx` · `app/clientes/page.tsx` · `app/categorias/page.tsx` · `app/termos/page.tsx`

---

# 🛠️ Geral e Interface

## Task 1 — Buscar e Voltar nas listagens ✅

**Antes:** Clientes, Categorias e Termos não tinham busca nenhuma. Materiais, Serviços e Orçamentos tinham buscas diferentes entre si, cada uma com seu layout. Nenhuma tela tinha botão Voltar.

**Como foi feito:** criado o componente único `ListToolbar` (`components/ui/list-toolbar.tsx`), aplicado em **todas** as listagens:

- **Botão Voltar** — `router.back()`, com opção de rota fixa via prop `backHref`
- **Campo de busca** — filtra enquanto digita, sem botão de pesquisar
- **Botão Limpar (X)** — aparece dentro do campo quando há texto
- **Contador** — "12 resultados de 40 para "tinta""
- **Persistência na URL** — o termo vai para `?q=...` via `history.replaceState`; ao sair e voltar para a tela, a busca continua aplicada e o link pode ser compartilhado

A busca ignora acentos e maiúsculas (`normalizeSearch` / `matchesSearch` em `lib/utils.ts`), então "servico" encontra "Serviço".

**Campos pesquisáveis por tela:**

| Tela | Campos |
|------|--------|
| Orçamentos | número, cliente, email, telefone, cidade, NIF, status |
| Funcionários | nome, email, telefone, função, departamento, nº funcionário, cidade |
| Clientes | nome, email, telefone, código único, morada, cidade, código postal, NIF, observações |
| Materiais | nome, fornecedor, unidade, observações, categoria |
| Serviços | nome, descrição, unidade, categoria |
| Categorias | nome, descrição |
| Termos | título, conteúdo, tipo, ativo/inativo |

Cada tela também ganhou estado vazio próprio para busca sem resultado ("Nenhum resultado para X" + botão Limpar), separado do estado "nada cadastrado".

## Task 2 — Busca automática ao puxar os dados ✅

**Antes:** em Clientes a lista era paginada de 20 em 20 por scroll infinito — uma busca só encontraria o que já tinha sido carregado.

**Como foi feito:**
- O filtro é aplicado em memória sobre os dados carregados, então passa a valer sozinho assim que os dados chegam do Firebase — sem clicar em pesquisar
- Em **Clientes**, quando há um termo ativo e ainda existem páginas por carregar, o sistema busca as páginas restantes automaticamente (`app/clientes/page.tsx`), garantindo que a pesquisa cubra a base inteira e não só a primeira página
- Ao entrar numa tela com `?q=` na URL, o termo é aplicado assim que os dados carregam

---

# 📄 Módulo de Orçamentos

## Task 3 — Nome e descrição do item ✅

**Antes:** o item tinha só um campo `descricao`, preenchido automaticamente como "Pintura (Interior)" e não editável.

**Como foi feito:** `ItemOrcamento` ganhou o campo `nome` separado da `descricao` (`lib/types.ts`). No formulário, cada item agora tem:
- **Nome do item** (input) — puxado do serviço/função, editável
- **Descrição do item** (textarea) — puxada da descrição cadastrada no serviço, editável

No PDF o nome sai em negrito e a descrição sai abaixo, em cinza e menor.

## Task 4 — Custo de transporte no final ✅

**Antes:** o transporte estava embutido no preço do serviço e desaparecia dentro do valor unitário.

**Como foi feito:** o transporte saiu do preço do serviço e virou **linha própria no final do orçamento**:

```
Subtotal          1.200,00 €
Margem (20%)        240,00 €
Transporte           80,00 €   ← linha separada
─────────────────────────────
Total             1.520,00 €
```

- É somado automaticamente a partir dos serviços adicionados (`servico.transporte`)
- Fica num **campo editável** no bloco Precificação, para ajustar ou lançar transporte avulso
- Ao remover o serviço do orçamento, o transporte dele é devolvido/descontado da linha
- Entra **depois** da margem, ou seja, transporte é repassado sem markup

## Task 5 — Orçamento de Custo × Orçamento de Venda ✅

**Como foi feito (dois PDFs + botão seletor, conforme definido):** o botão de documento na listagem virou um menu com 4 opções:

```
Orçamento de Venda (cliente)
  Visualizar venda — 1.520,00 €
  Imprimir / PDF de venda
─────────────────────────────
Orçamento de Custo (interno)
  Visualizar custo — 1.180,00 €
  Imprimir / PDF de custo
```

| | PDF de Venda | PDF de Custo |
|---|---|---|
| Tarja no topo | verde "ORÇAMENTO DE VENDA - CLIENTE" | vermelha "ORÇAMENTO DE CUSTO - USO INTERNO" |
| Valores unitários | preço de venda | custo real |
| Totais | Subtotal → Margem → Transporte → Total | Custo dos itens → Transporte → Total de custo → Total de venda → **Lucro previsto** |
| Nome do funcionário | oculto | visível |
| Termos e condições | inclui | não inclui |

Cada item agora carrega **custo unitário** e **venda unitária** separados (ambos editáveis na tela). Para mão de obra: custo = custo real/hora do funcionário, venda = valor de venda/hora (já com a margem do funcionário). No formulário há dois blocos lado a lado — Orçamento de Venda e Orçamento de Custo com lucro previsto — atualizando em tempo real.

## Task 6 — Valores travados em 2 casas decimais ✅

**Como foi feito:** criados em `lib/utils.ts` os helpers `round2()`, `toFixed2()` e `formatNumber2()`, com arredondamento à prova de erro de vírgula flutuante (`1.005` → `1.01`, e não `1.00`).

- `formatCurrency` agora força `minimumFractionDigits: 2` e `maximumFractionDigits: 2`
- Todos os cálculos de orçamento (subtotal, margem, transporte, totais, totais por item) passam por `round2` antes de serem gravados no Firebase — o banco não guarda mais valores com 15 casas
- Inputs de valor usam `step="0.01"` e gravam já arredondados
- Quantidades, horas e percentuais exibidos com `toFixed2`

## Task 7 — Regra para itens que não multiplicam por m² ✅

**Decisão tomada (a pedido: "ache a melhor forma"):** regra em dois níveis, no cadastro do serviço e no orçamento.

**1) No cadastro do Serviço** (`app/servicos/page.tsx`) — cada linha da composição ganhou a coluna **"Valor fixo"**:
- **Objetos Consumíveis** (tinta, gesso) — por padrão **multiplicam** pela área
- **Itens / Equipamentos** (andaime, escada, furadeira) — por padrão **não multiplicam** (valor fixo)
- O padrão pode ser invertido item a item pelo checkbox

O preço do serviço passou a ser gravado dividido em `precoVariavel` (por m²) e `precoFixo` (uma vez só), com um resumo explicando o cálculo:

```
Por m² (multiplica pela quantidade):   12,50 €
Valor fixo (não multiplica):           80,00 €
Transporte (linha final do orçamento): 30,00 €
Preço Base Final:                      92,50 €
Exemplo para 10 m²: 12,50 € × 10 + 80,00 € = 205,00 € (+ transporte 30,00 €)
```

**2) No Orçamento** — ao adicionar um serviço com parte fixa, o sistema cria automaticamente duas linhas: a variável ("Pintura", 10 m² × 12,50 €) e a fixa ("Pintura - valor fixo", 80,00 € cobrado uma vez). Qualquer item também pode ser marcado manualmente como **"Valor fixo: não multiplica pela quantidade/área"** — ao marcar, o campo quantidade é desativado e o total passa a ser o valor unitário direto.

**Compatibilidade:** serviços cadastrados antes desta mudança (que não têm `precoVariavel`/`precoFixo`) continuam funcionando — o sistema trata o preço antigo como 100% variável e desconta o transporte que estava embutido.

## Task 8 — Ocultar nome do funcionário ✅

**Como foi feito:** o nome ficou restrito ao uso interno.

| Onde | O que aparece |
|------|---------------|
| Tela de edição do orçamento | "Mão de obra - João Silva (Pintor Sênior)" |
| PDF de Custo (interno) | "Mão de obra - João Silva" |
| **PDF de Venda (cliente)** | **"Mão de obra - Pintor Sênior"** (sem nome; "Mão de obra" se não houver função) |

O item guarda `funcionarioNome` e `funcionarioFuncao` separados e um campo `descricaoCliente` usado exclusivamente na impressão de venda. Na tela, um badge mostra ao orçamentista exatamente o que o cliente vai ver.

## Task 9 — Botão Duplicar Mão de Obra ✅

**Como foi feito (duplicar para outro funcionário, conforme definido):** cada item de mão de obra ganhou o ícone de copiar. Ao clicar, abre um diálogo com a quantidade de horas já herdada e um seletor de funcionário:

> Copia 8,00 horas para outro funcionário. O valor/hora usado é o do funcionário escolhido.

Útil para o caso "3 pintores fazendo a mesma jornada": cadastra uma vez e duplica trocando o funcionário. A cópia usa o valor/hora e o custo real do novo funcionário — não copia o valor do original.

---

# 👥 Tela de Funcionários

## Task 10 — URGENTE: cálculo de horas ✅ CORRIGIDO

**O bug:** a fórmula usava uma média proporcional em vez do calendário real:

```
horas/mês = dias_do_mês × (dias_por_semana ÷ 7) × horas_por_dia
```

Isso dava **o mesmo valor para todo mês de 31 dias**, independentemente de como os dias caíam, e inflava as horas — o que **reduzia artificialmente o custo/hora** e, por consequência, o valor de venda de toda a mão de obra do sistema.

**A correção** (`calculateDiasUteisMes` em `app/funcionarios/page.tsx`): passa a contar os **dias úteis reais do calendário**, a partir de segunda-feira, conforme os dias/semana cadastrados (5 = seg-sex, 6 = seg-sáb, 7 = todos).

```
horas/mês = dias úteis reais do mês de referência × horas por dia
```

**Impacto real (8h/dia, 5 dias/semana):**

| Mês de referência | Fórmula antiga | Corrigida | Diferença |
|---|---|---|---|
| Julho/2026 (23 dias úteis) | 177,14 h | **184,00 h** | +6,86 h |
| Agosto/2026 (21 dias úteis) | 177,14 h | **168,00 h** | −9,14 h |
| Fevereiro/2026 (20 dias úteis) | 160,00 h | **160,00 h** | — |
| Maio/2026 (21 dias úteis) | 177,14 h | **168,00 h** | −9,14 h |

Na aba "Horário e Valores" agora aparecem três caixas — Horas/semana, **Dias úteis no mês** e Horas/mês — mais a memória de cálculo escrita por extenso ("23 × 8,00 = 184,00h"). O número de dias úteis é gravado no funcionário (`diasUteisMes`) para auditoria.

> ⚠️ **Ação necessária:** funcionários já cadastrados mantêm as horas antigas gravadas no banco até serem reabertos e salvos. Ver "O que falta" abaixo.

## Task 11 — Aba Encargo Líquido ✅

**Como foi feito (cópia da estrutura com percentuais editáveis, conforme definido):** nova aba "Encargo Líquido" com a mesma estrutura da aba Encargos, porém com percentuais **independentes** (Segurança % e IRS % próprios), permitindo simular um cenário separado sem mexer no cenário de custo.

A diferença entre as duas abas:

| | Aba **Encargos** (existente) | Aba **Encargo Líquido** (nova) |
|---|---|---|
| Encargos | **somam** ao salário | **descontam** do salário |
| Resultado | Salário total com encargos (custo da empresa) | Salário líquido |
| Fórmula | Base + Benefícios + Transporte + SS + IRS | Base + Benefícios + Transporte − SS − IRS |
| Também mostra | Custo/hora real e Venda/hora | Custo/hora líquido e Venda/hora líquido |

Ao editar um funcionário antigo, os percentuais líquidos vêm pré-preenchidos com os valores da aba Encargos, e podem ser ajustados a partir daí. Tudo é gravado em campos próprios (`percentualSegurancaLiquido`, `salarioTotalLiquido`, `custoHoraLiquido`, etc.), sem afetar os cálculos existentes de custo e venda.

---

# ⏳ O que falta / Pontos de atenção

## 1. Migração dos dados já cadastrados (importante)

Nenhum registro antigo foi alterado no banco — todo o código foi escrito com fallback para não quebrar dados existentes. Mas para que os valores fiquem corretos:

| O que | Por quê | Como resolver |
|---|---|---|
| **Funcionários** | Continuam com as horas/mês da fórmula antiga gravadas, logo o custo/hora ainda está errado | Abrir cada funcionário → aba Horário e Valores → conferir → Atualizar. **Recomendado fazer isso antes de emitir novos orçamentos** |
| **Serviços** | Os antigos não têm a divisão variável/fixo; o sistema trata tudo como variável e desconta o transporte embutido | Abrir cada serviço → aba Composição → marcar quais itens são valor fixo → Atualizar |
| **Orçamentos** | Os antigos não têm custo unitário por item, transporte separado nem descrição para o cliente. O PDF de custo usa o preço de venda como custo (lucro aparece zerado) e a mão de obra sai como "Mão de obra" genérica | Reabrir e salvar os orçamentos ainda em aberto. Orçamentos já fechados podem ficar como estão |

> Se preferir, dá para escrever um script de migração único que reprocessa todos os registros de uma vez — não foi feito porque envolve escrita em massa no Firebase e precisa da sua autorização.

## 2. Definição de negócio em aberto: margem dupla na mão de obra

Hoje o valor de venda/hora do funcionário **já inclui a margem do funcionário**, e o orçamento aplica **outra margem** por cima (padrão 20%). Ou seja, mão de obra recebe margem duas vezes. Isso já era assim antes, não foi introduzido agora — mas ficou visível com a separação custo/venda. Precisa da sua decisão:
- **(a)** manter como está;
- **(b)** mão de obra entra no orçamento pelo custo real e recebe só a margem do orçamento;
- **(c)** mão de obra entra pela venda e é isenta da margem do orçamento (como o transporte).

## 3. Itens não implementados (não estavam no pedido)

- **Material avulso no orçamento** — o tipo `"material"` existe em `ItemOrcamento` mas não há tela para adicionar material direto no orçamento (só via composição de serviço)
- **Impostos/IVA** — o campo `impostos` existe e está sempre gravado como 0; não há linha de IVA no PDF
- **Numeração de orçamento** — gerada por `orcamentos.length + 1`, o que pode duplicar número se um orçamento for excluído. Vale trocar por um contador no banco
- **Busca no servidor** — todas as buscas são em memória (client-side). Funciona bem até alguns milhares de registros; acima disso vale indexar no Firestore ou usar Algolia
- **Feriados** — os dias úteis seguem o calendário mas não descontam feriados nacionais. Se for necessário, dá para adicionar uma tabela de feriados por ano

## 4. Firebase — validado e corrigido (30/07/2026)

**Diagnóstico:** as regras do Firestore nunca tinham sido publicadas. As 7 coleções estavam legíveis **sem autenticação** por qualquer pessoa com a chave pública do app — incluindo salários e encargos dos funcionários, e os dados de clientes nos orçamentos.

A causa raiz: o arquivo `firestore.rules` estava salvo com **BOM UTF-8**, e o compilador do Firebase rejeita (`token recognition error at: '﻿'`). Provavelmente tentaram publicar no passado, o deploy falhou e o projeto ficou com as regras de modo de teste.

**Correções aplicadas:**
- BOM removido de `firestore.rules`
- Criados `firebase.json`, `.firebaserc` (projeto `portugal-c3080`) e `firestore.indexes.json`
- `firebase-tools` instalado como devDependency + scripts npm de deploy
- **Regras publicadas** — acesso anônimo agora bloqueado nas 7 coleções
- **Índice composto publicado e construído** (`clientes`: userId ASC + createdAt DESC), que faltava e fazia a paginação de clientes cair num fallback sem ordenação ([firebase-service.ts:120](lib/firebase-service.ts#L120))
- Criado `scripts/check-firebase.mjs` para revalidar a qualquer momento

**Validação final (todos os itens passaram):**

```
=== 3. Firestore - acesso anonimo (deve ser BLOQUEADO) ===
  [OK]  7/7 colecoes - anonimo bloqueado
=== 4. Fluxo autenticado ===
  [OK]  login efetuado
  [OK]  escrita autenticada permitida
  [OK]  query do app retornou os dados automaticamente (so os do proprio utilizador)
  [OK]  isolamento entre contas garantido
=== 5. Limpeza ===
  [OK]  documento de teste e utilizadores temporarios removidos
```

**Comandos:**
```bash
npm run firebase:check          # valida config, auth e bloqueio anônimo (não escreve nada)
npm run firebase:check -- --full # + testa login, leitura/escrita e isolamento entre contas
npm run deploy:rules            # publica firestore.rules
npm run deploy:indexes          # publica firestore.indexes.json
npm run deploy:firestore        # publica ambos
```

> ⚠️ Se `firestore.rules` for reaberto num editor que grave BOM (Bloco de Notas do Windows), o deploy volta a falhar. Salve sempre como UTF-8 sem BOM.

## 4b. Base compartilhada entre contas (decisão de negócio)

**Situação encontrada:** os 27 documentos existentes estavam divididos entre duas contas de utilizador — uma com a maioria dos registos e outra com 1 registo em cada coleção, incluindo o único termo de serviço. Como todas as consultas filtravam por `where("userId","==",uid)`, cada login via apenas o próprio conjunto. Era o comportamento desde sempre, não uma regressão.

**Decisão:** base geral — qualquer conta autenticada vê e edita tudo.

**Como foi feito** (as duas pontas precisavam mudar; só a regra não bastava):

| Camada | Antes | Agora |
|---|---|---|
| `firestore.rules` | `allow read: if isOwner(resource.data.userId)` | `allow read, write: if isAuthenticated()` nas 8 coleções |
| `lib/firebase-service.ts` | 12 consultas com `where("userId","==",userId)` | filtros removidos; as consultas retornam a coleção inteira |

O `userId` continua sendo gravado em cada documento e as funções continuam recebendo o parâmetro — agora serve só como registro de quem criou. A decisão está documentada no topo de [firebase-service.ts](lib/firebase-service.ts) e dentro de [firestore.rules](firestore.rules), para não parecer bug numa leitura futura.

**Validado:** uma conta recém-criada, sem nenhum registro próprio, enxerga os 27 documentos (2 clientes, 2 funcionários, 5 materiais, 11 categorias, 3 serviços, 3 orçamentos, 1 termo). Acesso anônimo continua bloqueado nas 7 coleções.

> ⚠️ **Risco aceito:** a tela `/register` é aberta, então qualquer pessoa que descubra o site pode criar conta e passar a ver salários, clientes e orçamentos. Para fechar isso sem perder o compartilhamento, há uma função `isAutorizado()` pronta e comentada em [firestore.rules](firestore.rules) — basta descomentar, preencher os emails da equipe e trocar `isAuthenticated()` por `isAutorizado()` nas 8 regras. Alternativa: remover a rota `/register`.

> Nota: o índice composto `clientes` (userId + createdAt) deixou de ser necessário, já que a paginação não filtra mais por `userId`. Ficou publicado; é inofensivo, mas pode ser removido de `firestore.indexes.json` num próximo deploy.

## 4c. Regras de folha salarial de Portugal (corrigidas em 30/07/2026)

Pesquisadas as regras em vigor em 2026 e corrigido o cálculo, que tinha dois erros conceituais.

**Erro 1 — o IRS era somado ao custo da empresa.** O IRS é retido ao trabalhador, não é encargo patronal. Somá-lo inflava o custo/hora e, por consequência, o preço de venda de toda a mão de obra. Foi removido da aba Encargos e vive agora apenas na aba Encargo Líquido.

**Erro 2 — os subsídios de férias e Natal não eram considerados.** Em Portugal pagam-se 14 meses de salário por ano. Sem diluir os 2 meses extra, o custo/hora ficava subavaliado.

**Taxas aplicadas (2026):**

| Item | Taxa | Onde |
|---|---|---|
| Segurança Social patronal (TSU) | 23,75% | Aba Encargos |
| Segurança Social do trabalhador | 11% | Aba Encargo Líquido |
| Seguro de acidentes de trabalho | 1,75% (editável; construção 1–5%) | Aba Encargos |
| Subsídios férias + Natal | 2/12 do salário | Aba Encargos (opcional) |
| IRS | tabelas de retenção 2026 | Aba Encargo Líquido |

O subsídio de alimentação é isento até **10,46 €/dia** em cartão (6,15 € em dinheiro). A tela avisa quando o valor cadastrado passa do limite mensal, porque o excedente paga IRS e Segurança Social dos dois lados.

**Efeito num salário base de 1.200 €, 168 h/mês:**

```
  Salario base                      1200.00
  Subsidios ferias+Natal (2/12)      200.00
  Base de incidencia                1400.00
  SS patronal 23,75%                 332.50
  Seguro acidentes 1,75%              24.50
  Beneficios + transporte            215.00
  CUSTO TOTAL EMPRESA               1972.00  = 140,9% da remuneracao bruta
  Custo/hora                          11.74
```

O custo/hora subiu de 10,90 € para 11,74 € (+7,6%) — estava a ser subavaliado. Os 140,9% caem dentro da referência de mercado portuguesa (130% a 145%), que a tela mostra como validação.

> Funcionários já cadastrados: ao abrir para editar, a Segurança Social patronal é reposta em 23,75% (quem tinha 34,75% estava a usar a taxa combinada) e a do trabalhador em 11%. Reveja e guarde cada um.

## 4d. Composição de serviço no formato da planilha de obra

Analisado o `CO26-0034_Tiago_Amadora_Teto falso.xlsx` (7 abas, 30+ composições) e adotado o mesmo modelo, a pedido.

A composição passa a ser montada para uma **quantidade de referência** (ex.: 10 m²) e o preço unitário sai da divisão. Substituiu o conceito de "valor fixo", que gerava confusão.

**Grupos:** Mão de obra · Materiais · Aluguel · Vazadouro · Transporte · Extras - Diversos

**Colunas por linha:** `Descrição | UN | Qtd padrão | Qtd pontual | V.UN | V.TOTAL`, com `V.TOTAL = padrão × pontual × unitário`. Qtd pontual em **0 desliga a linha** sem a apagar.

Validado contra a composição real "Picagem de reboco" da planilha: 119,33 € para 10 m², bate ao cêntimo.

A mão de obra voltou para dentro da composição (decisão do dono do sistema) e puxa o **custo real/hora** do funcionário — não o valor de venda. Isso resolve a margem dupla que estava em aberto: a margem passa a ser aplicada uma única vez, no orçamento.

> Serviços antigos são convertidos automaticamente ao abrir (consumíveis → Materiais, itens → Aluguel, transporte → Transporte), com quantidade de referência 1 para o preço não mudar. Aparecem marcados em âmbar na listagem até serem revistos.

## 5. Débitos técnicos pré-existentes (não introduzidos por estas mudanças)

O `npm run build` passa, mas o `next.config.mjs` está com `ignoreBuildErrors: true` e `ignoreDuringBuilds: true`, o que esconde ~25 erros de TypeScript que já existiam antes destas alterações — principalmente `userId` faltando nas chamadas de `addCliente`/`addMaterial`/`addServico`/`addCategoria`, `tipoTrabalho` inexistente em `app/relatorios/page.tsx` e tipagem `any` implícita nos relatórios. Nenhum deles está nos arquivos alterados aqui, mas vale limpar num próximo ciclo.

---

## Como testar

```bash
npm run dev
```

1. **Busca/Voltar** — entrar em qualquer listagem, digitar no campo (filtra sozinho), reparar na URL `?q=`, clicar em Voltar, retornar e ver a busca preservada
2. **Horas** — Funcionários → editar → aba Horário e Valores → trocar o mês de referência e ver os dias úteis e horas/mês mudarem por mês
3. **Encargo Líquido** — mesma tela, última aba
4. **Serviço com valor fixo** — Serviços → novo → aba Composição → adicionar um consumível e um item → conferir o resumo variável/fixo
5. **Orçamento** — adicionar esse serviço com quantidade 10 → verificar que gera duas linhas (variável e fixa) e que o transporte foi para o final
6. **Duplicar mão de obra** — adicionar mão de obra → clicar no ícone de copiar → escolher outro funcionário
7. **PDFs** — na listagem, abrir o menu do documento e comparar o PDF de venda (sem nome do funcionário, com termos) com o de custo (com nome, com lucro previsto)
