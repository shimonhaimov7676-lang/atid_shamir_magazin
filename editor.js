/* ============================================================
   editor.js — Visual article editor for עתיד שמיר
   ============================================================ */
(function () {
    'use strict';

    const STORAGE_KEY = 'atid_editor_draft_v3';
    let blocks = [];
    let nextId = 1;

    const MONTHS_HE = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];

    // ---------- הגדרת בלוקים ----------
    const BLOCK_DEFS = {
        heading: {
            label: '📰 כותרת',
            fields: [
                { k: 'text', t: 'text', ph: 'טקסט הכותרת', label: 'כותרת' },
                { k: 'level', t: 'select', label: 'גודל', opts: ['h2','h3','h4'], def: 'h2' }
            ]
        },
        paragraph: {
            label: '📄 פסקה',
            fields: [{ k: 'text', t: 'richtext', ph: 'הטקסט של הפסקה...', label: 'תוכן' }]
        },
        image: {
            label: '🖼️ תמונה',
            fields: [
                { k: 'src', t: 'text', ph: 'photo.jpg או URL', label: 'מקור התמונה' },
                { k: 'caption', t: 'text', ph: 'כיתוב (אופציונלי)', label: 'כיתוב' }
            ],
            defaults: { width: 100, align: 'center', wrap: false },
            hasImageControls: true
        },
        gallery: {
            label: '🖼️🖼️ גלריה',
            fields: [
                { k: 'images', t: 'list', ph: 'קובץ או URL לכל שורה', label: 'תמונות (אחת בכל שורה)' },
                { k: 'mode', t: 'select', label: 'תצוגה', opts: ['carousel','grid'], def: 'carousel' }
            ]
        },
        video: {
            label: '🎬 וידאו',
            fields: [
                { k: 'src', t: 'text', ph: 'video.mp4 או URL', label: 'קובץ וידאו' },
                { k: 'poster', t: 'text', ph: 'תמונת תצוגה (אופציונלי)', label: 'פוסטר' }
            ]
        },
        youtube: {
            label: '▶️ יוטיוב',
            fields: [{ k: 'id', t: 'text', ph: 'מזהה הסרטון, לדוגמה: dQw4w9WgXcQ', label: 'YouTube ID' }]
        },
        quote: {
            label: '💬 ציטוט',
            fields: [
                { k: 'text', t: 'richtext', ph: 'הציטוט', label: 'ציטוט' },
                { k: 'cite', t: 'text', ph: 'מקור (אופציונלי)', label: 'שם המצוטט' }
            ]
        },
        list: {
            label: '📋 רשימה',
            fields: [
                { k: 'style', t: 'select', label: 'סוג', opts: ['ul','ol'], def: 'ul' },
                { k: 'items', t: 'list', ph: 'פריט בכל שורה', label: 'פריטים' }
            ]
        },
        table: {
            label: '📊 טבלה',
            fields: [
                { k: 'headers', t: 'text', ph: 'עמודה1 | עמודה2 | עמודה3', label: 'כותרות (מופרדות ב |)' },
                { k: 'rows', t: 'tablepaste', ph: 'הדביקו ישר מאקסל / Google Sheets, או הקלידו תאים מופרדים ב |', label: 'שורות (אפשר להדביק מאקסל!)' }
            ]
        },
        link: {
            label: '🔗 קישור',
            fields: [
                { k: 'text', t: 'text', ph: 'טקסט הקישור', label: 'טקסט' },
                { k: 'url', t: 'text', ph: 'https://...', label: 'כתובת URL' }
            ]
        },
        file: {
            label: '📎 קובץ',
            fields: [
                { k: 'src', t: 'text', ph: 'document.pdf או URL', label: 'קובץ' },
                { k: 'name', t: 'text', ph: 'שם להצגה', label: 'שם להצגה' }
            ]
        },
        calendar: {
            label: '📅 לוח שנה',
            fields: [
                { k: 'mode', t: 'select', label: 'סוג', opts: ['list','google'], def: 'list' },
                { k: 'title', t: 'text', ph: 'אירועי החודש', label: 'כותרת' },
                { k: 'events', t: 'textarea', ph: '22.04 | יום העצמאות\n01.05 | טיול שנתי', label: 'אירועים (תאריך | תיאור) — רק במצב רשימה' },
                { k: 'src', t: 'text', ph: 'https://calendar.google.com/calendar/embed?src=...', label: 'כתובת Google Calendar Embed (רק במצב Google)' }
            ]
        },
        divider: { label: '➖ קו מפריד', fields: [] }
    };

    // ---------- כלי עזר ----------
    function esc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g,'&amp;').replace(/</g,'&lt;')
            .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }
    const $ = id => document.getElementById(id);
    const val = id => { const e = $(id); return e ? e.value.trim() : ''; };

    function resolveAsset(s) {
        if (!s) return '';
        if (/^(https?:|assets\/|data:)/.test(s)) return s;
        return 'assets/' + s;
    }

    function monthFromDate(dateStr) {
        const m = (dateStr || '').match(/^\s*\d{1,2}\.(\d{1,2})\.\d{2,4}\s*$/);
        if (!m) return '';
        const idx = parseInt(m[1], 10) - 1;
        return (idx >= 0 && idx < 12) ? MONTHS_HE[idx] : '';
    }

    // עיצוב inline לתצוגה: **bold**, *italic*, [text](url)
    function formatInline(t) {
        let s = esc(t);
        s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        s = s.replace(/\*([^*\n]+)\*/g, '<em>$1</em>');
        s = s.replace(/_([^_\n]+)_/g, '<em>$1</em>');
        s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
        return s;
    }

    // ---------- ניהול בלוקים ----------
    function addBlock(type) {
        const def = BLOCK_DEFS[type];
        if (!def) return;
        const data = {};
        def.fields.forEach(f => { data[f.k] = f.def || ''; });
        if (def.defaults) Object.assign(data, def.defaults);
        blocks.push({ id: nextId++, type, data });
        renderBlocks();
        updatePreview();
    }
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
    function reorderBlock(fromId, toId, position) {
        if (fromId === toId) return;
        const fromIdx = blocks.findIndex(b => b.id === fromId);
        if (fromIdx < 0) return;
        const [moved] = blocks.splice(fromIdx, 1);
        let toIdx = blocks.findIndex(b => b.id === toId);
        if (toIdx < 0) { blocks.push(moved); }
        else {
            if (position === 'after') toIdx++;
            blocks.splice(toIdx, 0, moved);
        }
        renderBlocks(); updatePreview();
    }
    function setField(id, key, value) {
        const b = blocks.find(x => x.id === id);
        if (!b) return;
        b.data[key] = value;
        updatePreview();
    }

    // ---------- רנדור עורכי הבלוקים ----------
    function renderBlocks() {
        const wrap = $('blocks');
        const empty = $('emptyHint');
        empty.style.display = blocks.length ? 'none' : '';
        wrap.innerHTML = blocks.map(blockEditorHTML).join('');
    }

    function blockEditorHTML(b) {
        const def = BLOCK_DEFS[b.type];
        const fields = def.fields.map(f => fieldHTML(b, f)).join('');
        const imgCtrl = def.hasImageControls ? imageControlsHTML(b) : '';
        return `
          <div class="ed-block" data-id="${b.id}" draggable="true">
            <div class="ed-block-head" data-drag-handle="1">
              <div class="ed-block-type">
                <span class="ed-block-grip" title="גרור כדי לסדר">⋮⋮</span>
                ${def.label}
              </div>
              <div class="ed-block-actions">
                <button data-act="up"   data-id="${b.id}" title="העלה">↑</button>
                <button data-act="down" data-id="${b.id}" title="הורד">↓</button>
                <button class="del" data-act="del" data-id="${b.id}" title="מחק">🗑</button>
              </div>
            </div>
            <div class="ed-block-fields">
              ${fields || '<div class="ed-hint">אין הגדרות לבלוק זה</div>'}
              ${imgCtrl}
            </div>
          </div>`;
    }

    function fieldHTML(b, f) {
        const v = b.data[f.k] == null ? '' : b.data[f.k];
        const attr = `data-bid="${b.id}" data-bkey="${f.k}"`;
        if (f.t === 'richtext') {
            return `<label>${f.label}
              <div class="ed-rt-toolbar" data-rt-for="${b.id}-${f.k}">
                <button type="button" data-rt="bold"   title="מודגש (Ctrl+B)"><b>B</b></button>
                <button type="button" data-rt="italic" title="נטוי (Ctrl+I)"><i>I</i></button>
                <button type="button" data-rt="link"   title="קישור (Ctrl+K)">🔗</button>
                <span class="ed-rt-hint">תומך ב-**מודגש** *נטוי* [טקסט](URL)</span>
              </div>
              <textarea ${attr} id="rt-${b.id}-${f.k}" placeholder="${esc(f.ph||'')}">${esc(v)}</textarea>
            </label>`;
        }
        if (f.t === 'tablepaste') {
            return `<label>${f.label}
              <span class="ed-rt-hint" style="display:block;margin-bottom:4px;">💡 העתיקו תאים מאקסל / Google Sheets והדביקו כאן (Ctrl+V) — נמיר אוטומטית.</span>
              <textarea ${attr} data-tablepaste="1" placeholder="${esc(f.ph||'')}">${esc(v)}</textarea>
            </label>`;
        }
        if (f.t === 'textarea' || f.t === 'list') {
            return `<label>${f.label}<textarea ${attr} placeholder="${esc(f.ph||'')}">${esc(v)}</textarea></label>`;
        }
        if (f.t === 'select') {
            return `<label>${f.label}<select ${attr}>${
                f.opts.map(o => `<option value="${o}" ${o===v?'selected':''}>${o}</option>`).join('')
            }</select></label>`;
        }
        return `<label>${f.label}<input type="text" ${attr} value="${esc(v)}" placeholder="${esc(f.ph||'')}"></label>`;
    }

    function imageControlsHTML(b) {
        const w = b.data.width || 100;
        const a = b.data.align || 'center';
        const wrap = !!b.data.wrap;
        const wrapDisabled = w >= 100;
        return `
          <div class="ed-image-controls">
            <label>גודל: <span data-width-label="${b.id}">${w}%</span>
              <input type="range" min="20" max="100" value="${w}" data-bid="${b.id}" data-bkey="width">
            </label>
            <div class="ed-align-group" data-bid="${b.id}">
              <button type="button" data-align="right"  class="${a==='right'?'active':''}"  title="ימין">⇥</button>
              <button type="button" data-align="center" class="${a==='center'?'active':''}" title="מרכז">≡</button>
              <button type="button" data-align="left"   class="${a==='left'?'active':''}"   title="שמאל">⇤</button>
            </div>
            <label class="ed-wrap-toggle" title="${wrapDisabled?'זמין רק כשהרוחב מתחת ל-100%':'טקסט יזרום סביב התמונה'}">
              <input type="checkbox" data-bid="${b.id}" data-bkey="wrap" ${wrap?'checked':''} ${wrapDisabled?'disabled':''}>
              טקסט עוטף
            </label>
          </div>`;
    }

    // ---------- בניית JSON ----------
    function buildArticle() {
        const date = val('f-date');
        const art = {
            title:  val('f-title'),
            month:  monthFromDate(date),
            tag:    val('f-tag'),
            author: val('f-author'),
            date:   date,
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
                if (b.data.mode && b.data.mode !== 'carousel') o.mode = b.data.mode;
            } else if (b.type === 'table') {
                o.headers = (b.data.headers || '').split('|').map(s => s.trim()).filter(Boolean);
                o.rows = (b.data.rows || '').split('\n').map(line => line.split('|').map(s => s.trim())).filter(r => r.length && r.some(c=>c));
            } else if (b.type === 'calendar') {
                o.mode = b.data.mode || 'list';
                if (o.mode === 'google') {
                    if (b.data.src) o.src = b.data.src;
                    if (b.data.title) o.title = b.data.title;
                } else {
                    o.title = b.data.title || '';
                    o.events = (b.data.events || '').split('\n').map(l => {
                        const [d, ...rest] = l.split('|');
                        return { date: (d||'').trim(), text: rest.join('|').trim() };
                    }).filter(e => e.date || e.text);
                }
            } else if (b.type === 'image') {
                if (b.data.src)     o.src = b.data.src;
                if (b.data.caption) o.caption = b.data.caption;
                const w = parseInt(b.data.width, 10);
                if (w && w !== 100)             o.width = w;
                if (b.data.align && b.data.align !== 'center') o.align = b.data.align;
                if (b.data.wrap && w < 100)     o.wrap = true;
            } else {
                Object.keys(b.data).forEach(k => { if (b.data[k] !== '' && b.data[k] != null) o[k] = b.data[k]; });
            }
            return o;
        });
        return art;
    }

    // ---------- תצוגה מקדימה ----------
    function blockPreview(b) {
        const d = b.data;
        switch (b.type) {
            case 'heading': {
                const lvl = ['h2','h3','h4'].includes(d.level) ? d.level : 'h2';
                return `<${lvl} class="b">${esc(d.text)}</${lvl}>`;
            }
            case 'paragraph': return `<p>${formatInline(d.text || '').replace(/\n/g,'<br>')}</p>`;
            case 'image': {
                if (!d.src) return '<p style="color:#aaa;font-style:italic;">[תמונה ריקה — הזינו מקור]</p>';
                const w = d.width || 100;
                const a = d.align || 'center';
                const wrapClass = (d.wrap && w < 100) ? ' wrapped' : '';
                return `
                  <div class="ed-img-wrap${wrapClass}" data-bid="${b.id}" data-align="${a}" style="width:${w}%;">
                    <img src="${resolveAsset(d.src)}" alt="${esc(d.caption||'')}" draggable="false">
                    <div class="ed-img-badge"><span data-w="${b.id}">${w}</span>%</div>
                    <div class="ed-img-handle tl" data-h="tl"></div>
                    <div class="ed-img-handle tr" data-h="tr"></div>
                    <div class="ed-img-handle bl" data-h="bl"></div>
                    <div class="ed-img-handle br" data-h="br"></div>
                    <div class="ed-img-handle t"  data-h="t"></div>
                    <div class="ed-img-handle b"  data-h="b"></div>
                    <div class="ed-img-handle l"  data-h="l"></div>
                    <div class="ed-img-handle r"  data-h="r"></div>
                    ${d.caption ? `<div class="ed-img-cap">${esc(d.caption)}</div>` : ''}
                  </div>`;
            }
            case 'gallery': {
                const items = (d.images||'').split('\n').map(s=>s.trim()).filter(Boolean);
                if (!items.length) return '<p style="color:#aaa;font-style:italic;">[גלריה ריקה]</p>';
                if (d.mode === 'grid') {
                    return `<div class="gallery-prev grid">${items.map(i=>`<img src="${resolveAsset(i)}" alt="">`).join('')}</div>`;
                }
                // carousel preview
                return `<div class="gallery-prev-car" data-gid="${b.id}">
                    <div class="gp-track">${items.map(i=>`<img src="${resolveAsset(i)}" alt="">`).join('')}</div>
                    ${items.length>1?`<button class="gp-nav prev" data-dir="-1">❯</button><button class="gp-nav next" data-dir="1">❮</button><div class="gp-count"><span class="gp-i">1</span>/${items.length}</div>`:''}
                </div>`;
            }
            case 'video':
                return d.src ? `<video src="${resolveAsset(d.src)}" controls ${d.poster?`poster="${resolveAsset(d.poster)}"`:''} style="max-width:100%;"></video>` : '';
            case 'youtube':
                return d.id ? `<iframe width="100%" height="240" src="https://www.youtube.com/embed/${esc(d.id)}" frameborder="0" allowfullscreen></iframe>` : '';
            case 'quote':
                return `<blockquote>${formatInline(d.text||'')}${d.cite?`<br><small>— ${esc(d.cite)}</small>`:''}</blockquote>`;
            case 'list': {
                const items = (d.items||'').split('\n').map(s=>s.trim()).filter(Boolean);
                const tag = d.style === 'ol' ? 'ol' : 'ul';
                return `<${tag}>${items.map(i=>`<li>${formatInline(i)}</li>`).join('')}</${tag}>`;
            }
            case 'table': {
                const heads = (d.headers||'').split('|').map(s=>s.trim()).filter(Boolean);
                const rows = (d.rows||'').split('\n').map(l=>l.split('|').map(s=>s.trim())).filter(r=>r.length && r.some(c=>c));
                return `<table class="ed-prev-table" data-bid="${b.id}">${heads.length?`<thead><tr>${heads.map((h,ci)=>`<th contenteditable="true" data-cell="h" data-c="${ci}">${esc(h)}</th>`).join('')}</tr></thead>`:''}<tbody>${rows.map((r,ri)=>`<tr>${r.map((c,ci)=>`<td contenteditable="true" data-cell="r" data-r="${ri}" data-c="${ci}">${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
            }
            case 'link':
                return d.url ? `<p><a href="${esc(d.url)}" target="_blank" rel="noopener">${esc(d.text || d.url)}</a></p>` : '';
            case 'file':
                return d.src ? `<p>📎 <a href="${resolveAsset(d.src)}" download>${esc(d.name || d.src)}</a></p>` : '';
            case 'calendar': {
                if (d.mode === 'google') {
                    if (!d.src) return '<p style="color:#aaa;font-style:italic;">[הזינו כתובת embed של Google Calendar]</p>';
                    return `<div class="cal-prev"><strong>${esc(d.title||'לוח שנה')}</strong><iframe src="${esc(d.src)}" style="width:100%;height:300px;border:0;border-radius:8px;margin-top:8px;"></iframe></div>`;
                }
                const events = (d.events||'').split('\n').map(l=>{
                    const[da,...r]=l.split('|');
                    return{date:(da||'').trim(),text:r.join('|').trim()};
                }).filter(e=>e.date||e.text);
                return `<div class="cal-prev"><strong>${esc(d.title||'לוח שנה')}</strong><ul>${events.map(e=>`<li><b>${esc(e.date)}</b> — ${esc(e.text)}</li>`).join('')}</ul></div>`;
            }
            case 'divider': return '<hr>';
        }
        return '';
    }

    function updatePreview() {
        const art = buildArticle();
        const meta = [art.tag && '#'+art.tag, art.author, art.date, art.month].filter(Boolean).join(' • ');
        const cover = art.img ? `<img src="${resolveAsset(art.img)}" alt="" style="width:100%;border-radius:8px;margin-bottom:12px;">` : '';
        const bodyHTML = blocks.map(blockPreview).join('');
        $('preview').innerHTML = `
            <h1>${esc(art.title || '(ללא כותרת)')}</h1>
            <div class="meta">${esc(meta)}</div>
            ${cover}
            <div class="prev-body">${bodyHTML || '<p style="color:#888">הוסיפו בלוקים כדי לראות תצוגה מקדימה.</p>'}</div>
        `;
        $('jsonOut').textContent = JSON.stringify(art, null, 2);
        initGalleryPreviews();
    }

    // קרוסלה בתצוגה המקדימה
    function initGalleryPreviews() {
        document.querySelectorAll('.gallery-prev-car').forEach(g => {
            const track = g.querySelector('.gp-track');
            const imgs = track.querySelectorAll('img');
            if (imgs.length < 2) return;
            let i = 0;
            const counter = g.querySelector('.gp-i');
            const go = (n) => {
                i = (n + imgs.length) % imgs.length;
                track.style.transform = `translateX(${-i*100}%)`;
                if (counter) counter.textContent = i + 1;
            };
            g.querySelectorAll('.gp-nav').forEach(btn => {
                btn.onclick = () => go(i + parseInt(btn.dataset.dir, 10));
            });
        });
    }

    // ---------- גרירה לסידור בלוקים ----------
    let dragId = null;
    function setupBlockDrag() {
        const wrap = $('blocks');

        // לכבות drag כאשר לוחצים על שדות / כפתורים בתוך הבלוק
        wrap.addEventListener('mousedown', e => {
            const block = e.target.closest('.ed-block');
            if (!block) return;
            const isHandle = e.target.closest('[data-drag-handle], .ed-block-grip');
            const isInteractive = e.target.closest('input, textarea, select, button, label, .ed-image-controls');
            if (isInteractive && !isHandle) {
                block.setAttribute('draggable', 'false');
            } else {
                block.setAttribute('draggable', 'true');
            }
        });
        wrap.addEventListener('mouseup', () => {
            wrap.querySelectorAll('.ed-block').forEach(b => b.setAttribute('draggable','true'));
        });

        wrap.addEventListener('dragstart', e => {
            const b = e.target.closest('.ed-block');
            if (!b || b.getAttribute('draggable') === 'false') { e.preventDefault(); return; }
            dragId = parseInt(b.dataset.id, 10);
            b.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
            try { e.dataTransfer.setData('text/plain', String(dragId)); } catch(err){}
        });
        wrap.addEventListener('dragend', () => {
            wrap.querySelectorAll('.ed-block').forEach(b => {
                b.classList.remove('dragging','drop-above','drop-below');
            });
            dragId = null;
        });
        wrap.addEventListener('dragover', e => {
            const target = e.target.closest('.ed-block');
            if (!target || dragId == null) return;
            e.preventDefault();
            const rect = target.getBoundingClientRect();
            const mid = rect.top + rect.height / 2;
            const pos = e.clientY < mid ? 'above' : 'below';
            wrap.querySelectorAll('.ed-block').forEach(b => b.classList.remove('drop-above','drop-below'));
            target.classList.add('drop-' + pos);
        });
        wrap.addEventListener('drop', e => {
            const target = e.target.closest('.ed-block');
            if (!target || dragId == null) return;
            e.preventDefault();
            const toId = parseInt(target.dataset.id, 10);
            const rect = target.getBoundingClientRect();
            const mid = rect.top + rect.height / 2;
            const position = e.clientY < mid ? 'before' : 'after';
            reorderBlock(dragId, toId, position);
        });
    }

    // ---------- אינטראקציה לתמונות בתצוגה ----------
    function setupImageInteractions() {
        const previewEl = $('preview');

        previewEl.addEventListener('mousedown', e => {
            const handle = e.target.closest('.ed-img-handle');
            if (handle) { startResize(e, handle); return; }
            const img = e.target.closest('.ed-img-wrap img');
            if (img) startMoveAlign(e, img);
        });
    }

    function startResize(e, handle) {
        e.preventDefault();
        e.stopPropagation();
        const wrap = handle.closest('.ed-img-wrap');
        const id = parseInt(wrap.dataset.bid, 10);
        const block = blocks.find(b => b.id === id);
        if (!block) return;
        wrap.classList.add('resizing');

        const parent = wrap.parentElement;
        const parentWidth = parent.getBoundingClientRect().width;
        const startW = parseFloat(wrap.style.width) || 100;
        const startX = e.clientX;
        const handleType = handle.dataset.h;
        const dirRight = ['tr','br','r'].includes(handleType);

        const onMove = ev => {
            const dx = ev.clientX - startX;
            let deltaPct = (dx / parentWidth) * 100;
            // RTL: handle on right pulled left → shrink; on left pulled left → grow
            if (dirRight) deltaPct = -deltaPct;
            const newW = Math.max(20, Math.min(100, Math.round(startW + deltaPct)));
            wrap.style.width = newW + '%';
            block.data.width = newW;
            const lbl = wrap.querySelector(`[data-w="${id}"]`);
            if (lbl) lbl.textContent = newW;
            const rangeInput = document.querySelector(`input[type="range"][data-bid="${id}"][data-bkey="width"]`);
            if (rangeInput) rangeInput.value = newW;
            const widthLabel = document.querySelector(`[data-width-label="${id}"]`);
            if (widthLabel) widthLabel.textContent = newW + '%';
        };
        const onUp = () => {
            wrap.classList.remove('resizing');
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            updatePreview();
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    }

    function startMoveAlign(e, img) {
        e.preventDefault();
        const wrap = img.closest('.ed-img-wrap');
        const id = parseInt(wrap.dataset.bid, 10);
        const block = blocks.find(b => b.id === id);
        if (!block) return;
        const startX = e.clientX;
        let moved = false;

        const onMove = ev => {
            const dx = ev.clientX - startX;
            if (Math.abs(dx) < 25) return;
            moved = true;
            let align = 'center';
            if (dx > 60)  align = 'right';
            if (dx < -60) align = 'left';
            wrap.dataset.align = align;
            block.data.align = align;
            updateAlignButtons(id, align);
        };
        const onUp = () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            if (moved) updatePreview();
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    }

    function updateAlignButtons(id, align) {
        document.querySelectorAll(`.ed-align-group[data-bid="${id}"] button`).forEach(btn => {
            btn.classList.toggle('active', btn.dataset.align === align);
        });
    }

    // ---------- Rich text helpers (B / I / Link) ----------
    function wrapSelection(textarea, before, after) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const sel = textarea.value.substring(start, end) || 'טקסט';
        const newVal = textarea.value.substring(0, start) + before + sel + after + textarea.value.substring(end);
        textarea.value = newVal;
        textarea.focus();
        textarea.setSelectionRange(start + before.length, start + before.length + sel.length);
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
    }

    function insertLink(textarea) {
        const url = prompt('הדביקו את כתובת הקישור (URL):');
        if (!url) return;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const sel = textarea.value.substring(start, end) || prompt('טקסט הקישור:', url) || url;
        wrapSelection(textarea, '[', `](${url})`);
        // התאמה: להחליף את "טקסט" אם לא היה משהו נבחר
        if (textarea.value.includes('[טקסט]')) {
            textarea.value = textarea.value.replace('[טקסט]', '[' + sel + ']');
            textarea.dispatchEvent(new Event('input', { bubbles: true }));
        }
    }

    function applyRT(textarea, action) {
        if (action === 'bold')   wrapSelection(textarea, '**', '**');
        if (action === 'italic') wrapSelection(textarea, '*', '*');
        if (action === 'link')   insertLink(textarea);
    }

    // ---------- הדבקת טבלה מ-Excel/Sheets ----------
    function handleTablePaste(textarea, e) {
        const cd = e.clipboardData || window.clipboardData;
        if (!cd) return;
        const html = cd.getData('text/html');
        const text = cd.getData('text/plain');
        let rows = [];

        if (html && /<table/i.test(html)) {
            const tmp = document.createElement('div');
            tmp.innerHTML = html;
            const trs = tmp.querySelectorAll('tr');
            trs.forEach(tr => {
                const cells = [...tr.querySelectorAll('td,th')].map(c => c.textContent.trim().replace(/\s+/g,' '));
                if (cells.length) rows.push(cells);
            });
        } else if (text && /\t/.test(text)) {
            rows = text.split(/\r?\n/).filter(Boolean).map(line => line.split('\t').map(c => c.trim()));
        } else {
            return; // נתון רגיל
        }

        if (!rows.length) return;
        e.preventDefault();

        // אם יש לפחות שורה אחת — נבקש להפוך את הראשונה לכותרות
        const id = parseInt(textarea.dataset.bid, 10);
        const block = blocks.find(b => b.id === id);
        if (!block) return;

        const useFirstAsHeader = !block.data.headers && rows.length > 1
            ? confirm('להשתמש בשורה הראשונה ככותרות הטבלה?') : false;

        if (useFirstAsHeader) {
            block.data.headers = rows.shift().join(' | ');
        }
        block.data.rows = rows.map(r => r.join(' | ')).join('\n');
        renderBlocks();
        updatePreview();
    }

    // ---------- עריכה בתוך תאי הטבלה בתצוגה ----------
    function setupTableInlineEdit() {
        const previewEl = $('preview');
        previewEl.addEventListener('input', e => {
            const cell = e.target.closest('.ed-prev-table [contenteditable]');
            if (!cell) return;
            const table = cell.closest('.ed-prev-table');
            const id = parseInt(table.dataset.bid, 10);
            const block = blocks.find(b => b.id === id);
            if (!block) return;

            const heads = [...table.querySelectorAll('thead th')].map(c => c.textContent.trim());
            const rows = [...table.querySelectorAll('tbody tr')].map(tr =>
                [...tr.querySelectorAll('td')].map(c => c.textContent.trim())
            );
            block.data.headers = heads.join(' | ');
            block.data.rows = rows.map(r => r.join(' | ')).join('\n');
            // לעדכן רק את ה-JSON, בלי re-render שיגרום לאיבוד פוקוס
            $('jsonOut').textContent = JSON.stringify(buildArticle(), null, 2);
            // לעדכן גם את ה-textarea בעורך
            const ta = document.querySelector(`textarea[data-bid="${id}"][data-bkey="rows"]`);
            if (ta) ta.value = block.data.rows;
            const headInp = document.querySelector(`input[data-bid="${id}"][data-bkey="headers"]`);
            if (headInp) headInp.value = block.data.headers;
        });
    }

    // ---------- חיבור אירועים גלובליים ----------
    function setupEvents() {
        document.querySelectorAll('[data-action]').forEach(btn => {
            btn.addEventListener('click', () => {
                const a = btn.dataset.action;
                if (a === 'load-draft')    loadDraft();
                if (a === 'save-draft')    saveDraft();
                if (a === 'export-json')   exportJSON();
                if (a === 'copy-json')     copyJSON();
                if (a === 'download-json') downloadJSON();
            });
        });

        document.querySelectorAll('.ed-tab').forEach(tab => {
            tab.addEventListener('click', () => showTab(tab.dataset.tab));
        });

        $('blockPicker').addEventListener('click', e => {
            const btn = e.target.closest('button[data-add]');
            if (!btn) return;
            addBlock(btn.dataset.add);
        });

        document.querySelectorAll('[data-bind]').forEach(inp => {
            inp.addEventListener('input', updatePreview);
        });

        const blocksWrap = $('blocks');

        // לחיצות בתוך בלוקים
        blocksWrap.addEventListener('click', e => {
            const btn = e.target.closest('button[data-act]');
            if (btn) {
                const id = parseInt(btn.dataset.id, 10);
                if (btn.dataset.act === 'up')   moveBlock(id, -1);
                if (btn.dataset.act === 'down') moveBlock(id, 1);
                if (btn.dataset.act === 'del')  removeBlock(id);
                return;
            }
            // יישור תמונה
            const align = e.target.closest('.ed-align-group button[data-align]');
            if (align) {
                const id = parseInt(align.parentElement.dataset.bid, 10);
                const b = blocks.find(x => x.id === id);
                if (b) {
                    b.data.align = align.dataset.align;
                    updateAlignButtons(id, align.dataset.align);
                    updatePreview();
                }
                return;
            }
            // toolbar של טקסט עשיר
            const rt = e.target.closest('.ed-rt-toolbar button[data-rt]');
            if (rt) {
                e.preventDefault();
                const tbId = rt.parentElement.dataset.rtFor;
                const ta = document.getElementById('rt-' + tbId);
                if (ta) applyRT(ta, rt.dataset.rt);
                return;
            }
        });

        // שינוי שדה
        blocksWrap.addEventListener('input', e => {
            const t = e.target;
            if (!t.dataset.bid) return;
            const id = parseInt(t.dataset.bid, 10);
            const key = t.dataset.bkey;
            let value = t.value;
            if (t.type === 'range') {
                value = parseInt(value, 10);
                const lbl = document.querySelector(`[data-width-label="${id}"]`);
                if (lbl) lbl.textContent = value + '%';
            }
            if (t.type === 'checkbox') value = t.checked;
            setField(id, key, value);
            // אם רוחב השתנה — לרענן את כפתור ה-wrap (זמין/לא)
            if (key === 'width') {
                const cb = document.querySelector(`input[type="checkbox"][data-bid="${id}"][data-bkey="wrap"]`);
                if (cb) cb.disabled = (value >= 100);
            }
        });
        blocksWrap.addEventListener('change', e => {
            const t = e.target;
            if (!t.dataset.bid) return;
            if (t.tagName === 'SELECT') setField(parseInt(t.dataset.bid, 10), t.dataset.bkey, t.value);
            if (t.type === 'checkbox')  setField(parseInt(t.dataset.bid, 10), t.dataset.bkey, t.checked);
        });

        // קיצור Ctrl+B / Ctrl+I / Ctrl+K בתוך textarea של richtext
        blocksWrap.addEventListener('keydown', e => {
            const ta = e.target.closest('textarea[id^="rt-"]');
            if (!ta) return;
            if (!(e.ctrlKey || e.metaKey)) return;
            const k = e.key.toLowerCase();
            if (k === 'b') { e.preventDefault(); applyRT(ta, 'bold'); }
            if (k === 'i') { e.preventDefault(); applyRT(ta, 'italic'); }
            if (k === 'k') { e.preventDefault(); applyRT(ta, 'link'); }
        });

        // הדבקה לטבלה
        blocksWrap.addEventListener('paste', e => {
            const ta = e.target.closest('textarea[data-tablepaste="1"]');
            if (ta) handleTablePaste(ta, e);
        });

        setupBlockDrag();
        setupImageInteractions();
        setupTableInlineEdit();
    }

    function showTab(name) {
        document.querySelectorAll('.ed-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === name));
        document.querySelectorAll('.ed-tab-content').forEach(c => c.classList.toggle('active', c.id === 'tab-'+name));
    }

    function exportJSON() { showTab('json'); toast('הקוד מוכן ✓ העתיקו והדביקו ב-articles.js'); }
    function copyJSON() {
        navigator.clipboard.writeText($('jsonOut').textContent).then(
            () => toast('הועתק ללוח ✓'),
            () => toast('ההעתקה נכשלה')
        );
    }
    function downloadJSON() {
        const blob = new Blob([$('jsonOut').textContent], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = (val('f-title')||'article') + '.json';
        a.click(); URL.revokeObjectURL(url);
    }

    function saveDraft() {
        const payload = { meta: {
            title: val('f-title'), tag: val('f-tag'),
            author: val('f-author'), date: val('f-date'), img: val('f-img')
        }, blocks, nextId };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
        toast('הטיוטה נשמרה ✓');
    }
    function loadDraft() {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return toast('אין טיוטה שמורה');
        try {
            const p = JSON.parse(raw);
            ['title','tag','author','date','img'].forEach(k => {
                const el = $('f-'+k); if (el) el.value = p.meta?.[k] || '';
            });
            blocks = p.blocks || [];
            nextId = p.nextId || (blocks.length+1);
            renderBlocks(); updatePreview();
            toast('הטיוטה נטענה ✓');
        } catch (e) { toast('שגיאה בטעינת הטיוטה'); }
    }

    function toast(msg) {
        const t = $('toast');
        t.textContent = msg; t.classList.add('show');
        clearTimeout(toast._t);
        toast._t = setTimeout(() => t.classList.remove('show'), 2200);
    }

    document.addEventListener('DOMContentLoaded', () => {
        setupEvents();
        renderBlocks();
        updatePreview();
    });
})();
