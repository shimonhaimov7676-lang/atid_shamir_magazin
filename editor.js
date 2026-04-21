/* ============================================================
   editor.js — Visual article editor for עתיד שמיר
   Build articles with no code, export as JSON ready to paste
   into articles.js
   ============================================================ */
(function () {
    'use strict';

    const STORAGE_KEY = 'atid_editor_draft_v1';
    let blocks = []; // [{id, type, data:{...}}]
    let nextId = 1;

    // ---------- Block schemas ----------
    const BLOCK_DEFS = {
        heading:   { label: '📰 כותרת',     fields: [{ k: 'text', t: 'text', ph: 'טקסט הכותרת', label: 'כותרת' }, { k: 'level', t: 'select', label: 'גודל', opts: ['h2','h3','h4'], def: 'h2' }] },
        paragraph: { label: '📄 פסקה',       fields: [{ k: 'text', t: 'textarea', ph: 'הטקסט של הפסקה...', label: 'תוכן' }] },
        image:     { label: '🖼️ תמונה',     fields: [{ k: 'src', t: 'text', ph: 'photo.jpg או URL', label: 'מקור התמונה' }, { k: 'caption', t: 'text', ph: 'כיתוב (אופציונלי)', label: 'כיתוב' }] },
        gallery:   { label: '🖼️🖼️ גלריה',  fields: [{ k: 'images', t: 'list', ph: 'קובץ או URL לכל שורה', label: 'תמונות (אחת בכל שורה)' }] },
        video:     { label: '🎬 וידאו',      fields: [{ k: 'src', t: 'text', ph: 'video.mp4 או URL', label: 'קובץ וידאו' }, { k: 'poster', t: 'text', ph: 'תמונת תצוגה (אופציונלי)', label: 'פוסטר' }] },
        youtube:   { label: '▶️ יוטיוב',     fields: [{ k: 'id', t: 'text', ph: 'מזהה הסרטון, לדוגמה: dQw4w9WgXcQ', label: 'YouTube ID' }] },
        quote:     { label: '💬 ציטוט',      fields: [{ k: 'text', t: 'textarea', ph: 'הציטוט', label: 'ציטוט' }, { k: 'cite', t: 'text', ph: 'מקור (אופציונלי)', label: 'שם המצוטט' }] },
        list:      { label: '📋 רשימה',      fields: [{ k: 'style', t: 'select', label: 'סוג', opts: ['ul','ol'], def: 'ul' }, { k: 'items', t: 'list', ph: 'פריט בכל שורה', label: 'פריטים' }] },
        table:     { label: '📊 טבלה',       fields: [{ k: 'headers', t: 'text', ph: 'עמודה1 | עמודה2 | עמודה3', label: 'כותרות (מופרדות ב |)' }, { k: 'rows', t: 'textarea', ph: 'תא1 | תא2 | תא3\nתא1 | תא2 | תא3', label: 'שורות (כל שורה — תאים מופרדים ב |)' }] },
        link:      { label: '🔗 קישור',      fields: [{ k: 'text', t: 'text', ph: 'טקסט הקישור', label: 'טקסט' }, { k: 'url', t: 'text', ph: 'https://...', label: 'כתובת URL' }] },
        file:      { label: '📎 קובץ',       fields: [{ k: 'src', t: 'text', ph: 'document.pdf או URL', label: 'קובץ' }, { k: 'name', t: 'text', ph: 'שם להצגה', label: 'שם להצגה' }] },
        calendar:  { label: '📅 לוח שנה',    fields: [{ k: 'title', t: 'text', ph: 'אירועי החודש', label: 'כותרת' }, { k: 'events', t: 'textarea', ph: '22.04 | יום העצמאות\n01.05 | טיול שנתי', label: 'אירועים (תאריך | תיאור, שורה לכל אחד)' }] },
        divider:   { label: '➖ קו מפריד',   fields: [] }
    };

    // ---------- Add / remove / move ----------
    window.addBlock = function (type) {
        const def = BLOCK_DEFS[type];
        if (!def) return;
        const data = {};
        def.fields.forEach(f => { data[f.k] = f.def || ''; });
        blocks.push({ id: nextId++, type, data });
        renderBlocks();
        updatePreview();
    };

    function removeBlock(id) {
        blocks = blocks.filter(b => b.id !== id);
        renderBlocks(); updatePreview();
    }
    function moveBlock(id, dir) {
        const i = blocks.findIndex(b => b.id === id);
        const j = i + dir;
        if (i < 0 || j < 0 || j >= blocks.length) return;
        [blocks[i], blocks[j]] = [blocks[j], blocks[i]];
        renderBlocks(); updatePreview();
    }
    function updateBlockField(id, key, value) {
        const b = blocks.find(x => x.id === id);
        if (!b) return;
        b.data[key] = value;
        updatePreview();
    }

    // ---------- Render block editors ----------
    function renderBlocks() {
        const wrap = document.getElementById('blocks');
        const empty = document.getElementById('emptyHint');
        empty.style.display = blocks.length ? 'none' : '';
        wrap.innerHTML = blocks.map(b => {
            const def = BLOCK_DEFS[b.type];
            const fields = def.fields.map(f => fieldHTML(b, f)).join('');
            return `
              <div class="ed-block" data-id="${b.id}">
                <div class="ed-block-head">
                  <div class="ed-block-type">${def.label}</div>
                  <div class="ed-block-actions">
                    <button title="העלה" onclick="window._ed.move(${b.id}, -1)">↑</button>
                    <button title="הורד" onclick="window._ed.move(${b.id}, 1)">↓</button>
                    <button class="del" title="מחק" onclick="window._ed.del(${b.id})">🗑</button>
                  </div>
                </div>
                <div class="ed-block-fields">${fields || '<div class="ed-hint">אין הגדרות לבלוק זה</div>'}</div>
              </div>`;
        }).join('');
    }

    function esc(s) { return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

    function fieldHTML(b, f) {
        const v = b.data[f.k] || '';
        const oninput = `oninput="window._ed.set(${b.id}, '${f.k}', this.value)"`;
        const onchange = `onchange="window._ed.set(${b.id}, '${f.k}', this.value)"`;
        if (f.t === 'textarea' || f.t === 'list') {
            return `<label>${f.label}<textarea ${oninput} placeholder="${esc(f.ph||'')}">${esc(v)}</textarea></label>`;
        }
        if (f.t === 'select') {
            return `<label>${f.label}<select ${onchange}>${f.opts.map(o => `<option value="${o}" ${o===v?'selected':''}>${o}</option>`).join('')}</select></label>`;
        }
        return `<label>${f.label}<input type="text" ${oninput} value="${esc(v)}" placeholder="${esc(f.ph||'')}"></label>`;
    }

    window._ed = { set: updateBlockField, del: removeBlock, move: moveBlock };

    // ---------- Build article JSON ----------
    function buildArticle() {
        const art = {
            title:  val('f-title'),
            month:  val('f-month'),
            tag:    val('f-tag'),
            author: val('f-author'),
            date:   val('f-date'),
        };
        const img = val('f-img');
        if (img) art.img = img;
        art.blocks = blocks.map(b => {
            const o = { type: b.type };
            if (b.type === 'list') {
                o.style = b.data.style || 'ul';
                o.items = (b.data.items || '').split('\n').map(s => s.trim()).filter(Boolean);
            } else if (b.type === 'gallery') {
                o.images = (b.data.images || '').split('\n').map(s => s.trim()).filter(Boolean);
            } else if (b.type === 'table') {
                o.headers = (b.data.headers || '').split('|').map(s => s.trim()).filter(Boolean);
                o.rows = (b.data.rows || '').split('\n').map(line => line.split('|').map(s => s.trim())).filter(r => r.length);
            } else if (b.type === 'calendar') {
                o.title = b.data.title || '';
                o.events = (b.data.events || '').split('\n').map(l => {
                    const [d, ...rest] = l.split('|');
                    return { date: (d||'').trim(), text: rest.join('|').trim() };
                }).filter(e => e.date || e.text);
            } else {
                Object.keys(b.data).forEach(k => { if (b.data[k] !== '') o[k] = b.data[k]; });
            }
            return o;
        });
        return art;
    }
    function val(id) { const e = document.getElementById(id); return e ? e.value.trim() : ''; }

    // ---------- Preview ----------
    function resolveAsset(s) {
        if (!s) return '';
        if (/^(https?:|assets\/|data:)/.test(s)) return s;
        return 'assets/' + s;
    }
    function blockPreview(b) {
        const d = b.data;
        switch (b.type) {
            case 'heading':   return `<h2 class="b">${esc(d.text)}</h2>`;
            case 'paragraph': return `<p>${esc(d.text).replace(/\n/g,'<br>')}</p>`;
            case 'image':     return d.src ? `<figure><img src="${resolveAsset(d.src)}" alt="">${d.caption?`<figcaption>${esc(d.caption)}</figcaption>`:''}</figure>` : '';
            case 'gallery': {
                const items = (d.images||'').split('\n').map(s=>s.trim()).filter(Boolean);
                return `<div class="gallery-prev">${items.map(i=>`<img src="${resolveAsset(i)}" alt="">`).join('')}</div>`;
            }
            case 'video':     return d.src ? `<video src="${resolveAsset(d.src)}" controls ${d.poster?`poster="${resolveAsset(d.poster)}"`:''}></video>` : '';
            case 'youtube':   return d.id ? `<iframe width="100%" height="240" src="https://www.youtube.com/embed/${esc(d.id)}" frameborder="0" allowfullscreen></iframe>` : '';
            case 'quote':     return `<blockquote>${esc(d.text)}${d.cite?`<br><small>— ${esc(d.cite)}</small>`:''}</blockquote>`;
            case 'list': {
                const items = (d.items||'').split('\n').map(s=>s.trim()).filter(Boolean);
                const tag = d.style === 'ol' ? 'ol' : 'ul';
                return `<${tag}>${items.map(i=>`<li>${esc(i)}</li>`).join('')}</${tag}>`;
            }
            case 'table': {
                const heads = (d.headers||'').split('|').map(s=>s.trim()).filter(Boolean);
                const rows = (d.rows||'').split('\n').map(l=>l.split('|').map(s=>s.trim())).filter(r=>r.length);
                return `<table>${heads.length?`<thead><tr>${heads.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead>`:''}<tbody>${rows.map(r=>`<tr>${r.map(c=>`<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
            }
            case 'link':      return d.url ? `<p><a href="${esc(d.url)}" target="_blank" rel="noopener">${esc(d.text || d.url)}</a></p>` : '';
            case 'file':      return d.src ? `<p>📎 <a href="${resolveAsset(d.src)}" download>${esc(d.name || d.src)}</a></p>` : '';
            case 'calendar': {
                const events = (d.events||'').split('\n').map(l=>{const[da,...r]=l.split('|');return{date:(da||'').trim(),text:r.join('|').trim()};}).filter(e=>e.date||e.text);
                return `<div class="cal-prev"><strong>${esc(d.title||'לוח שנה')}</strong><ul>${events.map(e=>`<li><b>${esc(e.date)}</b> — ${esc(e.text)}</li>`).join('')}</ul></div>`;
            }
            case 'divider':   return '<hr>';
        }
        return '';
    }

    function updatePreview() {
        const art = buildArticle();
        const meta = [art.tag && '#'+art.tag, art.author, art.date].filter(Boolean).join(' • ');
        const cover = art.img ? `<img src="${resolveAsset(art.img)}" alt="">` : '';
        const body = (art.blocks||[]).map(b => blockPreview({type:b.type,data:blocks.find(x=>x.type===b.type && JSON.stringify(rawData(x))===JSON.stringify(b))?.data || b})).join('');
        // simpler: re-render from current blocks state directly
        const bodyHTML = blocks.map(blockPreview).join('');
        document.getElementById('preview').innerHTML = `
            <h1>${esc(art.title || '(ללא כותרת)')}</h1>
            <div class="meta">${esc(meta)}</div>
            ${cover}
            ${bodyHTML || '<p style="color:#888">הוסיפו בלוקים כדי לראות תצוגה מקדימה.</p>'}
        `;
        document.getElementById('jsonOut').textContent = JSON.stringify(art, null, 2);
    }
    function rawData(x){return x.data;}

    // ---------- Tabs ----------
    window.showTab = function (name) {
        document.querySelectorAll('.ed-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === name));
        document.querySelectorAll('.ed-tab-content').forEach(c => c.classList.toggle('active', c.id === 'tab-'+name));
    };

    // ---------- Export / copy / download ----------
    window.exportJSON = function () { showTab('json'); toast('הקוד מוכן ✓ העתיקו והדביקו ב-articles.js'); };
    window.copyJSON = function () {
        const txt = document.getElementById('jsonOut').textContent;
        navigator.clipboard.writeText(txt).then(() => toast('הועתק ללוח ✓'), () => toast('ההעתקה נכשלה'));
    };
    window.downloadJSON = function () {
        const blob = new Blob([document.getElementById('jsonOut').textContent], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = (val('f-title')||'article') + '.json';
        a.click(); URL.revokeObjectURL(url);
    };

    // ---------- Draft (localStorage) ----------
    window.saveDraft = function () {
        const payload = { meta: {
            title: val('f-title'), month: val('f-month'), tag: val('f-tag'),
            author: val('f-author'), date: val('f-date'), img: val('f-img')
        }, blocks, nextId };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
        toast('הטיוטה נשמרה ✓');
    };
    window.loadDraft = function () {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return toast('אין טיוטה שמורה');
        try {
            const p = JSON.parse(raw);
            ['title','month','tag','author','date','img'].forEach(k => {
                const el = document.getElementById('f-'+k); if (el) el.value = p.meta?.[k] || '';
            });
            blocks = p.blocks || []; nextId = p.nextId || (blocks.length+1);
            renderBlocks(); updatePreview(); toast('הטיוטה נטענה ✓');
        } catch (e) { toast('שגיאה בטעינת הטיוטה'); }
    };

    function toast(msg) {
        const t = document.getElementById('toast');
        t.textContent = msg; t.classList.add('show');
        clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 2200);
    }

    // ---------- Init ----------
    document.addEventListener('DOMContentLoaded', () => {
        renderBlocks(); updatePreview();
    });
})();
