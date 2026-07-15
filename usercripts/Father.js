// ==UserScript==
// @name         2KGT Multi-Script Loader (Father)
// @namespace    http://tampermonkey.net/
// @version      9.2.0
// @description  Dock 45px kiểu LiveContainer (Shadow DOM cô lập), kéo thả + ẩn mép, mở rộng để bật/tắt 7 userscript con.
// @match        *://*/*
// @run-at       document-end
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    // ==== CẤU HÌNH SCRIPT CON ====
    const BASE_URL = "https://raw.githubusercontent.com/2KGT/sv/main/usercripts/";

    const SCRIPTS = [
        { key: "act_yt_translate", name: "YouTube Auto-translate", icon: "💬", file: "ACT.YouTube.DM.Auto-translate.user.js", color: "#FF0000" },
        { key: "adguard_extra", name: "AdGuard Extra", icon: "🛡️", file: "AdGuard Extra.user.js", color: "#68BC71" },
        { key: "auto_translate_vi", name: "Dịch sang Tiếng Việt", icon: "🌐", file: "auto translate vi_user.js", color: "#0a84ff" },
        { key: "image_grid", name: "Image Grid Lister", icon: "🏞️", file: "image-grid-lister_user.js", color: "#4A90D9" },
        { key: "open_inapp", name: "Mở App khi bấm link", icon: "↗️", file: "open inapp.user.js", color: "#1F76F4" },
    ];

    const STORAGE_KEY = "father_active_scripts";

    function loadActiveState() {
        try {
            const raw = sessionStorage.getItem(STORAGE_KEY);
            return raw ? JSON.parse(raw) : {};
        } catch {
            return {};
        }
    }
    function saveActiveState(state) {
        try {
            sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        } catch { /* ignore */ }
    }
    let activeState = loadActiveState();

    async function loadAndRun(scriptDef) {
        const url = BASE_URL + encodeURIComponent(scriptDef.file).replace(/%2F/g, "/");
        try {
            const res = await fetch(url, { cache: "no-store" });
            if (!res.ok) throw new Error("HTTP " + res.status);
            const code = await res.text();
            const runner = new Function(code);
            runner();
            return { success: true };
        } catch (e) {
            return { success: false, error: e.message };
        }
    }

    async function toggleScript(scriptDef, btnEl) {
        const isActive = !!activeState[scriptDef.key];

        if (!isActive) {
            btnEl.classList.add('loading');
            btnEl.classList.remove('on', 'error');
            const result = await loadAndRun(scriptDef);
            btnEl.classList.remove('loading');
            if (result.success) {
                activeState[scriptDef.key] = true;
                saveActiveState(activeState);
                btnEl.classList.add('on');
            } else {
                btnEl.classList.add('error');
                setTimeout(() => btnEl.classList.remove('error'), 2000);
            }
        } else {
            const confirmReload = confirm(
                scriptDef.name + " đang bật.\nBấm OK để tải lại trang (khôi phục bản gốc)."
            );
            if (confirmReload) {
                delete activeState[scriptDef.key];
                saveActiveState(activeState);
                location.reload();
            }
        }
    }

    // ==== 1. Tạo Container gốc (Shadow DOM cô lập hoàn toàn khỏi CSS trang web) ====
    const container = document.createElement('div');
    container.id = 'father-multitask-container';
    container.style.cssText = 'position:fixed !important; z-index:2147483647 !important; right:4px !important; top:50% !important; transform:translateY(-50%) !important; touch-action:none !important; user-select:none !important;';
    const shadow = container.attachShadow({ mode: 'open' });

    // ==== 2. CSS hệ thống - Dock 45px & Vuốt ẩn 2/3 ====
    const style = document.createElement('style');
    style.textContent = `
        :host {
            display: block !important;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
            transition: right 0.4s cubic-bezier(0.16, 1, 0.3, 1), left 0.4s cubic-bezier(0.16, 1, 0.3, 1), top 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease !important;
        }

        :host(.dragging) { transition: none !important; }

        :host(.edge-hidden-right) { right: -31px !important; opacity: 0.6 !important; }
        :host(.edge-hidden-left) { left: -31px !important; opacity: 0.6 !important; }

        :host(:hover) { opacity: 1 !important; }

        .dock-main {
            display: inline-flex !important;
            flex-direction: column !important;
            align-items: center !important;
            padding: 4px !important;
            background: rgba(245, 245, 247, 0.85) !important;
            backdrop-filter: blur(20px) saturate(190%) !important;
            -webkit-backdrop-filter: blur(20px) saturate(190%) !important;
            border-radius: 13px !important;
            box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.06), 0 8px 24px rgba(0, 0, 0, 0.08) !important;
            box-sizing: border-box !important;
            transition: all 0.35s cubic-bezier(0.16, 1, 0.3, 1) !important;
            overflow: hidden !important;

            min-width: 45px !important;
            max-width: 45px !important;
            min-height: 45px !important;
            max-height: 45px !important;
        }

        .dock-main.expanded {
            border-radius: 14px !important;
            min-height: 240px !important;
            max-height: 310px !important;
            background: rgba(255, 255, 255, 0.95) !important;
            box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.08), 0 12px 36px rgba(0, 0, 0, 0.15) !important;
        }

        .btn-main-toggle {
            width: 37px !important;
            height: 37px !important;
            border-radius: 9px !important;
            border: none !important;
            background: #0a84ff !important;
            color: #ffffff !important;
            cursor: move !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            outline: none !important;
            box-sizing: border-box !important;
            flex-shrink: 0 !important;
            touch-action: none !important;
            transition: background 0.2s, border-radius 0.3s, transform 0.1s !important;
            z-index: 5 !important;
            box-shadow: 0 2px 6px rgba(10, 132, 255, 0.35) !important;
        }

        .btn-main-toggle:active { transform: scale(0.92) !important; }
        .btn-main-toggle svg { transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1) !important; }
        .dock-main.expanded .btn-main-toggle svg { transform: rotate(180deg) !important; }

        @media (prefers-color-scheme: dark) {
            .dock-main {
                background: rgba(28, 28, 30, 0.85) !important;
                box-shadow: inset 0 0 0 0.5px rgba(255, 255, 255, 0.08), 0 8px 24px rgba(0, 0, 0, 0.25) !important;
            }
            .dock-main.expanded {
                background: rgba(28, 28, 30, 0.96) !important;
            }
        }

        .apps-sub-container-bg {
            width: 37px !important;
            display: flex !important;
            flex-direction: column !important;
            background: transparent !important;
            border-radius: 9px !important;
            margin-top: 0px !important;
            box-sizing: border-box !important;
            overflow: hidden !important;
            flex-shrink: 0 !important;

            opacity: 0 !important;
            max-height: 0px !important;
            transform: scale(0.95) translateY(-6px) !important;
            transition: opacity 0.2s ease, transform 0.28s cubic-bezier(0.16, 1, 0.3, 1), max-height 0.3s ease, margin-top 0.2s !important;
        }

        .dock-main.expanded .apps-sub-container-bg {
            opacity: 1 !important;
            max-height: 255px !important;
            margin-top: 6px !important;
            transform: scale(1) translateY(0) !important;
        }

        .apps-scroll-layer {
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            gap: 12px !important;
            width: 37px !important;
            padding: 2px 0 !important;
            overflow-y: auto !important;
            overflow-x: hidden !important;
            scrollbar-width: none !important;
            -webkit-overflow-scrolling: touch !important;
        }
        .apps-scroll-layer::-webkit-scrollbar { display: none !important; }

        .btn-app {
            position: relative !important;
            width: 37px !important;
            height: 37px !important;
            border-radius: 9px !important;
            border: none !important;
            cursor: pointer !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            font-size: 17px !important;
            transition: transform 0.12s ease, opacity 0.25s ease, filter 0.25s ease !important;
            padding: 0 !important;
            overflow: visible !important;
            outline: none !important;
            box-sizing: border-box !important;
            flex-shrink: 0 !important;

            /* Mặc định (tắt): mờ và giảm bão hòa màu để tách biệt rõ với trạng thái bật */
            opacity: 0.42 !important;
            filter: grayscale(55%) !important;
        }
        .btn-app:active { transform: scale(0.88) !important; }

        /* Đang bật: hiện rõ nét, màu đầy đủ, nổi bật hẳn so với các icon tắt xung quanh */
        .btn-app.on {
            opacity: 1 !important;
            filter: grayscale(0%) !important;
        }
        /* Đang tải / lỗi: cũng hiện rõ để dễ thấy phản hồi ngay lập tức */
        .btn-app.loading,
        .btn-app.error {
            opacity: 1 !important;
            filter: grayscale(0%) !important;
        }

        /* Viền sáng quanh icon theo trạng thái - dày và rõ hơn để nổi bật khi bật */
        .btn-app::after {
            content: '';
            position: absolute;
            inset: -3px;
            border-radius: 11px;
            opacity: 0;
            transition: opacity 0.25s ease, box-shadow 0.25s ease;
            pointer-events: none;
            box-sizing: border-box;
        }
        .btn-app.on::after {
            opacity: 1;
            box-shadow: 0 0 0 2.5px rgba(48,209,88,1), 0 0 14px 3px rgba(48,209,88,0.65);
        }
        .btn-app.loading::after {
            opacity: 1;
            box-shadow: 0 0 0 2.5px rgba(255,159,10,1), 0 0 14px 3px rgba(255,159,10,0.65);
            animation: father-pulse-ring 0.9s ease-in-out infinite;
        }
        .btn-app.error::after {
            opacity: 1;
            box-shadow: 0 0 0 2.5px rgba(255,69,58,1), 0 0 14px 3px rgba(255,69,58,0.65);
        }
        @keyframes father-pulse-ring {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.45; }
        }

        /* Badge chấm trạng thái góc trên-phải icon, giống badge thông báo app iOS */
        .btn-app-badge {
            position: absolute;
            top: -3px;
            right: -3px;
            width: 13px;
            height: 13px;
            border-radius: 50%;
            border: 2px solid rgba(245,245,247,0.95);
            background: #8e8e93;
            opacity: 0;
            transform: scale(0.5);
            transition: opacity 0.2s ease, transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), background 0.2s ease;
            pointer-events: none;
            z-index: 3;
        }
        @media (prefers-color-scheme: dark) {
            .btn-app-badge { border-color: rgba(28,28,30,0.95); }
        }
        .btn-app.on .btn-app-badge {
            opacity: 1;
            transform: scale(1);
            background: #30d158;
        }
        .btn-app.loading .btn-app-badge {
            opacity: 1;
            transform: scale(1);
            background: #ff9f0a;
            animation: father-pulse-badge 0.9s ease-in-out infinite;
        }
        .btn-app.error .btn-app-badge {
            opacity: 1;
            transform: scale(1);
            background: #ff453a;
        }
        @keyframes father-pulse-badge {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(0.75); }
        }

        @media (prefers-color-scheme: dark) {
            .btn-manage { background: rgba(255, 255, 255, 0.12) !important; color: #fff !important; }
        }
    `;

    // ==== 3. Cấu trúc cây DOM ====
    const dock = document.createElement('div');
    dock.className = 'dock-main';

    const pathArrow = "M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z";

    const appsHTML = SCRIPTS.map((scriptDef) => `
        <button class="btn-app" data-key="${scriptDef.key}" title="${scriptDef.name}" style="background:${scriptDef.color};">
            ${scriptDef.icon}
            <span class="btn-app-badge"></span>
        </button>
    `).join('');

    dock.innerHTML = `
        <button class="btn-main-toggle" title="Kéo để di chuyển / Chạm để mở danh sách">
            <svg viewBox="0 0 24 24" style="width:18px;height:18px;fill:currentColor;display:block;"><path d="${pathArrow}"/></svg>
        </button>

        <div class="apps-sub-container-bg">
            <div class="apps-scroll-layer">
                ${appsHTML}
            </div>
        </div>
    `;

    const mainToggleBtn = dock.querySelector('.btn-main-toggle');
    const appsScrollLayer = dock.querySelector('.apps-scroll-layer');

    // Gán trạng thái "on" ban đầu cho các script đã từng bật trong phiên này
    SCRIPTS.forEach((scriptDef) => {
        if (activeState[scriptDef.key]) {
            const btn = appsScrollLayer.querySelector(`[data-key="${scriptDef.key}"]`);
            if (btn) btn.classList.add('on');
        }
    });

    let currentSide = 'right';

    // ==== LOGIC DI CHUYỂN & VUỐT ẨN (giữ nguyên cơ chế gốc) ====
    let isDragging = false;
    let startX, startY, initialX, initialY;
    let hasMoved = false;

    function onStart(e) {
        if (e.target.closest('.apps-sub-container-bg')) return;

        isDragging = true;
        hasMoved = false;
        container.classList.add('dragging');
        stopAutoHideTimer();

        const clientX = e.type.startsWith('touch') ? e.touches[0].clientX : e.clientX;
        const clientY = e.type.startsWith('touch') ? e.touches[0].clientY : e.clientY;

        startX = clientX;
        startY = clientY;

        const rect = container.getBoundingClientRect();
        initialX = rect.left;
        initialY = rect.top;
    }

    function onMove(e) {
        if (!isDragging) return;

        const clientX = e.type.startsWith('touch') ? e.touches[0].clientX : e.clientX;
        const clientY = e.type.startsWith('touch') ? e.touches[0].clientY : e.clientY;

        const dx = clientX - startX;
        const dy = clientY - startY;

        if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
            hasMoved = true;
        }

        if (!hasMoved) return;

        let targetX = initialX + dx;
        let targetY = initialY + dy;

        targetX = Math.max(-35, Math.min(window.innerWidth - container.offsetWidth + 35, targetX));
        targetY = Math.max(10, Math.min(window.innerHeight - container.offsetHeight - 10, targetY));

        container.style.removeProperty('right');
        container.style.removeProperty('top');
        container.style.removeProperty('transform');
        container.style.left = `${targetX}px`;
        container.style.top = `${targetY}px`;
    }

    function onEnd() {
        if (!isDragging) return;
        isDragging = false;
        container.classList.remove('dragging');

        if (!hasMoved) {
            if (container.classList.contains('edge-hidden-left') || container.classList.contains('edge-hidden-right')) {
                resetAutoHideTimer();
            } else {
                startAutoHideTimer();
            }
            return;
        }

        const rect = container.getBoundingClientRect();
        const midPoint = window.innerWidth / 2;

        container.style.removeProperty('left');
        container.style.removeProperty('right');

        if (rect.left + rect.width / 2 < midPoint) {
            currentSide = 'left';
            if (rect.left < 15) {
                container.style.left = '4px';
                container.classList.add('edge-hidden-left');
            } else {
                container.style.left = '4px';
                startAutoHideTimer();
            }
        } else {
            currentSide = 'right';
            if (window.innerWidth - rect.right < 15) {
                container.style.right = '4px';
                container.classList.add('edge-hidden-right');
            } else {
                container.style.right = '4px';
                startAutoHideTimer();
            }
        }

        let finalTop = rect.top + rect.height / 2;
        finalTop = Math.max(rect.height / 2 + 10, Math.min(window.innerHeight - rect.height / 2 - 10, finalTop));
        container.style.top = `${finalTop}px`;
        container.style.transform = 'translateY(-50%)';
    }

    mainToggleBtn.addEventListener('mousedown', onStart);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onEnd);

    mainToggleBtn.addEventListener('touchstart', onStart, { passive: true });
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onEnd);

    // ==== LOGIC ĐÓNG/MỞ ====
    mainToggleBtn.addEventListener('click', (e) => {
        if (hasMoved) return;

        e.preventDefault();
        e.stopPropagation();

        if (container.classList.contains('edge-hidden-left') || container.classList.contains('edge-hidden-right')) {
            resetAutoHideTimer();
            return;
        }

        const isExpanded = dock.classList.contains('expanded');
        if (isExpanded) {
            dock.classList.remove('expanded');
        } else {
            dock.classList.add('expanded');
            setTimeout(() => { appsScrollLayer.scrollTop = 0; }, 50);
        }
        resetAutoHideTimer();
    });

    dock.addEventListener('click', (e) => e.stopPropagation());

    // ==== CÔ LẬP CUỘN MÀN HÌNH (chính xác cơ chế này giúp tránh lỗi "cuộn kéo cả dock") ====
    appsScrollLayer.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: true });
    appsScrollLayer.addEventListener('touchmove', (e) => e.stopPropagation(), { passive: false });

    // ==== TỰ ĐỘNG ẨN SAU KHI KHÔNG DÙNG ====
    let hideTimer = null;

    function startAutoHideTimer() {
        stopAutoHideTimer();
        hideTimer = setTimeout(() => {
            if (dock.classList.contains('expanded')) return;
            if (currentSide === 'left') {
                container.classList.add('edge-hidden-left');
            } else {
                container.classList.add('edge-hidden-right');
            }
        }, 5000);
    }

    function stopAutoHideTimer() {
        if (hideTimer) {
            clearTimeout(hideTimer);
            hideTimer = null;
        }
    }

    function resetAutoHideTimer() {
        container.classList.remove('edge-hidden-left', 'edge-hidden-right');
        startAutoHideTimer();
    }

    container.addEventListener('mouseenter', () => {
        container.classList.remove('edge-hidden-left', 'edge-hidden-right');
        stopAutoHideTimer();
    });
    container.addEventListener('mouseleave', () => startAutoHideTimer());

    // ==== CLICK CHỌN SCRIPT ====
    appsScrollLayer.addEventListener('click', (e) => {
        const btn = e.target.closest('.btn-app');
        if (!btn) return;

        const key = btn.getAttribute('data-key');
        const scriptDef = SCRIPTS.find((s) => s.key === key);
        if (!scriptDef) return;

        toggleScript(scriptDef, btn);
        resetAutoHideTimer();
    });

    // ==== 4. Nhúng vào trang web ====
    shadow.appendChild(style);
    shadow.appendChild(dock);

    if (document.body) {
        document.body.appendChild(container);
    } else {
        window.addEventListener('DOMContentLoaded', () => document.body.appendChild(container));
    }

    startAutoHideTimer();
})();
