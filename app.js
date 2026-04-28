/* ============================================================
   app.js — Homepage logic for עתיד שמיר magazine
   - Renders cards (links to article.html?id=N)
   - Filter / search / sort
   - Header background slideshow with manual arrows
   - Mobile horizontal chip scroll
   - Lazy-loading via native loading="lazy" + IntersectionObserver
   ============================================================ */

(function () {
    'use strict';

    // ---------- State ----------
    let currentFilter = 'all';
    let searchQuery = '';
    let isDescending = true;

    // ---------- Helpers ----------
    function getMediaList(art) {
        const list = [];
        if (Array.isArray(art.blocks)) {
            // Pull media from blocks for cover preview
            art.blocks.forEach(b => {
                if (b.type === 'image' && b.src) list.push(b.src);
                else if (b.type === 'video' && b.src) list.push(b.src);
                else if (b.type === 'youtube' && b.id) list.push('yt:' + b.id);
            });
        }
        if (art.media) art.media.forEach(m => list.push(m));
        else if (art.images) art.images.forEach(m => list.push(m));
        else if (art.img) list.push(art.img);
        if (art.youtube) list.push('yt:' + art.youtube);
        return list;
    }

    function resolveAsset(item) {
        if (!item) return '';
        if (item.startsWith('http') || item.startsWith('yt:') || item.startsWith('assets/')) return item;
        return 'assets/' + item;
    }

    function coverThumb(item) {
        if (!item) return '<div style="width:100%;height:100%;background:#1a1a1a;"></div>';
        if (item.startsWith('yt:')) {
            const id = item.replace('yt:', '');
            return `<img class="card-img" loading="lazy" src="https://img.youtube.com/vi/${id}/hqdefault.jpg" alt="">`;
        }
        const path = resolveAsset(item);
        if (/\.(mp4|webm|mov)$/i.test(item)) {
            return `<video class="card-img card-video" muted loop playsinline preload="metadata" src="${path}#t=0.1" onerror="this.style.display='none';this.parentElement.style.background='#1a1a1a';"></video>`;
        }
        return `<img class="card-img" loading="lazy" decoding="async" src="${path}" alt="" onerror="this.style.display='none';this.parentElement.style.background='#1a1a1a';">`;
    }

    function getPlainText(art) {
        if (typeof art.text === 'string' && art.text.trim()) return art.text;
        if (Array.isArray(art.blocks)) {
            const t = art.blocks.find(b => b.type === 'text' || b.type === 'paragraph');
            if (t) return (t.text || t.content || '').replace(/<[^>]+>/g, '');
        }
        return '';
    }

    function uniqueTags() {
        const set = new Set();
        articles.forEach(a => { if (a.tag) set.add(a.tag); });
        return Array.from(set);
    }

    // ---------- Header slideshow ----------
    let headerSlides = [];
    let headerIdx = 0;
    let headerTimer = null;

    // Custom header images live in assets/header/ — list them in window.HEADER_IMAGES (see articles.js)
    // If empty/missing, fall back to first images of recent articles.
    function pickHeaderSlides() {
        if (Array.isArray(window.HEADER_IMAGES) && window.HEADER_IMAGES.length) {
            return window.HEADER_IMAGES.map(p => {
                if (p.startsWith('http') || p.startsWith('assets/')) return p;
                return 'assets/header/' + p;
            });
        }
        const seen = new Set();
        const arr = [...articles].sort((a, b) => {
            const da = new Date(a.date.split('.').reverse().join('-'));
            const db = new Date(b.date.split('.').reverse().join('-'));
            return db - da;
        });
        const out = [];
        for (const art of arr) {
            const ml = getMediaList(art);
            for (const m of ml) {
                if (!m || m.startsWith('yt:') || /\.mp4$/i.test(m)) continue;
                const p = resolveAsset(m);
                if (seen.has(p)) continue;
                seen.add(p);
                out.push(p);
                break;
            }
            if (out.length >= 6) break;
        }
        return out.length ? out : ['logo.png'];
    }

    function buildHeader() {
        headerSlides = pickHeaderSlides();
        const bg = document.getElementById('headerBg');
        const dots = document.getElementById('headerDots');
        bg.innerHTML = headerSlides.map((src, i) =>
            `<div class="header-bg-slide ${i === 0 ? 'active' : ''}" style="background-image:url('${src}')"></div>`
        ).join('');
        dots.innerHTML = headerSlides.map((_, i) =>
            `<div class="h-dot ${i === 0 ? 'active' : ''}" data-i="${i}"></div>`
        ).join('');
        dots.querySelectorAll('.h-dot').forEach(d => {
            d.addEventListener('click', () => goHeaderSlide(parseInt(d.dataset.i)));
        });
        startHeaderTimer();
    }

    function goHeaderSlide(i) {
        if (!headerSlides.length) return;
        headerIdx = (i + headerSlides.length) % headerSlides.length;
        document.querySelectorAll('.header-bg-slide').forEach((el, idx) => {
            el.classList.toggle('active', idx === headerIdx);
        });
        document.querySelectorAll('.h-dot').forEach((el, idx) => {
            el.classList.toggle('active', idx === headerIdx);
        });
        startHeaderTimer();
    }

    function startHeaderTimer() {
        clearInterval(headerTimer);
        headerTimer = setInterval(() => goHeaderSlide(headerIdx + 1), 6000);
    }

    window.prevHeaderSlide = () => goHeaderSlide(headerIdx - 1);
    window.nextHeaderSlide = () => goHeaderSlide(headerIdx + 1);

    // ---------- Filter chips (mobile + desktop) ----------
    function buildCategoryChips() {
        const tags = uniqueTags();

        // Desktop categories (rendered next to the dropdown)
        const desk = document.getElementById('desktopCats');
        if (desk) {
            desk.innerHTML = tags.map(t => `<button class="chip" data-cat="${t}"><span class="chip-dot"></span>${t}</button>`).join('');
            desk.querySelectorAll('.chip').forEach(b => {
                b.addEventListener('click', () => filterBy(b.dataset.cat, b));
            });
        }

        // Mobile menu vertical list (lives inside accordion body)
        const mob = document.querySelector('#mobileCatList .mm-acc-body');
        if (mob) {
            mob.innerHTML =
                `<button class="mobile-filter-btn active" data-cat="all" onclick="filterBy('all'); toggleMobileMenu();"><span class="chip-dot"></span>הכל</button>` +
                tags.map(t => `<button class="mobile-filter-btn" data-cat="${t}" onclick="filterBy('${t}'); toggleMobileMenu();"><span class="chip-dot"></span>${t}</button>`).join('');
        }
    }

    // ---------- Render cards ----------
    function renderArticles() {
        const grid = document.getElementById('main-grid');

        let filtered = articles.filter(a => {
            const matchesFilter = currentFilter === 'all' || a.month === currentFilter || a.tag === currentFilter;
            const text = getPlainText(a).toLowerCase();
            const matchesSearch = !searchQuery
                || (a.title || '').toLowerCase().includes(searchQuery)
                || text.includes(searchQuery)
                || (a.author || '').toLowerCase().includes(searchQuery);
            return matchesFilter && matchesSearch;
        });

        filtered.sort((a, b) => {
            const da = new Date(a.date.split('.').reverse().join('-'));
            const db = new Date(b.date.split('.').reverse().join('-'));
            return isDescending ? db - da : da - db;
        });

        if (!filtered.length) {
            grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:60px 20px;font-size:1.1rem;color:#888;"><i class="fa-solid fa-magnifying-glass" style="margin-left:8px;"></i> לא נמצאו כתבות</div>';
            return;
        }

        grid.innerHTML = filtered.map(art => {
            const id = articles.indexOf(art);
            const ml = getMediaList(art).slice(0, 8);
            const snippet = getPlainText(art).substring(0, 95);
            const slidesHTML = ml.length
                ? ml.map((m, i) => `<div class="card-slide${i === 0 ? ' active' : ''}">${coverThumb(m)}</div>`).join('')
                : `<div class="card-slide active">${coverThumb(null)}</div>`;
            const arrowsHTML = ml.length > 1
                ? `<button class="card-arrow card-arrow-prev" data-dir="-1" aria-label="הקודם"><i class="fa-solid fa-chevron-right"></i></button>
                   <button class="card-arrow card-arrow-next" data-dir="1" aria-label="הבא"><i class="fa-solid fa-chevron-left"></i></button>
                   <div class="card-dots">${ml.map((_, i) => `<span class="card-dot${i === 0 ? ' active' : ''}"></span>`).join('')}</div>`
                : '';
            return `
                <article class="card" data-id="${id}">
                    <div class="card-img-wrapper">
                        <div class="month-badge">${art.month}</div>
                        <div class="card-slides">${slidesHTML}</div>
                        ${arrowsHTML}
                    </div>
                    <a class="card-body" href="article.html?id=${id}" aria-label="${art.title}">
                        <span class="card-tag">#${art.tag || ''}</span>
                        <h3>${art.title}</h3>
                        <p>${snippet}${snippet.length === 95 ? '...' : ''}</p>
                    </a>
                </article>
            `;
        }).join('');

        // Wire up card carousels + video playback
        const playActiveVideo = (c) => {
            c.querySelectorAll('video.card-video').forEach(v => { try { v.pause(); } catch(e){} });
            const v = c.querySelector('.card-slide.active video.card-video');
            if (v) { try { v.play().catch(()=>{}); } catch(e){} }
        };
        grid.querySelectorAll('.card').forEach(card => {
            const slides = card.querySelectorAll('.card-slide');
            const dots = card.querySelectorAll('.card-dot');
            if (slides.length > 1) {
                let i = 0;
                const go = (n) => {
                    i = (n + slides.length) % slides.length;
                    slides.forEach((s, j) => s.classList.toggle('active', j === i));
                    dots.forEach((d, j) => d.classList.toggle('active', j === i));
                    playActiveVideo(card);
                };
                card.querySelectorAll('.card-arrow').forEach(btn => {
                    btn.addEventListener('click', e => {
                        e.preventDefault();
                        e.stopPropagation();
                        go(i + parseInt(btn.dataset.dir));
                    });
                });
            }
            card.addEventListener('mouseenter', () => playActiveVideo(card));
            card.addEventListener('mouseleave', () => {
                card.querySelectorAll('video.card-video').forEach(v => {
                    try { v.pause(); v.currentTime = 0.1; } catch(e){}
                });
            });
        });

        // Mobile: autoplay video of card in view
        if (window.matchMedia('(max-width: 768px)').matches && 'IntersectionObserver' in window) {
            const io = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    const v = entry.target.querySelector('.card-slide.active video.card-video');
                    if (!v) return;
                    if (entry.isIntersecting) { try { v.play().catch(()=>{}); } catch(e){} }
                    else { try { v.pause(); } catch(e){} }
                });
            }, { threshold: 0.5 });
            grid.querySelectorAll('.card').forEach(c => io.observe(c));
        }
    }

    // ---------- Public actions ----------
    window.filterBy = function (val, btn) {
        currentFilter = val;
        // sync UI
        document.querySelectorAll('#filterBar .filter-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.cat === val);
        });
        document.querySelectorAll('.chip').forEach(b => {
            b.classList.toggle('active', b.dataset.cat === val);
        });
        document.querySelectorAll('.mobile-filter-btn[data-cat]').forEach(b => {
            b.classList.toggle('active', b.dataset.cat === val);
        });
        renderArticles();
    };

    window.searchArticles = function (q) {
        searchQuery = (q || '').toLowerCase();
        renderArticles();
    };

    window.toggleSort = function () {
        isDescending = !isDescending;
        const arrow = isDescending
            ? '<i class="fa-solid fa-arrow-down"></i>'
            : '<i class="fa-solid fa-arrow-up"></i>';
        const lbl = (isDescending ? 'מיון: מהחדש לישן ' : 'מיון: מהישן לחדש ') + arrow;
        const lblM = (isDescending ? 'מהחדש לישן ' : 'מהישן לחדש ') + arrow;
        const a = document.getElementById('sortBtn');
        const b = document.getElementById('mobileSortBtn');
        if (a) a.innerHTML = lbl;
        if (b) b.innerHTML = lblM;
        renderArticles();
    };

    window.toggleMobileMenu = function () {
        const menu = document.getElementById('mobileMenu');
        const ham = document.querySelector('.school-nav-burger') || document.querySelector('.hamburger-btn');
        const backdrop = document.getElementById('mobileMenuBackdrop');
        const isOpen = menu.classList.toggle('active');
        if (ham) ham.classList.toggle('active', isOpen);
        if (backdrop) backdrop.classList.toggle('active', isOpen);
        document.body.style.overflow = isOpen ? 'hidden' : '';
    };

    // ---------- Countdown ----------
    function updateCountdown() {
        const target = new Date('April 22, 2026').getTime();
        const diff = target - Date.now();
        const days = Math.floor(diff / 86400000);
        const txt = days > 0 ? days : 'חופשה נעימה!';
        const a = document.getElementById('countdown');
        const b = document.getElementById('mobileCountdown');
        if (a) a.innerText = txt;
        if (b) b.innerText = txt;
    }

    // ---------- Subscribe forms ----------
    function bindForms() {
        ['subForm', 'mobileSubForm'].forEach((id, i) => {
            const f = document.getElementById(id);
            if (!f) return;
            f.addEventListener('submit', () => {
                setTimeout(() => {
                    const m = document.getElementById(i === 0 ? 'subMsg' : 'mobileSubMsg');
                    if (m) m.style.display = 'block';
                    f.reset();
                }, 400);
            });
        });
    }

    // ---------- Scroll-to-top button ----------
    function bindScrollTop() {
        const btn = document.getElementById('scrollTopBtn');
        if (!btn) return;
        window.addEventListener('scroll', () => {
            btn.classList.toggle('show', window.scrollY > 400);
        }, { passive: true });
    }

    // ---------- Init ----------
    document.addEventListener('DOMContentLoaded', () => {
        buildHeader();
        buildCategoryChips();
        renderArticles();
        updateCountdown();
        bindForms();
        bindScrollTop();
    });
})();
