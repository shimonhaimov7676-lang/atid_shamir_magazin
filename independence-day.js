/* ============================================================
   independence-day.js — ווידג'ט דגל ישראל מתנופף ליום העצמאות
   קובץ עצמאי. כדי להסיר: למחוק את הקובץ הזה ואת השורה
   <script src="independence-day.js"></script> מ-index.html ומ-article.html
   ============================================================ */
(function () {
    'use strict';

    // הווידג'ט יוצג רק בחודשים אפריל-מאי (סביב יום העצמאות).
    // כדי להציג תמיד — להחליף את התנאי ב-true.
    const now = new Date();
    const month = now.getMonth(); // 0=ינואר
    const showAlways = false;
    if (!showAlways && month !== 3 && month !== 4) return;

    const css = `
    .il-flag-widget {
        position: fixed;
        bottom: 22px;
        left: 22px;
        width: 78px;
        height: 78px;
        z-index: 90;
        cursor: pointer;
        animation: il-flag-pop 0.6s ease-out;
        filter: drop-shadow(0 4px 10px rgba(0,0,0,0.18));
    }
    .il-flag-widget .pole {
        position: absolute;
        right: 8px;
        top: 4px;
        width: 3px;
        height: 74px;
        background: linear-gradient(180deg, #c9a96b, #8b7240);
        border-radius: 2px;
    }
    .il-flag-widget .pole::before {
        content: "";
        position: absolute;
        top: -4px; left: -2px;
        width: 7px; height: 7px;
        background: #c9a96b;
        border-radius: 50%;
    }
    .il-flag-widget .flag {
        position: absolute;
        right: 11px;
        top: 6px;
        width: 56px;
        height: 38px;
        background: #fff;
        border-top: 6px solid #0038b8;
        border-bottom: 6px solid #0038b8;
        transform-origin: right center;
        animation: il-flag-wave 2.4s ease-in-out infinite;
        box-shadow: inset -8px 0 14px -8px rgba(0,0,0,0.15);
    }
    .il-flag-widget .star {
        position: absolute;
        top: 50%; left: 50%;
        width: 16px; height: 16px;
        transform: translate(-50%, -50%);
        background:
            linear-gradient(0deg, transparent 40%, #0038b8 40%, #0038b8 60%, transparent 60%),
            linear-gradient(60deg, transparent 40%, #0038b8 40%, #0038b8 60%, transparent 60%),
            linear-gradient(-60deg, transparent 40%, #0038b8 40%, #0038b8 60%, transparent 60%);
    }
    .il-flag-tip {
        position: absolute;
        bottom: 100%;
        left: 0;
        margin-bottom: 8px;
        background: #1a1a1a;
        color: #fff;
        padding: 6px 12px;
        border-radius: 8px;
        font-size: 0.82rem;
        white-space: nowrap;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.25s;
    }
    .il-flag-widget:hover .il-flag-tip { opacity: 1; }
    @keyframes il-flag-wave {
        0%, 100% { transform: skewY(-3deg) scaleX(1); }
        50%      { transform: skewY(3deg)  scaleX(0.96); }
    }
    @keyframes il-flag-pop {
        from { transform: scale(0) rotate(-20deg); opacity: 0; }
        to   { transform: scale(1) rotate(0);     opacity: 1; }
    }
    @media (max-width: 600px) {
        .il-flag-widget { width: 60px; height: 60px; bottom: 14px; left: 14px; }
        .il-flag-widget .pole  { height: 56px; }
        .il-flag-widget .flag  { width: 44px; height: 30px; border-width: 5px; }
        .il-flag-widget .star  { width: 12px; height: 12px; }
    }`;

    const style = document.createElement('style');
    style.id = 'il-flag-style';
    style.textContent = css;
    document.head.appendChild(style);

    const wrap = document.createElement('div');
    wrap.className = 'il-flag-widget';
    wrap.title = 'יום העצמאות שמח 🇮🇱';
    wrap.innerHTML = `
        <div class="pole"></div>
        <div class="flag"><div class="star"></div></div>
        <div class="il-flag-tip">חג עצמאות שמח 🇮🇱</div>
    `;
    wrap.addEventListener('click', () => {
        wrap.style.animation = 'none';
        void wrap.offsetWidth;
        wrap.style.animation = 'il-flag-pop 0.6s ease-out';
    });

    document.addEventListener('DOMContentLoaded', () => document.body.appendChild(wrap));
})();
