// ==UserScript==
// @name         LiveContainer Multitasking - iOS Safari Fix Max
// @namespace    http://tampermonkey.net/
// @version      15.0
// @description  Sửa triệt để lỗi không hiển thị hoàn toàn trên Userscripts iOS Safari bằng vòng lặp DOM an toàn.
// @author       You
// @match        *://*/*
// @run-at       document-end
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // ==========================================
    // DATA: DANH SÁCH SCRIPT CON
    // ==========================================
    const subScripts = [
        { id: "abpvn_adsblock", name: "ABPVN AdsBlock", url: "https://raw.githubusercontent.com/2KGT/2KGT.github.io/refs/heads/main/repo/js/ABPVN%20AdsBlock.user.js" },
        { id: "yt_autotranslate", name: "YouTube Auto-translate", url: "https://raw.githubusercontent.com/2KGT/2KGT.github.io/refs/heads/main/repo/js/ACT.YouTube.DM.Auto-translate.user.js" },
        { id: "adguard_extra", name: "AdGuard Extra", url: "https://raw.githubusercontent.com/2KGT/2KGT.github.io/refs/heads/main/repo/js/AdGuard%20Extra.user.js" },
        { id: "adguard_popup", name: "AdGuard Popup Blocker", url: "https://raw.githubusercontent.com/2KGT/2KGT.github.io/refs/heads/main/repo/js/AdGuard%20Popup%20Blocker.user.js" },
        { id: "auto_trans_vi", name: "Dịch sang Tiếng VI", url: "https://raw.githubusercontent.com/2KGT/2KGT.github.io/refs/heads/main/repo/js/auto%20translate%20vi_user.js" },
        { id: "img_grid_lister", name: "Image Grid Lister", url: "https://raw.githubusercontent.com/2KGT/2KGT.github.io/refs/heads/main/repo/js/image-grid-lister_user.js" },
        { id: "open_inapp", name: "Mở App khi bấm link", url: "https://raw.githubusercontent.com/2KGT/2KGT.github.io/refs/heads/main/repo/js/open%20inapp.user.js" }
    ];

    // ==========================================
    // ENGINE: NẠP NGẦM SCRIPT CON (Đã tối ưu)
    // ==========================================
    function loadSubScript(script) {
        const savedStatus = localStorage.getItem(`status_${script.id}`);
        const isEnabled = savedStatus === null ? true : savedStatus === 'true';
        if (!isEnabled) return;

        const xhr = new XMLHttpRequest();
        xhr.open('GET', script.url, true);
        xhr.onload = function() {
            if (xhr.status === 200) {
                try {
                    const scriptNode = document.createElement('script');
                    scriptNode.type = 'text/javascript';
                    scriptNode.textContent = xhr.responseText;
                    (document.head || document.documentElement).appendChild(scriptNode);
                } catch (e) {
                    console.error("Lỗi thực thi script:", script.name, e);
                }
            }
        };
        xhr.send();
    }

    subScripts.forEach(loadSubScript);

    // ==========================================
    // UI: KHỞI TẠO DOCK (VÒNG LẶP ĐỢI DOM AN TOÀN)
    // ==========================================
    function startDock() {
        // Nếu body chưa được trình duyệt dựng xong, đợi 50ms rồi thử lại
        if (!document.body) {
            setTimeout(startDock, 50);
            return;
        }

        if (document.getElementById('lc-multitask-container')) return;

        // Container chính độc lập
        const container = document.createElement('div');
        container.id = 'lc-multitask-container';
        container.style.cssText = 'position:fixed !important; z-index:2147483647 !important; right:4px !important; top:50% !important; transform:translateY(-50%) !important; touch-action:none !important; user-select:none !important; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif !important; transition:right 0.4s ease,left 0.4s ease,opacity 0.3s ease !important; opacity:1 !important;';

        // Dock Giao diện chính (Ép inline style chặt chẽ để chống bị CSS trang web đè bóp méo)
        const dock = document.createElement('div');
        dock.style.cssText = 'display:inline-flex !important; flex-direction:column !important; align-items:center !important; padding:4px !important; background:rgba(245,245,247,0.85) !important; backdrop-filter:blur(20px) saturate(190%) !important; -webkit-backdrop-filter:blur(20px) saturate(190%) !important; border-radius:13px !important; box-shadow:inset 0 0 0 1px rgba(0,0,0,0.06),0 8px 24px rgba(0,0,0,0.08) !important; box-sizing:border-box !important; transition:all 0.35s cubic-bezier(0.16,1,0.3,1) !important; overflow:hidden !important; min-width:45px !important; max-width:45px !important; min-height:45px !important; max-height:45px !important;';

        // Nút tròn kích hoạt chính
        const mainToggleBtn = document.createElement('button');
        mainToggleBtn.style.cssText = 'width:37px !important; height:37px !important; border-radius:9px !important; border:none !important; background:#10a37f !important; color:#ffffff !important; display:flex !important; align-items:center !important; justify-content:center !important; outline:none !important; box-sizing:border-box !important; flex-shrink:0 !important; touch-action:none !important; box-shadow:0 2px 6px rgba(16,163,127,0.25) !important;';
        mainToggleBtn.innerHTML = `<svg viewBox="0 0 24 24" style="width:18px;height:18px;fill:currentColor;display:block;transition:transform 0.3s;"><path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/></svg>`;

        // Khung chứa danh sách nút con
        const subContainerBg = document.createElement('div');
        subContainerBg.style.cssText = 'width:37px !important; display:flex !important; flex-direction:column !important; background:transparent !important; margin-top:0px !important; box-sizing:border-box !important; overflow:hidden !important; flex-shrink:0 !important; opacity:0 !important; max-height:0px !important; transform:scale(0.95) translateY(-6px) !important; transition:opacity 0.2s ease, max-height 0.3s ease, margin-top 0.2s !important;';

        const scrollLayer = document.createElement('div');
        scrollLayer.style.cssText = 'display:flex !important; flex-direction:column !important; align-items:center !important; gap:8px !important; width:37px !important; overflow-y:scroll !important; overflow-x:hidden !important; box-sizing:border-box !important; scrollbar-width:none !important; -webkit-overflow-scrolling:touch !important; touch-action:pan-y !important;';

        // Đổ danh sách nút vào layer cuộn
        subScripts.forEach(script => {
            const savedStatus = localStorage.getItem(`status_${script.id}`);
            const isEnabled = savedStatus === null ? true : savedStatus === 'true';
            
            const btn = document.createElement('button');
            btn.setAttribute('data-id', script.id);
            btn.innerText = script.name.substring(0, 2).toUpperCase();
            
            // Thiết lập style dựa trên trạng thái BẬT / TẮT
            const bgOn = '#a6e3a1 !important', colorOn = '#11111b !important';
            const bgOff = 'rgba(0,0,0,0.08) !important', colorOff = '#a6adc8 !important';
            
            btn.style.cssText = `width:37px !important; height:37px !important; border-radius:9px !important; border:1px solid rgba(0,0,0,0.1) !important; cursor:pointer !important; display:flex !important; align-items:center !important; justify-content:center !important; padding:0 !important; overflow:hidden !important; outline:none !important; box-sizing:border-box !important; flex-shrink:0 !important; font-size:10px !important; font-weight:bold !important; background:${isEnabled ? bgOn : bgOff}; color:${isEnabled ? colorOn : colorOff};`;
            
            scrollLayer.appendChild(btn);
        });

        subContainerBg.appendChild(scrollLayer);
        dock.appendChild(mainToggleBtn);
        dock.appendChild(subContainerBg);
        container.appendChild(dock);
        document.body.appendChild(container);

        // --- XỬ LÝ LOGIC ĐÓNG MỞ (MƯỢT MÀ KHÔNG LỖI) ---
        let currentSide = 'right';
        let isExpanded = false;

        mainToggleBtn.addEventListener('click', (e) => {
            if (hasMoved) return;
            e.preventDefault(); e.stopPropagation();

            // Nếu đang ẩn mép, chạm vào sẽ lôi ra lại
            if (container.style.right === '-31px' || container.style.left === '-31px') {
                resetAutoHideTimer();
                return;
            }

            isExpanded = !isExpanded;
            if (isExpanded) {
                dock.style.minHeight = '320px'; dock.style.maxHeight = '380px';
                dock.style.borderRadius = '14px'; dock.style.background = '#ffffff';
                subContainerBg.style.opacity = '1'; subContainerBg.style.maxHeight = '320px'; subContainerBg.style.marginTop = '6px'; subContainerBg.style.transform = 'scale(1) translateY(0)';
                mainToggleBtn.querySelector('svg').style.transform = 'rotate(180deg)';
                setTimeout(() => { scrollLayer.scrollTop = 0; }, 50);
            } else {
                dock.style.minHeight = '45px'; dock.style.maxHeight = '45px';
                dock.style.borderRadius = '13px'; dock.style.background = 'rgba(245,245,247,0.85)';
                subContainerBg.style.opacity = '0'; subContainerBg.style.maxHeight = '0px'; subContainerBg.style.marginTop = '0px'; subContainerBg.style.transform = 'scale(0.95) translateY(-6px)';
                mainToggleBtn.querySelector('svg').style.transform = 'rotate(0deg)';
            }
            resetAutoHideTimer();
        });

        // Kích hoạt tính năng cuộn vuốt mượt độc lập cho iOS
        scrollLayer.addEventListener('touchstart', (e) => { e.stopPropagation(); stopAutoHideTimer(); }, { passive: true });
        scrollLayer.addEventListener('touchmove', (e) => { e.stopPropagation(); }, { passive: true });

        // --- SỰ KIỆN KÉO THẢ (DRAG & DROP) CHUẨN IOS ---
        let isDragging = false;
        let startX, startY, initialX, initialY, hasMoved = false;

        function onStart(e) {
            if (e.target.closest('.lc-btn-app') || isExpanded) return; // Không cho kéo khi đang mở rộng menu con
            isDragging = true; hasMoved = false;
            stopAutoHideTimer();

            const touch = e.touches[0];
            startX = touch.clientX; startY = touch.clientY;
            const rect = container.getBoundingClientRect();
            initialX = rect.left; initialY = rect.top;
        }

        function onMove(e) {
            if (!isDragging) return;
            const touch = e.touches[0];
            const dx = touch.clientX - startX; const dy = touch.clientY - startY;

            if (Math.abs(dx) > 5 || Math.abs(dy) > 5) hasMoved = true;
            if (!hasMoved) return;

            let targetX = initialX + dx;
            let targetY = initialY + dy;
            targetX = Math.max(-35, Math.min(window.innerWidth - container.offsetWidth + 35, targetX));
            targetY = Math.max(10, Math.min(window.innerHeight - container.offsetHeight - 10, targetY));

            container.style.removeProperty('right'); container.style.removeProperty('top'); container.style.removeProperty('transform');
            container.style.left = `${targetX}px`; container.style.top = `${targetY}px`;
        }

        function onEnd() {
            if (!isDragging) return;
            isDragging = false;

            if (!hasMoved) {
                startAutoHideTimer();
                return;
            }

            const rect = container.getBoundingClientRect();
            const midPoint = window.innerWidth / 2;
            container.style.removeProperty('left'); container.style.removeProperty('right');

            if (rect.left + rect.width / 2 < midPoint) {
                currentSide = 'left'; container.style.left = '4px';
            } else {
                currentSide = 'right'; container.style.right = '4px';
            }

            let finalTop = rect.top + rect.height / 2;
            finalTop = Math.max(rect.height / 2 + 10, Math.min(window.innerHeight - rect.height / 2 - 10, finalTop));
            container.style.top = `${finalTop}px`; container.style.transform = 'translateY(-50%)';
            startAutoHideTimer();
        }

        mainToggleBtn.addEventListener('touchstart', onStart, { passive: true });
        window.addEventListener('touchmove', onMove, { passive: false });
        window.addEventListener('touchend', onEnd);

        // --- CLICK ĐỔI TRẠNG THÁI NÚT ---
        scrollLayer.addEventListener('click', (e) => {
            const btn = e.target.closest('button');
            if (!btn || btn === mainToggleBtn) return;
            
            e.preventDefault(); e.stopPropagation();
            
            const scriptId = btn.getAttribute('data-id');
            const savedStatus = localStorage.getItem(`status_${scriptId}`);
            const currentStatus = savedStatus === null ? true : savedStatus === 'true';
            const newStatus = !currentStatus;
            
            localStorage.setItem(`status_${scriptId}`, newStatus);
            
            // Cập nhật màu sắc trực tiếp tức thì
            btn.style.background = newStatus ? '#a6e3a1 !important' : 'rgba(0,0,0,0.08) !important';
            btn.style.color = newStatus ? '#11111b !important' : '#a6adc8 !important';
            
            console.log(`[Father] ${scriptId} -> ${newStatus ? "BẬT (F5 áp dụng)" : "TẮT"}`);
        });

        // --- TỰ ĐỘNG ẨN SAU 5S ---
        let hideTimer = null;
        function startAutoHideTimer() {
            stopAutoHideTimer();
            if (isExpanded) return;
            hideTimer = setTimeout(() => {
                if (currentSide === 'left') { container.style.left = '-31px'; container.style.opacity = '0.5'; }
                else { container.style.right = '-31px'; container.style.opacity = '0.5'; }
            }, 5000);
        }
        function stopAutoHideTimer() { if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; } }
        function resetAutoHideTimer() { 
            container.style.opacity = '1';
            if (currentSide === 'left') container.style.left = '4px';
            else container.style.right = '4px';
            startAutoHideTimer(); 
        }

        // Chạm nhẹ vào vùng dock là tự bung ra lại nếu đang ẩn mép
        container.addEventListener('touchstart', () => {
            if (container.style.right === '-31px' || container.style.left === '-31px') {
                resetAutoHideTimer();
            }
        }, { passive: true });

        startAutoHideTimer();
    }

    // Kích hoạt khởi chạy tiến trình an toàn
    startDock();
})();
