// App: Pokémon TCG Browser usando API TCG (https://docs.apitcg.com/)
// Atenção: usar a API Key no front-end expõe a chave ao usuário final. Para produção, use um proxy/servidor.

(function(){
        // Preferir proxy local para evitar CORS
        const DIRECT_BASE = 'https://apitcg.com/api/pokemon/cards';
        const PROXY_BASE = '/proxy/pokemon/cards';
        let useProxy = true; // usar proxy por padrão
    const DEFAULT_API_KEY = '7041a0965ea4e0c0a6a36996f0df0ec5ad1ed2ff6a316026ea1ce9321deca29c'; // fornecida pelo usuário

    // Estado da UI
    let state = {
        apiKey: null,
        name: '',
        page: 1,
        limit: 12,
        total: 0,
        totalPages: 1,
        loading: false,
        lastController: null,
            setFilter: '__all',
            rarityFilter: '__all',
                setOptions: [],
                rarityOptions: [],
                    hideNoImage: false,
    };

    // Elementos
    const el = {
        searchInput: document.getElementById('searchInput'),
        searchBtn: document.getElementById('searchBtn'),
        clearBtn: document.getElementById('clearBtn'),
        limitSelect: document.getElementById('limitSelect'),
        setSelect: document.getElementById('setSelect'),
        raritySelect: document.getElementById('raritySelect'),
        grid: document.getElementById('grid'),
        statusBar: document.getElementById('statusBar'),
        prevBtn: document.getElementById('prevBtn'),
        nextBtn: document.getElementById('nextBtn'),
        pageInfo: document.getElementById('pageInfo'),
        btnApiKey: document.getElementById('btnApiKey'),
        modal: document.getElementById('modal'),
        modalBody: document.getElementById('modalBody'),
        modalClose: document.getElementById('modalClose'),
            hideNoImgToggle: document.getElementById('hideNoImgToggle'),
    };

    // Util: debounce
    function debounce(fn, ms){
        let t; return (...args)=>{ clearTimeout(t); t = setTimeout(()=>fn(...args), ms); };
    }

    // Persistência da API key
    function loadApiKey(){
        const fromStorage = localStorage.getItem('apitcg_key');
        if (fromStorage) return fromStorage;
        // salva padrão para funcionar out-of-the-box neste demo local
        localStorage.setItem('apitcg_key', DEFAULT_API_KEY);
        return DEFAULT_API_KEY;
    }
    function saveApiKey(key){
        localStorage.setItem('apitcg_key', key);
        state.apiKey = key;
    }

    // HTTP
    async function fetchJSON(url){
        if (!state.apiKey) throw new Error('API key não configurada');
        // cancelamento da requisição anterior
        if (state.lastController) state.lastController.abort();
        const controller = new AbortController();
        state.lastController = controller;
        const res = await fetch(url, {
            headers: { 'x-api-key': state.apiKey },
            signal: controller.signal,
        });
        if (!res.ok){
            const text = await res.text();
            throw new Error(`HTTP ${res.status}: ${text || res.statusText}`);
        }
        return res.json();
    }

    function buildUrl(){
        const params = new URLSearchParams();
        if (state.name) params.set('name', state.name);
        params.set('limit', String(state.limit));
        params.set('page', String(state.page));
        const base = useProxy ? PROXY_BASE : DIRECT_BASE;
        return `${base}?${params.toString()}`;
    }

    function setLoading(loading){
        state.loading = loading;
        if (loading){
            el.statusBar.textContent = 'Carregando…';
            el.grid.classList.add('loading');
        } else {
            el.grid.classList.remove('loading');
        }
    }

    function updatePaginationInfo(){
        el.pageInfo.textContent = `Página ${state.page} de ${state.totalPages}`;
        el.prevBtn.disabled = state.page <= 1;
        el.nextBtn.disabled = state.page >= state.totalPages;
    }

        function renderCards(cards){
            el.grid.innerHTML = '';
            if (!cards || cards.length === 0){
            el.grid.innerHTML = '<p class="small">Nenhuma carta encontrada.</p>';
            return;
        }
            const frag = document.createDocumentFragment();
            const filtered = applyFilters(cards);
            const toRender = filtered.slice(0, state.limit);
                if (toRender.length === 0){
                    el.grid.innerHTML = '<p class="small">Nenhuma carta com os filtros aplicados.</p>';
                    return;
                }
                toRender.forEach(card => {
            const div = document.createElement('div');
                    div.className = 'card-item';
                    const imgUrl = chooseImage(card);
                    if (state.hideNoImage && !imgUrl) return;
                    const imageHtml = imgUrl ? `<img src="${imgUrl}" alt="${card.name || 'Carta'}" />` : `<span class="thumb no-img"></span>`;
                    div.innerHTML = `
                        ${imageHtml}
                <div class="title">${card.name || card.id}</div>
                <div class="meta">${card.set?.name ? card.set.name + ' · ' : ''}${card.rarity || ''}</div>
            `;
            div.addEventListener('click', ()=> openCardModal(card.id));
            frag.appendChild(div);
        });
        el.grid.appendChild(frag);
    }

            function applyFilters(cards){
                    return cards.filter(c => {
                    const setOk = state.setFilter === '__all' || (c.set?.name || '').toLowerCase() === state.setFilter.toLowerCase();
                    const rarityOk = state.rarityFilter === '__all' || (c.rarity || '').toLowerCase() === state.rarityFilter.toLowerCase();
                        const imgOk = !state.hideNoImage || !!chooseImage(c);
                        return setOk && rarityOk && imgOk;
                });
            }

        function populateFilterOptions(cards){
                // versão fallback (quando não há proxy). Mantida por compatibilidade.
                const sets = new Set();
                const rarities = new Set();
                (cards||[]).forEach(c => { if (c.set?.name) sets.add(c.set.name); if (c.rarity) rarities.add(c.rarity); });
                const setsArr = Array.from(sets).sort((a,b)=> a.localeCompare(b));
                const rarsArr = Array.from(rarities).sort((a,b)=> a.localeCompare(b));

            // Preservar seleção atual se ainda existir
            const prevSet = state.setFilter;
            const prevRar = state.rarityFilter;

            el.setSelect.innerHTML = `<option value="__all">Todos os sets</option>` + setsArr.map(s=>`<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('');
            el.raritySelect.innerHTML = `<option value="__all">Todas as raridades</option>` + rarsArr.map(r=>`<option value="${escapeHtml(r)}">${escapeHtml(r)}</option>`).join('');

            if (prevSet !== '__all' && setsArr.find(s=> s.toLowerCase() === prevSet.toLowerCase())) el.setSelect.value = prevSet; else el.setSelect.value = '__all';
            if (prevRar !== '__all' && rarsArr.find(r=> r.toLowerCase() === prevRar.toLowerCase())) el.raritySelect.value = prevRar; else el.raritySelect.value = '__all';
        }

    async function load(){
        try{
            setLoading(true);
            const url = buildUrl();
            const data = await fetchJSON(url);
            // Respostas diferentes: algumas têm page/limit/total/totalPages, Pokémon tem totalCount
            const cards = data.data || [];
            const totalCount = typeof data.totalCount === 'number' ? data.totalCount : (typeof data.total === 'number' ? data.total : cards.length);
            state.total = totalCount;
            state.totalPages = Math.max(1, Math.ceil(totalCount / state.limit));
            el.statusBar.textContent = `${totalCount} resultados` + (state.name ? ` para "${state.name}"` : '');
                            if (!useProxy){
                                // sem proxy: popula a partir da página (fallback)
                                populateFilterOptions(cards);
                            }
                    renderCards(cards);
            updatePaginationInfo();
        } catch(err){
            console.error(err);
            el.statusBar.textContent = `Erro: ${err.message}`;
            el.grid.innerHTML = '';
        } finally {
            setLoading(false);
        }
    }

    async function openCardModal(id){
        if (!id) return;
        try{
            el.modal.classList.remove('hidden');
            el.modalBody.innerHTML = '<p class="small">Carregando detalhes…</p>';
            const base = useProxy ? PROXY_BASE : DIRECT_BASE;
            const url = `${base}/${encodeURIComponent(id)}`;
            const { data } = await fetchJSON(url);
            const card = data || {};
            el.modalBody.innerHTML = `
                <div class="row" style="gap:16px; align-items:flex-start; flex-wrap: wrap;">
                    <img src="${(card.images && (card.images.large || card.images.small)) || ''}" alt="${card.name || 'Carta'}" style="width:260px;max-width:100%" />
                    <div style="flex:1; min-width:260px;">
                        <h2 id="modalTitle">${card.name || card.id}</h2>
                        <p class="small" style="margin:6px 0 12px;">${card.set?.name ? card.set.name + ' · ' : ''}${card.rarity || ''}</p>
                        <pre>${escapeHtml(JSON.stringify(card, null, 2))}</pre>
                    </div>
                </div>
            `;
        } catch(err){
            el.modalBody.innerHTML = `<p class="small">Erro ao carregar carta: ${escapeHtml(err.message)}</p>`;
        }
    }

    function escapeHtml(str){
        return String(str)
            .replaceAll('&','&amp;')
            .replaceAll('<','&lt;')
            .replaceAll('>','&gt;');
    }

    function wireEvents(){
        // Busca
        const doSearch = ()=>{ state.page = 1; state.name = el.searchInput.value.trim(); load(); };
        el.searchBtn.addEventListener('click', doSearch);
        el.searchInput.addEventListener('keydown', (e)=>{ if (e.key === 'Enter') doSearch(); });
        el.searchInput.addEventListener('input', debounce(()=>{ doSearch(); }, 450));
        el.clearBtn.addEventListener('click', ()=>{ el.searchInput.value=''; doSearch(); });

        // Limite
        el.limitSelect.addEventListener('change', ()=>{ state.limit = parseInt(el.limitSelect.value, 10) || 12; state.page = 1; load(); });

        // Filtros
        el.setSelect.addEventListener('change', ()=>{ state.setFilter = el.setSelect.value; renderCards(lastCardsCache); });
        el.raritySelect.addEventListener('change', ()=>{ state.rarityFilter = el.raritySelect.value; renderCards(lastCardsCache); });
            // Toggle ocultar sem imagem
            el.hideNoImgToggle.addEventListener('change', ()=>{
                state.hideNoImage = !!el.hideNoImgToggle.checked;
                localStorage.setItem('hide_no_img', state.hideNoImage ? '1' : '0');
                // Recarrega para permitir agregação de páginas e preencher a grade
                load();
            });

        // Paginação
        el.prevBtn.addEventListener('click', ()=>{ if (state.page > 1){ state.page--; load(); } });
        el.nextBtn.addEventListener('click', ()=>{ if (state.page < state.totalPages){ state.page++; load(); } });

        // Modal
        el.modalClose.addEventListener('click', ()=> el.modal.classList.add('hidden'));
        el.modal.addEventListener('click', (e)=>{ if (e.target === el.modal) el.modal.classList.add('hidden'); });

        // API Key UI
        el.btnApiKey.addEventListener('click', openApiKeyModal);
    }

    function openApiKeyModal(){
        el.modal.classList.remove('hidden');
        const curr = state.apiKey || '';
        el.modalBody.innerHTML = `
            <h2 id="modalTitle">Configurar API Key</h2>
            <p class="small" style="margin:6px 0 12px;">Sua chave será salva apenas neste navegador (localStorage). Para produção, use um backend proxy para manter a chave privada.</p>
            <input id="apiKeyInput" class="input" placeholder="x-api-key" value="${escapeHtml(curr)}" />
            <div class="row" style="margin-top:12px; justify-content:flex-end; gap:8px;">
                <button class="btn secondary" id="apiKeyCancel">Cancelar</button>
                <button class="btn" id="apiKeySave">Salvar</button>
            </div>
        `;
        document.getElementById('apiKeyCancel').addEventListener('click', ()=> el.modal.classList.add('hidden'));
        document.getElementById('apiKeySave').addEventListener('click', ()=>{
            const val = document.getElementById('apiKeyInput').value.trim();
            if (!val){
                alert('Informe uma API key válida.');
                return;
            }
            saveApiKey(val);
            el.modal.classList.add('hidden');
            load();
        });
    }

    function init(){
            state.apiKey = loadApiKey();
            // se estiver servindo via arquivo (file://), proxy não funciona
            if (location.protocol === 'file:') useProxy = false;
        // preencher selects/valores iniciais
        el.limitSelect.value = String(state.limit);
        // preferências
        state.hideNoImage = localStorage.getItem('hide_no_img') === '1';
        if (el.hideNoImgToggle) el.hideNoImgToggle.checked = state.hideNoImage;
        wireEvents();
            if (useProxy) { fetchMeta().finally(load); } else { load(); }
    }

        // cache simples da última página carregada para re-renderização com filtros
        let lastCardsCache = [];
        const originalLoad = load;
        load = async function(){
            try{
                setLoading(true);
                const url = buildUrl();
                const data = await fetchJSON(url);
                let cards = data.data || [];
                const totalCount = typeof data.totalCount === 'number' ? data.totalCount : (typeof data.total === 'number' ? data.total : cards.length);
                state.total = totalCount;
                state.totalPages = Math.max(1, Math.ceil(totalCount / state.limit));
                el.statusBar.textContent = `${totalCount} resultados` + (state.name ? ` para \"${state.name}\"` : '');
                // quando sem proxy, ainda populamos filtros a partir da página
                if (!useProxy) populateFilterOptions(cards);

                // Se o toggle "ocultar sem imagem" estiver ativo, agregar páginas até completar o limite
                if (state.hideNoImage){
                    let filteredCount = applyFilters(cards).length;
                    let page = state.page + 1;
                    const MAX_EXTRA_PAGES = 5;
                    let fetched = 0;
                    while (filteredCount < state.limit && page <= state.totalPages && fetched < MAX_EXTRA_PAGES){
                        const base = useProxy ? PROXY_BASE : DIRECT_BASE;
                        const params = new URLSearchParams();
                        if (state.name) params.set('name', state.name);
                        params.set('limit', String(state.limit));
                        params.set('page', String(page));
                        const moreUrl = `${base}?${params.toString()}`;
                        // eslint-disable-next-line no-await-in-loop
                        const more = await fetchJSON(moreUrl);
                        const moreCards = more.data || [];
                        cards = cards.concat(moreCards);
                        filteredCount = applyFilters(cards).length;
                        page++; fetched++;
                    }
                }
                lastCardsCache = cards;
                renderCards(cards);
                updatePaginationInfo();
            } catch(err){
                console.error(err);
                el.statusBar.textContent = `Erro: ${err.message}`;
                el.grid.innerHTML = '';
            } finally {
                setLoading(false);
            }
        }

    // start
    document.addEventListener('DOMContentLoaded', init);
  
        // helpers
        function chooseImage(card){
            const s = card?.images?.small || '';
            const l = card?.images?.large || '';
            const isBack = (u)=>{
                if (typeof u !== 'string' || !u) return false;
                // heurísticas extras para detectar "card back" em diferentes hosts
                const patterns = [
                    /(^|\/)(back)(?:[_.\-]|%20|$)/i,
                    /card[-_ ]?back/i,
                    /backside/i,
                    /verso/i,
                    /reverse/i,
                    /placeholder/i,
                    /default\.(png|jpg|jpeg|webp)$/i,
                ];
                if (patterns.some(re=> re.test(u))) return true;
                // casos específicos comuns do images.pokemontcg.io
                if (/images\.pokemontcg\.io/i.test(u)){
                    // muitos backs terminam com back.png/back_hires.png ou contêm /back
                    if (/\/back(_|\.|\/|$)/i.test(u)) return true;
                }
                return false;
            };
            if (s && !isBack(s)) return s;
            if (l && !isBack(l)) return l;
            return '';
        }

        async function fetchMeta(){
            try{
                const res = await fetch('/proxy/pokemon/meta');
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const meta = await res.json();
                state.setOptions = meta.sets || [];
                state.rarityOptions = meta.rarities || [];
                // preencher selects globais
                el.setSelect.innerHTML = `<option value="__all">Todos os sets</option>` + state.setOptions.map(s=>`<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('');
                el.raritySelect.innerHTML = `<option value="__all">Todas as raridades</option>` + state.rarityOptions.map(r=>`<option value="${escapeHtml(r)}">${escapeHtml(r)}</option>`).join('');
            }catch(err){
                console.warn('Falha ao obter meta global, usando fallback por página:', err.message);
            }
        }
})();