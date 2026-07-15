// ==UserScript==
// @name         Master Loader
// @namespace    http://tampermonkey.net/
// @version      5.0
// @description  Trung tâm điều khiển script con - Khôi phục tương tác và tính năng gốc cho script con
// @author       2KGT
// @match        *://*/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    const BASE_URL = "https://raw.githubusercontent.com/2KGT/2KGT.github.io/refs/heads/main/js/";
    const SCRIPTS = [
        "ACT_YouTube_DM_Auto-translate_user.js",
        "auto-translate-vi_user.js",
        "ABPVN_AdsBlock.user.js",
        "AdGuard_Extra.user.js",
        "AdGuard_Popup_Blocker.user.js",
        "image-grid-lister_user.js",
        "open_inapp.js"
    ];

    // --- 1. KHỞI TẠO GIAO DIỆN ĐIỀU KHIỂN HỆ THỐNG ---
    function initMasterUI() {
        if (document.getElementById("kgt-container")) return;

        const container = document.createElement('div');
        container.id = "kgt-container";
        
        const floatBtn = document.createElement('div');
        floatBtn.id = "kgt-float-btn";
        floatBtn.innerText = "⚙️";
        
        // Vị trí cố định phía trên nút Xem media của file con
        Object.assign(floatBtn.style, {
            position: 'fixed', bottom: '90px', right: '20px', zIndex: '2147483647',
            background: '#111', color: '#fff', border: '1px solid #333', width: '45px', height: '45px',
            borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '18px', boxShadow: '0 4px 14px rgba(0,0,0,.35)', cursor: 'pointer',
            webkitUserSelect: 'none', userSelect: 'none'
        });

        const menu = document.createElement('div');
        menu.id = "kgt-menu";
        Object.assign(menu.style, {
            position: 'fixed', bottom: '145px', right: '20px', zIndex: '2147483647',
            background: '#ffffff', color: '#1e293b', width: '280px', borderRadius: '12px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.2)', padding: '14px', display: 'none',
            fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
            border: '1px solid #e2e8f0', boxSizing: 'border-box'
        });

        const title = document.createElement('div');
        title.innerHTML = `<b style="font-size:14px; color:#0f172a;">🛠️ 2KGT Control Center</b>`;
        title.style.borderBottom = '1px solid #e2e8f0';
        title.style.paddingBottom = '6px';
        title.style.marginBottom = '8px';
        menu.appendChild(title);

        SCRIPTS.forEach((script, index) => {
            let isChecked = true;
            try { isChecked = GM_getValue(`running_${script}`, true); } catch(e) {}
            
            const displayName = script.replace("_user.js", "").replace(".user.js", "").replace(".js", "");
            const item = document.createElement('div');
            Object.assign(item.style, {
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '8px 0', borderBottom: '1px dashed #f1f5f9', fontSize: '13px'
            });

            item.innerHTML = `
                <span style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:180px; color:#334155;">${index + 1}. ${displayName}</span>
                <input type="checkbox" data-script="${script}" class="kgt-script-toggle" ${isChecked ? 'checked' : ''} style="width:40px; height:20px; cursor:pointer; accent-color:#2563eb;">
            `;
            menu.appendChild(item);
        });

        const note = document.createElement('div');
        note.innerText = "👉 Chọn xong, hãy Tải lại trang để áp dụng.";
        Object.assign(note.style, { fontSize: '11px', color: '#64748b', marginTop: '12px', textAlign: 'center', fontWeight: '500' });
        menu.appendChild(note);

        container.appendChild(floatBtn);
        container.appendChild(menu);
        document.documentElement.appendChild(container);

        // Sự kiện Menu
        floatBtn.addEventListener('click', function(e) {
            e.preventDefault(); e.stopPropagation();
            menu.style.display = (menu.style.display === 'block') ? 'none' : 'block';
        });

        menu.addEventListener('click', function(e) { e.stopPropagation(); });

        document.addEventListener('click', function(e) {
            if (!container.contains(e.target)) menu.style.display = 'none';
        });

        const checkboxes = menu.querySelectorAll('.kgt-script-toggle');
        checkboxes.forEach(chk => {
            chk.addEventListener('change', function() {
                const scriptName = this.getAttribute('data-script');
                try { GM_setValue(`running_${scriptName}`, this.checked); } catch(e) {}
            });
        });
    }

    // --- 2. TẢI VÀ THỰC THI TRỰC TIẾP VÀO CONTEXT GỐC (HỒI SINH TÍNH NĂNG) ---
    function loadAndExecuteScript(scriptName) {
        let isEnabled = true;
        try { isEnabled = GM_getValue(`running_${scriptName}`, true); } catch(e) {}
        if (!isEnabled) return;

        if (scriptName.includes("YouTube") && !window.location.hostname.includes("youtube.com")) return; 

        const fullUrl = `${BASE_URL}${scriptName}`;
        GM_xmlhttpRequest({
            method: "GET",
            url: fullUrl,
            onload: function(response) {
                if (response.status === 200) {
                    try {
                        // Giải pháp then chốt: Chạy trực tiếp mã nguồn bằng eval() trong phạm vi cửa sổ hiện tại.
                        // Cách này giữ nguyên quyền kết nối DOM, giúp các nút bấm tương tác của script con hoạt động trở lại bình thường.
                        window.eval(response.responseText);
                        console.log(`[2KGT Master] Đã kích hoạt tính năng gốc: ${scriptName}`);
                    } catch (e) {
                        // Nếu trang web có chính sách bảo mật CSP chặn eval(), tự động chuyển sang cơ chế chèn thẻ an toàn
                        try {
                            const scriptEl = document.createElement('script');
                            scriptEl.textContent = response.responseText;
                            (document.head || document.documentElement).appendChild(scriptEl);
                            console.log(`[2KGT Master] Đã kích hoạt tính năng (Dự phòng): ${scriptName}`);
                        } catch(innerErr) {
                            console.error(`[2KGT Master] Không thể thực thi ${scriptName}:`, innerErr);
                        }
                    }
                }
            }
        });
    }

    // Khởi chạy UI hệ thống
    if (document.documentElement) {
        initMasterUI();
    } else {
        const checkExist = setInterval(function() {
            if (document.documentElement) {
                initMasterUI();
                clearInterval(checkExist);
            }
        }, 5);
    }

    // Nạp danh sách script con
    SCRIPTS.forEach(script => loadAndExecuteScript(script));
})();
