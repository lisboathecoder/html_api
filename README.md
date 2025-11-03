# Pokémon TCG Browser (API TCG)

Uma Single Page Application (estática) para buscar cartas do Pokémon TCG usando a API pública do API TCG.

- Docs da API: https://docs.apitcg.com/api-reference/cards
- Endpoint usado: `https://apitcg.com/api/pokemon/cards`
- Autenticação: header `x-api-key`

## Como usar

Recomendado (com proxy para evitar CORS e proteger a chave):

1) Instale as dependências e crie o .env

```cmd
cd c:\Users\gusta\Documents\codes\html_api
npm install
copy .env.example .env
```

2) Edite o arquivo `.env` e preencha `API_TCG_KEY` com sua chave.

3) Inicie o servidor

```cmd
npm start
```

4) Abra http://localhost:3000 no navegador.

5) Pesquise por nome (ex.: `charizard`). Ajuste o "itens por página" (12/24/48/96). Use os botões Anterior/Próxima. Clique em uma carta para abrir o modal com detalhes (`GET /api/pokemon/cards/{id}`).

6) Use os filtros de Set e Raridade (observação: como o endpoint de sets está “Under construction” na API, as opções de filtro são derivadas dos resultados da página atual; para cobrir todos os sets/raridades possíveis, implemente um agregador no backend que percorra várias páginas e consolide as opções).

## Publicando no GitHub Pages

- Domínio: `https://lisboathecoder.github.io/html_api/`
- Como o GitHub Pages é estático, o proxy Node não roda lá. O app detecta automaticamente `*.github.io` e desativa o proxy, passando a chamar a API diretamente.
- Importante: se a API TCG não permitir CORS para o seu domínio, as requisições do navegador serão bloqueadas. Alternativas:
  - Publicar um Worker/Function (Cloudflare/Netlify/Vercel) para atuar como proxy e configurar o endpoint no front-end (já suportado se você servir o app por um domínio com o proxy atrás).
  - Usar o servidor local (`npm start`) durante o desenvolvimento ou para uso privado.
- Dica: se precisar de filtros globais (todos os sets/raridades), mantenha o proxy (server.js) em um serviço com Node e a UI no GitHub Pages apontando para esse proxy.

## Observações importantes

- Segurança da chave: o servidor local atua como proxy e injeta o header `x-api-key` a partir da variável de ambiente (`.env`). Isso evita expor a chave no front-end. Não faça commit do seu `.env`.
- Paginação: a API retorna dois formatos de meta, dependendo do TCG. Para Pokémon, normalmente vem `{ data: [], totalCount }`. O app calcula `totalPages = ceil(totalCount/limit)` e trata ambos os formatos.
- Propriedades exibidas: nome da carta, imagem (`images.small`/`images.large`), set (quando disponível) e raridade (quando disponível).

## Estrutura

```
index.html
assets/
  js/
    script.js       # lógica de busca, paginação, modal e API key
  styles/
    style.css       # estilos base, grid e modal
```

## Troubleshooting

- Erro 401/403: verifique a API key (botão “API Key”).
- Sem resultados: tente um nome parcial e verifique acentuação/caixa (a busca é por `name`).
- Rate limit: a API pode impor limites. Use debounce (já incluso) e evite múltiplas buscas simultâneas.

## Desenvolvimento

- Se optar por testar sem o servidor (abrindo `index.html` direto ou via Live Server), o browser tentará acessar a API diretamente e você poderá enfrentar CORS. O código tenta usar o proxy por padrão e cai para acesso direto apenas quando aberto via `file://`.
- Sinta-se à vontade para adaptar para React/Vite etc. Mantendo o proxy (ou outro backend), sua chave fica protegida.

## Como replicar este projeto em outro repositório

1. Copie estes arquivos/pastas para o novo repositório:

```
index.html
assets/
  js/script.js
  styles/style.css
server.js
package.json
.env.example
```

2. Ajuste o conteúdo de `index.html` (título, logos, textos) conforme seu projeto.

3. Se quiser mudar o TCG (por exemplo, One Piece), edite `assets/js/script.js`:

- Troque as constantes:
  - `DIRECT_BASE = 'https://apitcg.com/api/one-piece/cards'`
  - `PROXY_BASE  = '/proxy/one-piece/cards'`
- No `server.js`, troque `API_BASE` para o mesmo endpoint (e adicione novas rotas de proxy caso use múltiplos TCGs).

4. Instale as dependências e crie o `.env`:

```cmd
npm install
copy .env.example .env
```

5. No `.env`, configure `API_TCG_KEY` com sua chave.

6. Rode localmente:

```cmd
npm start
```

7. Abra http://localhost:3000 e use o app.

### Dicas para filtros

- Os selects de “Set” e “Raridade” são preenchidos a partir da página atual de resultados (derivação client-side). Para listas completas, crie um endpoint no `server.js` que itere por várias páginas (`?limit=100&page=N`) e agregue as opções de forma assíncrona com um limite seguro (ex.: 5–10 páginas).
- Para aplicar filtros no servidor, crie um endpoint `/proxy/pokemon/search` que aceite `name`, `rarity` e `set`, faça o fetch paginado, filtre e retorne os cards filtrados com paginação própria.

### Segurança

- Nunca comite sua chave real. Use `.env` (o `.env.example` é apenas um modelo).
- Se publicar, hospede o `server.js` (ou equivalente) junto para que o front-end não acesse a API diretamente.
