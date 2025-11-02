// Simple dev server + proxy para API TCG
// Requisitos: Node >= 18 (fetch nativo)

const path = require('path');
const express = require('express');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const ROOT = __dirname; // serve este diretório

// Serve arquivos estáticos (index.html, assets, etc.)
app.use(express.static(ROOT));

// Proxy para Pokémon TCG
const API_BASE = 'https://apitcg.com/api/pokemon/cards';
const API_KEY = process.env.API_TCG_KEY;

async function proxyFetch(url, res){
  try{
    if (!API_KEY){
      return res.status(500).json({ error: 'API_TCG_KEY não configurada no ambiente (.env).' });
    }
    const upstream = await fetch(url, { headers: { 'x-api-key': API_KEY } });
    const contentType = upstream.headers.get('content-type') || 'application/json; charset=utf-8';
    res.status(upstream.status);
    res.setHeader('content-type', contentType);
    const body = await upstream.text();
    return res.send(body);
  }catch(err){
    console.error('[proxy error]', err);
    return res.status(502).json({ error: 'Falha ao contatar API TCG', detail: err.message });
  }
}

app.get('/proxy/pokemon/cards', async (req, res)=>{
  const qs = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
  const url = API_BASE + qs;
  return proxyFetch(url, res);
});

app.get('/proxy/pokemon/cards/:id', async (req, res)=>{
  const url = `${API_BASE}/${encodeURIComponent(req.params.id)}`;
  return proxyFetch(url, res);
});

// Cache em memória para meta (sets/rarities)
const metaCache = { data: null, at: 0, ttl: 1000 * 60 * 60 * 6 }; // 6h

app.get('/proxy/pokemon/meta', async (req, res)=>{
  try{
    const now = Date.now();
    const refresh = 'refresh' in req.query;
    if (!refresh && metaCache.data && (now - metaCache.at) < metaCache.ttl){
      return res.json(metaCache.data);
    }

    if (!API_KEY){
      return res.status(500).json({ error: 'API_TCG_KEY não configurada no ambiente (.env).' });
    }

    const limit = 100;
    // primeira chamada para descobrir totalCount
    const firstUrl = `${API_BASE}?limit=${limit}&page=1`;
    const first = await fetch(firstUrl, { headers: { 'x-api-key': API_KEY } }).then(r=>r.json());
    const totalCount = typeof first.totalCount === 'number' ? first.totalCount : (typeof first.total === 'number' ? first.total : (first.data||[]).length);
    const totalPages = Math.max(1, Math.ceil(totalCount / limit));

    const sets = new Set();
    const rarities = new Set();

    // agrega página 1
    (first.data||[]).forEach(c=>{ if (c.set?.name) sets.add(c.set.name); if (c.rarity) rarities.add(c.rarity); });

    // busca restantes com pequena concorrência
    const MAX_PAGES = totalPages; // pode ajustar p/ limitar
    const concurrency = 5;
    let page = 2;
    async function fetchPage(p){
      const u = `${API_BASE}?limit=${limit}&page=${p}`;
      const j = await fetch(u, { headers: { 'x-api-key': API_KEY } }).then(r=> r.ok ? r.json() : { data: [] });
      (j.data||[]).forEach(c=>{ if (c.set?.name) sets.add(c.set.name); if (c.rarity) rarities.add(c.rarity); });
    }
    const tasks = [];
    while (page <= MAX_PAGES){
      const batch = [];
      for (let i=0; i<concurrency && page <= MAX_PAGES; i++, page++) batch.push(fetchPage(page));
      // eslint-disable-next-line no-await-in-loop
      await Promise.all(batch);
    }

    const payload = {
      sets: Array.from(sets).sort((a,b)=> a.localeCompare(b)),
      rarities: Array.from(rarities).sort((a,b)=> a.localeCompare(b)),
      totalCount,
      totalPages,
      generatedAt: new Date().toISOString(),
    };
    metaCache.data = payload; metaCache.at = now;
    return res.json(payload);
  }catch(err){
    console.error('[meta error]', err);
    return res.status(500).json({ error: 'Falha ao gerar metadados', detail: err.message });
  }
});

// Fallback para SPA (abre index.html)
app.get('*', (req, res)=>{
  res.sendFile(path.join(ROOT, 'index.html'));
});

app.listen(PORT, ()=>{
  console.log(`Servidor iniciado em http://localhost:${PORT}`);
});
