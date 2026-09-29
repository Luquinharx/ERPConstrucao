# Guia rápido: impostos, produtos, mão de obra e estoque

## 1. Grupos de impostos
**Configurações > Impostos**

1. Clique em **Novo grupo** e dê um nome (ex.: "Material - IVA 23%").
2. Para cada imposto, escolha:
   - **Compra**: entra no custo do produto.
   - **Venda**: sai do preço de venda.
   - **Recuperável** (só na compra): a empresa recupera o imposto, como o IVA dedutível. Aparece como crédito e não entra no custo.
3. Clique em **Gravar grupos**.

Já existem 5 grupos de exemplo. Se mudar a taxa num grupo, ela muda em todos os produtos desse grupo.

## 2. Produtos
**Menu Produtos > Novo Produto**

1. Preencha o nome, a unidade e o **preço de compra**.
2. Em **Grupo de impostos**, escolha o grupo. O **custo real** é calculado sozinho.
3. Em **Venda**, escreva a **margem** e o preço é calculado, ou escreva o **preço** e a margem é calculada.
   A margem é o lucro que sobra depois de pagar os impostos da venda.
4. Se quiser controlar o estoque, ligue **Controlar estoque** e indique o estoque inicial e o mínimo.

## 3. Mão de obra
**Menu Funções**

1. Cadastre cada função (Pintor, Pedreiro...) com o **preço/hora cobrado ao cliente**.
2. O **custo médio/hora** vem sozinho dos funcionários com essa função (campo Função na ficha do funcionário).

## 4. Estoque
**Menu Estoque**

- **Entrada**: uma compra. Soma ao saldo e atualiza o custo médio.
- **Saída**: material que saiu. Pode ser ligada a uma obra.
- **Ajuste**: a contagem física, que passa a ser o saldo.

Os movimentos não se apagam. Um engano corrige-se com outro movimento ou com um ajuste.

## 5. Orçamento
**Aba Itens**

- **Produto no orçamento**: escolha o produto e a quantidade. O custo e o preço vêm do cadastro.
- **Mão de obra**: escolha a **função**, que dá o preço ao cliente, e o **funcionário**, que dá o custo. Sem funcionário, usa-se o custo médio da função.

**Aba Preço**
- **Margem por item**: ligada, usa o preço de venda do cadastro. Desligada, tudo vai a preço de custo.
- **Margem global**: percentagem somada por cima de tudo.
- As duas ligam e desligam de forma independente. O padrão das propostas novas escolhe-se em Configurações.

O IVA cobrado ao cliente continua a ser somado no fim do orçamento, como antes.
