/* ============================================================
   article.js — Single article page
   - Reads ?id=N
   - Renders blocks (text/heading/quote/image/video/youtube/list/
     table/link/file/calendar/divider) OR legacy { text, media }
   - Touch-swipe gallery for media
   ============================================================ */

(function () {
    'use strict';

    const params = new URLSearchParams(location.search);
    const id = parseInt(params.get('id'), 10);
    const root = document.getElementById('articleRoot');

    if (isNaN(id) || !articles[id]) {
        root.innerHTML = `
            <div style="text-align:center; padding:60px 20px;">
                <h2 style="color:var(--primary);">כתבה לא נמצאה</h2>
                <p style="color:#777;">חזרו למגזין כדי לבחור כתבה אחרת.</p>
                <a href="index.html" class="back-btn" style="margin-top:20px;">→ חזרה למגזין</a>
            </div>`;
        return;
    }

    const art = articles[id];
    document.title = `${art.title} | מגזין עתיד שמיר`;

    // ---------- Helpers ----------
    function resolveAsset(item) {
        if (!item) return '';
        if (item.startsWith('http') || item.startsWith('yt:') || item.startsWith('assets/')) return item;
        return 'assets/' + item;
    }

    function escapeHTML(s) {
        return String(s || '').replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));
    }

    // Lightweight inline formatter for legacy text + block-text:
    // **bold**, *italic*, _italic_, [text](url), \n -> paragraphs
    function formatInline(t) {
        let s = escapeHTML(t);
        s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        s = s.replace(/(?:^|[^*])\*([^*\n]+)\*/g, m => m.replace(/\*([^*]+)\*/, '<em>$1</em>'));
        s = s.replace(/_([^_\n]+)_/g, '<em>$1</em>');
        s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
        return s;
    }

    function paragraphs(t) {
        return formatInline(t).split(/\n\s*\n|\n/).map(p => `<p>${p}</p>`).join('');
    }

    // ---------- Gallery (touch swipe) ----------
    function buildGallery(items) {
        if (!items || !items.length) return '';
        const slides = items.map(it => {
            if (it.startsWith('yt:')) {
                const vid = it.replace('yt:', '');
                return `<div class="gallery-slide"><iframe src="https://www.youtube.com/embed/${vid}" allowfullscreen loading="lazy"></iframe></div>`;
            }
            const path = resolveAsset(it);
            if (/\.mp4$/i.test(it)) {
                return `<div class="gallery-slide"><video src="${path}" controls preload="metadata" playsinline></video></div>`;
            }
            return `<div class="gallery-slide"><img src="${path}" loading="lazy" decoding="async" alt=""></div>`;
        }).join('');

        const dots = items.length > 1
            ? `<div class="dots-container">${items.map((_, i) => `<div class="dot ${i === 0 ? 'active' : ''}" data-i="${i}"></div>`).join('')}</div>`
            : '';
        const arrows = items.length > 1
            ? `<button class="nav-btn prev-btn" data-dir="-1" aria-label="הקודם"><i class="fa-solid fa-chevron-right"></i></button>
               <button class="nav-btn next-btn" data-dir="1" aria-label="הבא"><i class="fa-solid fa-chevron-left"></i></button>`
            : '';

        return `<div class="gallery" id="gallery">
            <div class="gallery-track" id="galleryTrack">${slides}</div>
            ${arrows}${dots}
        </div>`;
    }

    function initGallery(count) {
        if (count <= 1) return;
        const track = document.getElementById('galleryTrack');
        const dots = document.querySelectorAll('#gallery .dot');
        let idx = 0;

        function go(i) {
            idx = (i + count) % count;
            // RTL flex: tracking moves to the LEFT (negative) to reveal next slide
            track.style.transform = `translateX(${-idx * 100}%)`;
            dots.forEach((d, j) => d.classList.toggle('active', j === idx));
        }

        document.querySelectorAll('#gallery .nav-btn').forEach(btn => {
            btn.addEventListener('click', () => go(idx + parseInt(btn.dataset.dir)));
        });
        dots.forEach(d => d.addEventListener('click', () => go(parseInt(d.dataset.i))));

        // Touch swipe
        let startX = 0, currentX = 0, dragging = false;
        const gallery = document.getElementById('gallery');

        function onStart(e) {
            dragging = true;
            startX = (e.touches ? e.touches[0].clientX : e.clientX);
            track.style.transition = 'none';
        }
        function onMove(e) {
            if (!dragging) return;
            currentX = (e.touches ? e.touches[0].clientX : e.clientX);
            const dx = currentX - startX;
            const pct = (dx / gallery.offsetWidth) * 100;
            track.style.transform = `translateX(${-idx * 100 + pct}%)`;
        }
        function onEnd() {
            if (!dragging) return;
            dragging = false;
            track.style.transition = '';
            const dx = currentX - startX;
            if (Math.abs(dx) > 50) {
                // RTL: swipe right (dx>0) = previous, swipe left = next
                go(dx > 0 ? idx - 1 : idx + 1);
            } else {
                go(idx);
            }
        }

        gallery.addEventListener('touchstart', onStart, { passive: true });
        gallery.addEventListener('touchmove', onMove, { passive: true });
        gallery.addEventListener('touchend', onEnd);

        // Keyboard (RTL: ArrowRight = previous, ArrowLeft = next)
        document.addEventListener('keydown', e => {
            if (e.key === 'ArrowRight') go(idx - 1);
            if (e.key === 'ArrowLeft') go(idx + 1);
        });
    }

    // ---------- Block renderer ----------
    function renderBlock(b) {
        const t = (b.type || '').toLowerCase();
        switch (t) {
            case 'text':
            case 'paragraph':
                return `<div class="block-text">${paragraphs(b.text || b.content || '')}</div>`;
            case 'heading':
            case 'h2':
            case 'h3':
            case 'h4': {
                const lvl = ['h2','h3','h4'].includes(b.level) ? b.level
                          : (t === 'h3' ? 'h3' : (t === 'h4' ? 'h4' : 'h2'));
                return `<${lvl} class="block-heading">${escapeHTML(b.text || b.content || '')}</${lvl}>`;
            }
            case 'quote':
                return `<blockquote class="block-quote">${formatInline(b.text || b.content || '')}${b.author || b.cite ? `<div style="margin-top:10px;font-weight:bold;font-style:normal;color:var(--primary);">— ${escapeHTML(b.author || b.cite)}</div>` : ''}</blockquote>`;
            case 'image': {
                const w = b.width && b.width < 100 ? b.width : null;
                const align = b.align || 'center';
                const wrap = b.wrap && w;
                const styles = [];
                if (w) styles.push(`width:${w}%`);
                const cls = ['block-image'];
                if (wrap) cls.push('wrapped', 'align-' + align);
                else if (w) cls.push('align-' + align);
                return `<figure class="${cls.join(' ')}" style="${styles.join(';')}">
                    <img src="${resolveAsset(b.src)}" loading="lazy" decoding="async" alt="${escapeHTML(b.alt || b.caption || '')}">
                    ${b.caption ? `<figcaption>${escapeHTML(b.caption)}</figcaption>` : ''}
                </figure>`;
            }
            case 'gallery': {
                const items = (b.images || []).map(resolveAsset);
                if (!items.length) return '';
                if (b.mode === 'grid') {
                    return `<div class="block-gallery-grid">${items.map(src => `<img src="${src}" loading="lazy" alt="">`).join('')}</div>`;
                }
                return buildGallery(b.images || []);
            }
            case 'video':
                return `<div class="block-video"><video src="${resolveAsset(b.src)}" controls preload="metadata" playsinline ${b.poster?`poster="${resolveAsset(b.poster)}"`:''}></video></div>`;
            case 'youtube':
                return `<div class="block-video" style="aspect-ratio:16/9;"><iframe src="https://www.youtube.com/embed/${b.id}" allowfullscreen loading="lazy" style="width:100%;height:100%;"></iframe></div>`;
            case 'list': {
                const items = (b.items || []).map(i => `<li>${formatInline(i)}</li>`).join('');
                const cls = b.ordered || b.style === 'ol' ? 'ordered' : 'unordered';
                const tag = b.ordered || b.style === 'ol' ? 'ol' : 'ul';
                return `<${tag} class="block-list ${cls}">${items}</${tag}>`;
            }
            case 'table': {
                const head = b.headers ? `<thead><tr>${b.headers.map(h => `<th>${escapeHTML(h)}</th>`).join('')}</tr></thead>` : '';
                const rows = (b.rows || []).map(r => `<tr>${r.map(c => `<td>${formatInline(c)}</td>`).join('')}</tr>`).join('');
                return `<div class="block-table-wrap"><table class="block-table">${head}<tbody>${rows}</tbody></table></div>`;
            }
            case 'link':
                return `<a class="block-link-card" href="${escapeHTML(b.url)}" target="_blank" rel="noopener">
                    <span class="icon">${b.icon || '🔗'}</span>
                    <span class="lc-text"><strong>${escapeHTML(b.text || b.title || b.url)}</strong>${b.description ? `<span>${escapeHTML(b.description)}</span>` : ''}</span>
                </a>`;
            case 'file':
                return `<a class="block-file" href="${resolveAsset(b.src || b.url)}" target="_blank" rel="noopener" download>
                    📎 ${escapeHTML(b.name || b.label || 'הורדת קובץ')}
                </a>`;
            case 'calendar': {
                if (b.mode === 'google' && b.src) {
                    return `<div class="block-calendar">
                        ${b.title ? `<h3 style="margin:0 0 10px;color:var(--primary);">${escapeHTML(b.title)}</h3>` : ''}
                        <iframe src="${escapeHTML(b.src)}" loading="lazy" style="width:100%;height:500px;border:0;border-radius:12px;"></iframe>
                    </div>`;
                }
                if (b.events && b.events.length) {
                    return `<div class="block-calendar-list">
                        ${b.title ? `<h3 style="margin:0 0 10px;color:var(--primary);">${escapeHTML(b.title)}</h3>` : ''}
                        <ul>${b.events.map(e => `<li><b>${escapeHTML(e.date)}</b> — ${escapeHTML(e.text)}</li>`).join('')}</ul>
                    </div>`;
                }
                return '';
            }
            case 'embed':
                return `<div class="block-video" style="aspect-ratio:16/9;"><iframe src="${escapeHTML(b.src)}" allowfullscreen loading="lazy" style="width:100%;height:100%;"></iframe></div>`;
            case 'divider':
                return `<hr class="block-divider">`;
            default:
                return '';
        }
    }

    // ---------- Build cover gallery for legacy media ----------
    function legacyMediaList(art) {
        const list = [];
        if (art.media) art.media.forEach(m => list.push(m));
        else if (art.images) art.images.forEach(m => list.push(m));
        else if (art.img) list.push(art.img);
        if (art.youtube) list.push('yt:' + art.youtube);
        return list;
    }

    // ---------- Render ----------
    let bodyHTML = '';
    let mediaCount = 0;

    if (Array.isArray(art.blocks) && art.blocks.length) {
        // New blocks format. Extract initial media if author wants a hero gallery.
        const heroMedia = art.cover || legacyMediaList(art);
        if (heroMedia.length) {
            bodyHTML += buildGallery(heroMedia);
            mediaCount = heroMedia.length;
        }
        bodyHTML += '<div class="article-body">' + art.blocks.map(renderBlock).join('') + '</div>';
    } else {
        // Legacy: media gallery + plain text with drop-cap
        const ml = legacyMediaList(art);
        if (ml.length) {
            bodyHTML += buildGallery(ml);
            mediaCount = ml.length;
        }
        bodyHTML += `<div class="article-body legacy-body">${paragraphs(art.text || '')}</div>`;
    }

    root.innerHTML = `
        <h1 class="article-title">${escapeHTML(art.title)}</h1>
        <div class="meta-info">
            <span><i class="fa-solid fa-user-pen"></i> ${escapeHTML(art.author || '')}</span>
            <span><i class="fa-regular fa-calendar"></i> ${escapeHTML(art.date || '')}</span>
            <span><i class="fa-solid fa-tag"></i> ${escapeHTML(art.tag || '')}</span>
            <span><i class="fa-regular fa-calendar-days"></i> ${escapeHTML(art.month || '')}</span>
            <span class="meta-actions">
                <button class="art-act-btn" onclick="shareArticle()" title="שתף"><i class="fa-solid fa-share-nodes"></i> שתף</button>
                <button class="art-act-btn" onclick="window.print()" title="הדפסה"><i class="fa-solid fa-print"></i> הדפסה</button>
                <span id="share-feedback-inline" class="art-act-feedback">הקישור הועתק! <i class="fa-solid fa-check"></i></span>
            </span>
        </div>
        ${bodyHTML}
    `;

    initGallery(mediaCount);

    // ---------- Related articles ----------
    function getCover(a) {
        const list = [];
        if (Array.isArray(a.blocks)) {
            a.blocks.forEach(b => {
                if (b.type === 'image' && b.src) list.push(b.src);
                else if (b.type === 'youtube' && b.id) list.push('yt:' + b.id);
            });
        }
        if (a.media) a.media.forEach(m => list.push(m));
        else if (a.images) a.images.forEach(m => list.push(m));
        else if (a.img) list.push(a.img);
        if (a.youtube) list.push('yt:' + a.youtube);
        const first = list.find(m => m && !/\.mp4$/i.test(m));
        if (!first) return '';
        if (first.startsWith('yt:')) return `https://img.youtube.com/vi/${first.slice(3)}/hqdefault.jpg`;
        return resolveAsset(first);
    }

    function relatedCardHTML(a, i) {
        const cover = getCover(a);
        const bg = cover
            ? `<img src="${cover}" loading="lazy" alt="">`
            : `<div class="rel-fallback"></div>`;
        return `<a class="related-card" href="article.html?id=${i}">
            <div class="rel-thumb">${bg}<span class="rel-month">${escapeHTML(a.month || '')}</span></div>
            <div class="rel-body">
                <span class="rel-tag">#${escapeHTML(a.tag || '')}</span>
                <h4>${escapeHTML(a.title)}</h4>
            </div>
        </a>`;
    }

    function renderRelated() {
        // Same tag first, then fill with most recent others. Exclude current.
        const others = articles
            .map((a, i) => ({ a, i }))
            .filter(x => x.i !== id);

        const sameTag = others.filter(x => x.a.tag && art.tag && x.a.tag === art.tag);
        const rest = others.filter(x => !sameTag.includes(x));

        const sortByDate = (arr) => arr.sort((x, y) => {
            const dx = new Date((x.a.date || '').split('.').reverse().join('-'));
            const dy = new Date((y.a.date || '').split('.').reverse().join('-'));
            return dy - dx;
        });

        sortByDate(sameTag);
        sortByDate(rest);

        const ordered = [...sameTag, ...rest];

        const right = document.getElementById('relatedRight');
        const left = document.getElementById('relatedLeft');
        const mob = document.getElementById('relatedMobile');

        const rightItems = ordered.slice(0, 3);
        const leftItems = ordered.slice(3, 6);
        const mobItems = ordered.slice(0, 4);

        if (right) right.innerHTML = `<h3 class="related-title">קראו גם</h3>` + rightItems.map(x => relatedCardHTML(x.a, x.i)).join('');
        if (left) left.innerHTML = `<h3 class="related-title">כתבות נוספות</h3>` + leftItems.map(x => relatedCardHTML(x.a, x.i)).join('');
        if (mob) mob.innerHTML = `<h3 class="related-title">כתבות נוספות</h3><div class="related-mobile-grid">${mobItems.map(x => relatedCardHTML(x.a, x.i)).join('')}</div>`;
    }
    renderRelated();

    // ---------- Share ----------
    window.shareArticle = function () {
        const url = location.href;
        const fb = document.getElementById('share-feedback-inline') || document.getElementById('share-feedback');
        const done = () => {
            if (!fb) return;
            fb.classList.add('show');
            setTimeout(() => fb.classList.remove('show'), 2000);
        };
        if (navigator.clipboard) {
            navigator.clipboard.writeText(url).then(done).catch(done);
        }
        if (navigator.share) {
            navigator.share({ title: art.title, url }).catch(() => {});
        }
    };
})();
