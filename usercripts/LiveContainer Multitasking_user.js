// ==UserScript==
// @name         LiveContainer Multitasking 45px - Square Button Manual Edge Hide
// @namespace    http://tampermonkey.net/
// @version      12.0
// @description  Kích thước dock 45px, nút vuông đồng bộ, hỗ trợ kéo vuốt ẩn thủ công 2/3 vào mép viền.
// @author       You
// @match        *://*/*
// @run-at       document-end
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    function createSVG(dPath, styleStr = '', viewBox = '0 0 24 24') {
        return `<svg viewBox="${viewBox}" style="width:18px;height:18px;fill:currentColor;display:block;${styleStr}"><path d="${dPath}"/></svg>`;
    }

    // 1. Tạo Container gốc
    const container = document.createElement('div');
    container.id = 'lc-multitask-container';
    container.style.cssText = 'position:fixed !important; z-index:999999 !important; right:4px !important; top:50% !important; transform:translateY(-50%) !important; touch-action:none !important; user-select:none !important;';
    const shadow = container.attachShadow({ mode: 'open' });

    // 2. Định dạng CSS hệ thống - Chuẩn 45px & Vuốt ẩn 2/3
    const style = document.createElement('style');
    style.textContent = `
        :host {
            display: block !important;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
            transition: right 0.4s cubic-bezier(0.16, 1, 0.3, 1), left 0.4s cubic-bezier(0.16, 1, 0.3, 1), top 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease !important;
        }
        
        :host(.dragging) {
            transition: none !important;
        }
        
        /* LOGIC ẨN ĐÚNG 2/3 KHI VUỐT SÁT VIỀN (Thò lại khoảng 14px) */
        :host(.edge-hidden-right) { right: -31px !important; opacity: 0.6 !important; }
        :host(.edge-hidden-left) { left: -31px !important; opacity: 0.6 !important; }
        
        :host(:hover) { opacity: 1 !important; }

        /* DOCK CHA CHUẨN 45PX */
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

        /* NÚT CHÍNH VUÔNG 37PX ĐỂ KHÍT TRONG DOCK 45PX */
        .btn-main-toggle { 
            width: 37px !important;  
            height: 37px !important;
            border-radius: 9px !important; 
            border: none !important;
            background: #10a37f !important; 
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
            box-shadow: 0 2px 6px rgba(16, 163, 127, 0.25) !important;
        }
        
        .btn-main-toggle:active { transform: scale(0.92) !important; }
        .btn-main-toggle svg { transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1) !important; }
        .dock-main.expanded .btn-main-toggle svg { transform: rotate(180deg) !important; }

        /* DARK MODE */
        @media (prefers-color-scheme: dark) {
            .dock-main {
                background: rgba(28, 28, 30, 0.85) !important;
                box-shadow: inset 0 0 0 0.5px rgba(255, 255, 255, 0.08), 0 8px 24px rgba(0, 0, 0, 0.25) !important;
            }
            .dock-main.expanded {
                background: rgba(28, 28, 30, 0.96) !important;
            }
        }

        /* LỚP LÓT CHỨA CÁC APP CON */
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

        /* VÙNG CUỘN CHỨA APP CON */
        .apps-scroll-layer {
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            gap: 6px !important;
            width: 37px !important;
            overflow-y: auto !important;
            overflow-x: hidden !important;
            scrollbar-width: none !important;
            -webkit-overflow-scrolling: touch !important;
        }
        .apps-scroll-layer::-webkit-scrollbar { display: none !important; }

        /* NÚT ỨNG DỤNG TIÊU CHUẨN (VUÔNG 37PX) */
        .btn-app {
            width: 37px !important;  
            height: 37px !important;
            border-radius: 9px !important;
            border: none !important;
            cursor: pointer !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            transition: transform 0.12s ease !important;
            padding: 0 !important;
            overflow: hidden !important;
            outline: none !important;
            box-sizing: border-box !important;
            flex-shrink: 0 !important;
        }
        .btn-app:active { transform: scale(0.88) !important; }

        .btn-manage { background: rgba(0, 0, 0, 0.05) !important; color: #333 !important; }
        .btn-tiktok { background: #000000 !important; color: #fff !important; }
        .btn-live { background: #1F76F4 !important; color: white !important; }
        .btn-facebook { background: #1877F2 !important; color: white !important; }
        .btn-youtube { background: #FF0000 !important; color: white !important; }
        .btn-safari { background: #FFFFFF !important; color: #1B82E6 !important; border: 0.5px solid rgba(0,0,0,0.1) !important; }
        .btn-messenger { background: #006FFF !important; color: white !important; }
        .btn-zalo { background: #0068FF !important; color: white !important; }

        @media (prefers-color-scheme: dark) { 
            .btn-manage { background: rgba(255, 255, 255, 0.12) !important; color: #fff !important; } 
            .btn-safari { border: none !important; }
        }
    `;

    // 3. Cấu trúc cây DOM
    const dock = document.createElement('div');
    dock.className = 'dock-main';

    const pathArrow = "M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z";
    const pathManage = "M4 18h11v2H4zm0-5h8v2H4zm0-5h11v2H4zm15.7 1.3l-1.4-1.4L16 15.2l-2.3-2.3-1.4 1.4 2.3 2.3-2.3 2.3 1.4 1.4 2.3-2.3 2.3 2.3 1.4-1.4-2.3-2.3z";
    const pathTiktok = "M12.53.02C13.84 0 15.14.01 16.44 0c.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.06-2.89-.53-4.09-1.35-.32-.22-.63-.47-.91-.73v6.52c.05 1.9-.53 3.86-1.74 5.26-1.57 1.87-4.14 2.77-6.57 2.29-2.87-.49-5.18-2.92-5.46-5.83-.41-3.6 2.06-7.04 5.61-7.58.74-.12 1.49-.1 2.23.04v4.09c-.58-.17-1.21-.19-1.8-.05-1.28.27-2.22 1.39-2.21 2.71 0 1.51 1.29 2.76 2.8 2.71 1.49-.01 2.66-1.21 2.67-2.7V0h2.31z";
    const pathLive = "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1.29 14.29L11 14.5l-1.29 1.79c-.38.52-1.16.21-1.1-.43l.41-4.22-3.13-2.84c-.48-.44-.22-1.23.42-1.31l4.19-.51 2.15-3.69c.33-.56 1.15-.56 1.48 0l2.15 3.69 4.19.51c.64.08.9.87.42 1.31l-3.13 2.84.41 4.22c.06.64-.72.95-1.1.43z";
    const pathFB = "M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15H8v-3h2V9.5C10 7.57 11.57 6 13.5 6H16v3h-2c-.55 0-1 .45-1 1v2h3v3h-3v6.95c4.56-.93 8-4.96 8-9.75z";
    const pathYT = "M23.5 12.5c0 2-.2 4-.2 4s-.2 1.5-.8 2.2c-.8.8-1.7.8-2.1.9C17.5 19.8 12 20 12 20s-5.5-.2-8.4-.4c-.4-.1-1.3-.1-2.1-.9-.6-.7-.8-2.2-.8-2.2s-.2-2-.2-4v-2c0-2 .2-4 .2-4s.2-1.5.8-2.2c.8-.8 1.7-.8 2.1-.9C6.5 3.2 12 3 12 3s5.5.2 8.4.4c.4.1 1.3.1 2.1.9.6.7.8 2.2.8 2.2s.2 2 .2 4v2.1zM9.5 8.5V15.5L16.5 12L9.5 8.5z";
    const pathSafari = "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1.93 11.93L7 17l3.07-6.93L17 7l-3.07 6.93z";
    const pathMsg = "M12 2C6.36 2 2 6.13 2 11.7c0 2.9 1.17 5.48 3.08 7.33.16.15.25.36.24.58l-.04 1.7c-.02.6.58 1.07 1.14.86l1.9-.72c.19-.07.4-.06.58.03A9.8 9.8 0 0012 21.4c5.64 0 10-4.13 10-9.7C22 6.13 17.64 2 12 2zm1.14 12.13l-2.12-2.26-4.14 2.26 4.54-4.83 2.17 2.25 4.1-2.25-4.59 4.83z";
    const pathZalo = "M12 2C6.48 2 2 5.58 2 10c0 2.45 1.34 4.6 3.42 5.95l-.89 2.68c-.14.43.3.82.69.56l3.35-2.24c1.07.33 2.23.51 3.43.51 5.52 0 10-3.58 10-8s-4.48-8-10-8z";

    dock.innerHTML = `
        <button class="btn-main-toggle" title="Kéo để di chuyển / Vuốt sát mép để ẩn thủ công">
            ${createSVG(pathArrow)}
        </button>
        
        <div class="apps-sub-container-bg">
            <div class="apps-scroll-layer">
                <button class="btn-app btn-manage" title="Quản lý đa nhiệm">${createSVG(pathManage, '', '0 0 24 24')}</button>
                <button class="btn-app btn-tiktok" title="Mở TikTok">${createSVG(pathTiktok)}</button>
                <button class="btn-app btn-live" title="Mở LiveContainer">${createSVG(pathLive)}</button>
                <button class="btn-app btn-facebook" title="Facebook Demo">${createSVG(pathFB)}</button>
                <button class="btn-app btn-youtube" title="YouTube Demo">${createSVG(pathYT)}</button>
                <button class="btn-app btn-safari" title="Safari Demo">${createSVG(pathSafari)}</button>
                <button class="btn-app btn-messenger" title="Messenger Demo">${createSVG(pathMsg)}</button>
                <button class="btn-app btn-zalo" title="Zalo Demo">${createSVG(pathZalo)}</button>
            </div>
        </div>
    `;

    const mainToggleBtn = dock.querySelector('.btn-main-toggle');
    const appsScrollLayer = dock.querySelector('.apps-scroll-layer');
    let currentSide = 'right';

    // --- LOGIC DI CHUYỂN & CHỦ ĐỘNG VUỐT ẨN ---
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

        // Cho phép kéo hơi tràn hẳn ra ngoài mép một chút để kích hoạt ẩn thủ công
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
            // Nếu đang ẩn mà chạm nhẹ, khôi phục lại trạng thái lộ diện
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

        // Xác định bám lề trái hay phải
        if (rect.left + rect.width / 2 < midPoint) {
            currentSide = 'left';
            // LÀM MẸO: Nếu kéo sát viền trái (cách mép dưới 15px) -> Ẩn 2/3 luôn thủ công
            if (rect.left < 15) {
                container.style.left = '4px';
                container.classList.add('edge-hidden-left');
            } else {
                container.style.left = '4px';
                startAutoHideTimer();
            }
        } else {
            currentSide = 'right';
            // LÀM MẸO: Nếu kéo sát viền phải -> Ẩn 2/3 luôn thủ công
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

    // --- LOGIC ĐÓNG/MỞ ---
    mainToggleBtn.addEventListener('click', (e) => {
        if (hasMoved) return; 
        
        e.preventDefault();
        e.stopPropagation();

        // Nếu đang bị giấu, click chỉ kích hoạt cho nó trồi lên đầy đủ
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

    // --- CÔ LẬP CUỘN MÀN HÌNH ---
    appsScrollLayer.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: true });
    appsScrollLayer.addEventListener('touchmove', (e) => e.stopPropagation(), { passive: false });

    // --- TỰ ĐỘNG ẨN SAU KHI KHÔNG DÙNG ---
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
        }, 5000); // Tự động ẩn sau 5 giây nếu không chạm vào
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

    // --- CLICK CHỌN APP ---
    appsScrollLayer.addEventListener('click', (e) => {
        const btn = e.target.closest('.btn-app');
        if (!btn) return;
        
        const title = btn.getAttribute('title');
        console.log(`Kích hoạt ứng dụng: ${title}`);
        
        if (title === "Mở TikTok") {
            try {
                window.location.replace("tiktok://");
            } catch(err) {
                console.log("Thiết bị không hỗ trợ Deeplink URL.");
            }
        }
        
        dock.classList.remove('expanded');
        resetAutoHideTimer();
    });

    // 4. Nhúng vào trang web
    shadow.appendChild(style);
    shadow.appendChild(dock);
    
    if (document.body) {
        document.body.appendChild(container);
    } else {
        window.addEventListener('DOMContentLoaded', () => document.body.appendChild(container));
    }

    startAutoHideTimer();
})();
