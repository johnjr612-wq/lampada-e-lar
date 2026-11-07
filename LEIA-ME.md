# Lâmpada e Lar: como colocar no ar e vender a assinatura

O pacote tem duas pastas:
- `docs/`: o aplicativo (essa é a pasta que o GitHub Pages publica)
- `servidor/`: o programinha que confirma quem pagou (Cloudflare Worker)

O aplicativo fica no GitHub Pages e o servidor de assinaturas na Cloudflare, os dois no plano gratuito. Você só paga a Hotmart (comissão por venda) e o domínio, se quiser um endereço próprio.

## Passo 1: criar o produto na Hotmart
1. Em Produtos, crie um produto do tipo **Assinatura**, com cobrança mensal.
2. Copie o **link de pagamento** (checkout) do produto.
3. Anote o **ID do produto**.
4. Em Ferramentas > **Webhook (API e Notificações)**, copie o seu **Hottok** (um código secreto da sua conta).

## Passo 2: colocar o servidor no ar (Cloudflare)
1. Crie uma conta grátis em cloudflare.com.
2. No computador, instale o Node.js (nodejs.org). Abra o terminal na pasta `servidor` e rode:
   ```
   npm install -g wrangler
   wrangler login
   wrangler kv namespace create ASSINATURAS
   ```
3. O último comando mostra um `id`. Cole esse id no arquivo `wrangler.toml`, no lugar de `COLE_O_ID_DO_KV_AQUI`.
4. Guarde o seu Hottok como segredo e publique:
   ```
   wrangler secret put HOTTOK
   wrangler deploy
   ```
5. A Cloudflare mostra o endereço do servidor, parecido com `https://lampada-e-lar.SEU-NOME.workers.dev`.
6. (Recomendado) No painel da Cloudflare, em Workers > lampada-e-lar > Settings > Variables, adicione:
   - `PRODUCT_ID`: o ID do produto da Hotmart
   - `DIAS`: dias liberados por pagamento (padrão 35, para plano mensal)
   - `ALLOWED_ORIGIN`: o endereço do seu site, depois que ele existir

## Passo 3: avisar a Hotmart
Em Ferramentas > Webhook, clique em **Cadastrar webhook**:
- URL: `https://SEU-SERVIDOR.workers.dev/webhook`
- Versão: **2.0.0**
- Eventos: Compra aprovada, Compra completa, Cancelamento de assinatura, Compra cancelada, Reembolso e Chargeback.

Use o botão de envio de teste da Hotmart e confira, na aba Histórico, se a resposta foi 200.

## Passo 4: colocar o aplicativo no ar (GitHub Pages)
1. Abra `docs/index.html` num editor de texto e procure `const PLAN=`. Troque:
   - `COLE_AQUI_O_LINK_DE_PAGAMENTO_DA_HOTMART` pelo link do passo 1
   - `COLE_AQUI_O_ENDERECO_DO_SERVIDOR/verificar` por `https://SEU-SERVIDOR.workers.dev/verificar`
   - se quiser mostrar o preço, preencha `preco` (por exemplo `'R$ 14,90 por mês'`)
2. No GitHub, crie um repositório e envie o conteúdo deste pacote (as pastas `docs` e `servidor`). A pasta `servidor` pode ir junto: o seu Hottok **não** está nela, ele fica guardado só na Cloudflare.
3. No repositório, abra Settings > **Pages**. Em "Build and deployment", escolha **Deploy from a branch**, branch `main` e pasta **/docs**. Salve.
4. Em um ou dois minutos o GitHub mostra o endereço, parecido com `https://SEU-USUARIO.github.io/NOME-DO-REPOSITORIO/`. Esse é o link do app.
5. Para ter um endereço próprio (por exemplo lampadaelar.com.br), compre o domínio e, em Settings > Pages > **Custom domain**, informe o domínio. O GitHub explica os ajustes de DNS na própria tela.
6. Volte ao servidor (passo 2.6) e preencha `ALLOWED_ORIGIN` só com o endereço base, sem a pasta do repositório: `https://SEU-USUARIO.github.io` (ou o seu domínio próprio).
7. Sempre que mudar o `index.html` no GitHub, o site se atualiza sozinho em alguns minutos.

## Como o cliente usa
1. Toca em "Assinar agora" e paga na Hotmart (Pix, cartão ou boleto).
2. Volta ao app, toca em um conteúdo Premium e digita o **e-mail da compra** em "Já assinou?".
3. O app confere com o servidor e libera tudo. Uma vez por dia ele confirma de novo; se a assinatura for cancelada ou reembolsada, o acesso termina.
4. No celular, o cliente pode instalar o app: no Android, menu do navegador > "Instalar app"; no iPhone, Compartilhar > "Adicionar à Tela de Início".

## Antes de vender, confira
- O código de teste foi removido (`demo:''`). Neste pacote já está removido.
- Teste uma compra de verdade (ou com cupom de 100% na Hotmart) usando um e-mail seu.
- Tenha uma política de privacidade e termos de uso no seu site: o app guarda o e-mail de quem assina (LGPD).
- A confirmação é feita pelo e-mail da compra. Quem usar um e-mail diferente do que pagou não será liberado.
- Para evitar tentativas em massa no endereço `/verificar`, ative uma regra de limite de requisições na Cloudflare (Security > WAF > Rate limiting).
- Planos anuais: ajuste `DIAS` para 370.
