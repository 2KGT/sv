// ==UserScript==
// @name         Media & File Grid Lister
// @namespace    https://kyic.local/scripts
// @version      3.0
// @description  Liệt kê ảnh, video, và file tài liệu của trang đang truy cập, dạng lưới kiểu Photos app. Có tab IMG / VIDEO / FILE / FILTER, vuốt trái phải xem ảnh, mở gốc hoặc tải về máy.
// @author       Kyic
// @match        *://*/*
// @grant        GM_addStyle
// @grant        GM_download
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const BTN_ID = 'igl-toggle-btn';
  const PANEL_ID = 'igl-panel';
  let panelOpen = false;
  let activeTab = 'img'; // 'img' | 'video' | 'file' | 'filter'
  let filterOpen = false;

  const NON_IMG_EXT_RE = /\.(html?|php|aspx?|jsp|json|xml|js|css|woff2?|ttf|eot)(\?.*)?(#.*)?$/i;
  const VIDEO_EXT_RE = /\.(mp4|webm|mov|m3u8|mkv|avi|m4v|ogv)(\?.*)?(#.*)?$/i;
  const FILE_EXT_RE = /\.(pdf|zip|rar|7z|tar|gz|doc|docx|xls|xlsx|ppt|pptx|txt|csv|apk|ipa|deb|dylib|exe|dmg|json|xml)(\?.*)?(#.*)?$/i;

  // ---------- Styles ----------
  const style = `
    #${BTN_ID} {
      position: fixed;
      top: 70%;
      left: auto;
      right: 20px;
      z-index: 2147483647;
      width: 46px;
      height: 46px;
      background: #111;
      color: #fff;
      border: 1px solid #333;
      border-radius: 999px;
      font-size: 19px;
      line-height: 1;
      cursor: grab;
      box-shadow: 0 4px 14px rgba(0,0,0,.35);
      user-select: none;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0;
      touch-action: none;
      transition: opacity .25s ease, transform .25s ease, left .25s ease, right .25s ease;
    }
    #${BTN_ID}:hover { background: #222; }
    #${BTN_ID}.igl-hidden { display: none; }
    #${BTN_ID}.igl-dragging {
      cursor: grabbing;
      transition: none;
      box-shadow: 0 8px 24px rgba(0,0,0,.5);
    }
    /* Trạng thái thu gọn: nút trôi dạt vào mép sau vài giây không dùng tới, chỉ để lộ ~40%
       ra ngoài — giống AssistiveTouch của iOS. Chạm vào hoặc kéo sẽ hiện lại đầy đủ. */
    #${BTN_ID}.igl-docked-left {
      opacity: .55;
      transform: translateX(-40%);
    }
    #${BTN_ID}.igl-docked-right {
      opacity: .55;
      transform: translateX(40%);
    }
    .igl-toggle-count {
      position: absolute;
      top: -4px;
      right: -4px;
      min-width: 18px;
      height: 18px;
      padding: 0 4px;
      background: #ff453a;
      color: #fff;
      font-size: 10px;
      font-weight: 700;
      font-family: -apple-system, sans-serif;
      border-radius: 999px;
      display: flex;
      align-items: center;
      justify-content: center;
      line-height: 1;
      box-shadow: 0 0 0 2px #111;
      pointer-events: none;
    }

    #${PANEL_ID} {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      width: 100vw;
      height: 100vh;
      height: 100dvh;
      z-index: 2147483646;
      background: #000;
      display: none;
      flex-direction: column;
      font: 13px/1.4 -apple-system, sans-serif;
      color: #eee;
      isolation: isolate;
      contain: paint;
      overscroll-behavior: contain;
      touch-action: pan-y;
    }
    #${PANEL_ID}.open { display: flex; }

    .igl-header {
      flex: 0 0 auto;
      padding: 10px 12px;
      padding-top: max(10px, env(safe-area-inset-top));
      background: rgba(20,20,22,.86);
      -webkit-backdrop-filter: saturate(180%) blur(20px);
      backdrop-filter: saturate(180%) blur(20px);
      border-bottom: 1px solid rgba(255,255,255,.08);
    }
    /* Hàng chứa navbar (co giãn, tự cuộn ngang riêng) + nút Đóng (cố định, luôn hiện, không bao giờ bị che) */
    .igl-header-row {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 12px;
    }
    /* Nút Đóng: đứng ngoài vùng cuộn của navbar nên luôn hiện trọn vẹn, không đè lên tab nào */
    .igl-close {
      flex: 0 0 auto;
      background: rgba(255,69,58,.9);
      border: none;
      color: #fff;
      border-radius: 999px;
      width: 36px;
      height: 36px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      font-weight: 700;
      font-size: 16px;
      padding: 0;
    }
    .igl-close:active { background: rgba(255,69,58,1); }

    /* ---- Navbar bọc toàn bộ thanh tab: iOS 26 segmented/pill glass style ---- */
    .igl-navbar {
      flex: 1 1 auto;
      min-width: 0;
      display: flex;
      align-items: center;
      gap: 4px;
      overflow-x: auto;
      margin: 0;
      padding: 4px;
      background: rgba(118,118,128,.18);
      -webkit-backdrop-filter: blur(14px);
      backdrop-filter: blur(14px);
      border: 1px solid rgba(255,255,255,.06);
      border-radius: 20px;
      scrollbar-width: none;
    }
    .igl-navbar::-webkit-scrollbar { display: none; }
    .igl-tab {
      flex: 0 0 auto;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 5px;
      min-width: 88px;
      background: transparent;
      border: none;
      color: #c7c7cc;
      border-radius: 16px;
      padding: 8px 12px;
      font-size: 13px;
      font-weight: 590;
      cursor: pointer;
      white-space: nowrap;
      letter-spacing: -.1px;
      transition: background .15s ease, color .15s ease;
    }
    .igl-tab.active {
      background: #fff;
      color: #000;
      box-shadow: 0 1px 3px rgba(0,0,0,.25);
    }
    .igl-tab.igl-tab-filter.active {
      background: #0a84ff;
      color: #fff;
    }

    .igl-navbar .igl-btn {
      flex: 0 0 auto;
      min-width: 88px;
      border-radius: 16px;
      text-align: center;
    }
    .igl-filter-panel {
      display: none;
      align-items: center;
      gap: 14px;
      flex-wrap: wrap;
      padding: 0 2px 14px;
      border-top: 1px solid rgba(255,255,255,.08);
      margin-top: -4px;
    }
    .igl-filter-panel.open { display: flex; }
    .igl-filter-panel label {
      display: flex;
      align-items: center;
      gap: 6px;
      color: #8e8e93;
      font-size: 13px;
      font-weight: 500;
    }
    .igl-filter-panel input[type="number"] {
      width: 60px;
      background: rgba(118,118,128,.24);
      border: none;
      color: #fff;
      border-radius: 9px;
      padding: 6px 8px;
      font-size: 13px;
    }
    .igl-zoom-group {
      display: flex;
      align-items: center;
      gap: 8px;
      background: rgba(118,118,128,.24);
      border: none;
      border-radius: 10px;
      padding: 3px 6px;
    }
    .igl-zoom-btn {
      padding: 4px 10px;
      font-size: 13px;
      background: rgba(255,255,255,.08) !important;
    }
    #igl-zoom-val {
      color: #eee;
      font-size: 12px;
      min-width: 44px;
      text-align: center;
      font-weight: 600;
    }
    .igl-btn {
      background: rgba(118,118,128,.24);
      border: none;
      color: #f2f2f2;
      border-radius: 16px;
      padding: 8px 12px;
      cursor: pointer;
      white-space: nowrap;
      font-size: 13px;
      font-weight: 590;
    }
    .igl-btn:active { background: rgba(118,118,128,.4); }

    .igl-count {
      flex: 0 0 auto;
      color: #8e8e93;
      font-size: 12px;
      font-weight: 500;
      padding: 0 14px 8px;
    }

    /* ---- Grid ảnh kiểu Photos app: số cột điều chỉnh được qua nút Zoom trong FILTER ---- */
    .igl-grid {
      flex: 1 1 auto;
      min-height: 0;
      overflow-y: auto;
      -webkit-overflow-scrolling: touch;
      overscroll-behavior: contain;
      display: grid;
      grid-template-columns: repeat(var(--igl-cols, 3), 1fr);
      grid-auto-rows: min-content;
      gap: 2px;
      padding: 0;
      background: #000;
      align-content: start;
      width: 100%;
      box-sizing: border-box;
    }
    @media (min-width: 700px) {
      .igl-grid { --igl-cols-default: 6; }
    }
    .igl-cell {
      position: relative;
      aspect-ratio: 1 / 1;
      width: 100%;
      overflow: hidden;
      background: #151515;
      cursor: pointer;
    }
    .igl-cell img {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
      opacity: 0;
      transition: opacity .2s ease;
    }
    .igl-cell img.loaded { opacity: 1; }
    .igl-cell .igl-skel {
      position: absolute;
      inset: 0;
      background: linear-gradient(100deg, #161616 30%, #1f1f1f 50%, #161616 70%);
      background-size: 200% 100%;
      animation: igl-shimmer 1.3s infinite;
    }
    .igl-cell img.loaded + .igl-skel { display: none; }
    @keyframes igl-shimmer {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }
    /* Badge kích thước ảnh: chữ trắng có bóng, không nền pill — giống Photos app */
    .igl-cell .igl-dim-badge {
      position: absolute;
      bottom: 4px;
      right: 6px;
      color: #fff;
      font-size: 10px;
      font-weight: 600;
      text-shadow: 0 1px 3px rgba(0,0,0,.9), 0 0 2px rgba(0,0,0,.9);
      pointer-events: none;
    }
    /* Badge thời lượng video: góc dưới phải, chữ trắng đậm có bóng, giống Photos app */
    .igl-cell .igl-duration-badge {
      position: absolute;
      bottom: 4px;
      right: 6px;
      color: #fff;
      font-size: 12px;
      font-weight: 600;
      text-shadow: 0 1px 3px rgba(0,0,0,.9), 0 0 2px rgba(0,0,0,.9);
      pointer-events: none;
    }
    .igl-cell .igl-play-badge {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(0,0,0,.15);
      pointer-events: none;
    }
    .igl-cell .igl-play-badge svg { width: 26px; height: 26px; filter: drop-shadow(0 1px 3px rgba(0,0,0,.6)); }

    .igl-empty {
      color: #777;
      padding: 40px;
      text-align: center;
      grid-column: 1 / -1;
    }

    /* ---- Danh sách dạng list cho FILE / VIDEO không có thumbnail ---- */
    .igl-list {
      flex: 1 1 auto;
      min-height: 0;
      overflow-y: auto;
      -webkit-overflow-scrolling: touch;
      padding: 6px 10px;
    }
    .igl-list-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 11px 6px;
      border-bottom: 1px solid #1a1a1a;
    }
    .igl-list-icon {
      flex: 0 0 auto;
      width: 38px;
      height: 38px;
      border-radius: 8px;
      background: #1c1c1c;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;
    }
    .igl-list-info {
      flex: 1;
      min-width: 0;
    }
    .igl-list-name {
      font-size: 13px;
      color: #eee;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .igl-list-meta {
      font-size: 11px;
      color: #777;
      margin-top: 2px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .igl-list-actions {
      flex: 0 0 auto;
      display: flex;
      gap: 6px;
    }
    .igl-list-actions a, .igl-list-actions button {
      background: #1c1c1c;
      border: 1px solid #333;
      color: #ddd;
      border-radius: 6px;
      padding: 6px 10px;
      font-size: 11px;
      text-decoration: none;
      cursor: pointer;
    }

    /* ---- Lightbox ảnh kiểu Photos app: full screen, vuốt trái/phải ---- */
    .igl-lightbox {
      position: fixed;
      inset: 0;
      z-index: 2147483647;
      background: #000;
      display: none;
      flex-direction: column;
      touch-action: none;
    }
    .igl-lightbox.open { display: flex; }
    /* touch-action không tự kế thừa xuống phần tử con trong CSS — phải ép lại cho TẤT CẢ
       con cháu trong lightbox, nếu không mỗi nút bấm/thanh trên dưới sẽ có touch-action:auto
       mặc định, khiến ngón tay pinch ngay trên nút đó vẫn kích hoạt zoom native của Safari
       cho toàn trang thay vì chỉ zoom ảnh. Đây chính là nguyên nhân các nút bị phóng to theo. */
    .igl-lightbox * {
      touch-action: none;
    }

    .igl-lb-top {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 10px 14px;
      padding-top: max(10px, env(safe-area-inset-top));
      background: linear-gradient(to bottom, rgba(0,0,0,.6), transparent);
      position: absolute;
      top: 0; left: 0; right: 0;
      z-index: 2;
    }
    .igl-lb-top button {
      background: rgba(40,40,40,.7);
      border: none;
      color: #fff;
      border-radius: 999px;
      width: 34px;
      height: 34px;
      font-size: 16px;
      cursor: pointer;
      flex: 0 0 auto;
    }
    .igl-lb-counter {
      color: #ddd;
      font-size: 13px;
      background: rgba(40,40,40,.7);
      padding: 4px 10px;
      border-radius: 999px;
    }

    .igl-lb-track {
      flex: 1;
      display: flex;
      height: 100%;
      transition: transform .28s ease;
      will-change: transform;
    }
    .igl-lb-slide {
      flex: 0 0 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100%;
      overflow: hidden;
      touch-action: none;
    }
    .igl-lb-slide img {
      max-width: 96vw;
      max-height: 82vh;
      object-fit: contain;
      transform-origin: center center;
      will-change: transform;
      user-select: none;
      -webkit-user-drag: none;
    }

    .igl-lb-bottom {
      position: absolute;
      bottom: 0; left: 0; right: 0;
      padding: 12px 16px;
      padding-bottom: max(14px, env(safe-area-inset-bottom));
      background: linear-gradient(to top, rgba(0,0,0,.7), transparent);
      display: flex;
      flex-direction: column;
      gap: 8px;
      z-index: 2;
    }
    .igl-lb-meta {
      color: #aaa;
      font-size: 11px;
      text-align: center;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .igl-lb-actions {
      display: flex;
      gap: 10px;
      justify-content: center;
    }
    .igl-lb-actions button, .igl-lb-actions a {
      display: flex;
      align-items: center;
      gap: 6px;
      background: rgba(50,50,50,.75);
      border: 1px solid rgba(255,255,255,.12);
      color: #fff;
      border-radius: 999px;
      padding: 9px 18px;
      font-size: 13px;
      text-decoration: none;
      cursor: pointer;
    }
    .igl-lb-actions .igl-lb-open { background: rgba(30,80,180,.55); }
    .igl-lb-actions .igl-lb-dl { background: rgba(30,140,80,.55); }
    .igl-lb-actions .igl-lb-close-btn {
      background: rgba(255,69,58,.65);
      border-color: rgba(255,255,255,.15);
      width: 42px;
      padding: 9px 0;
      justify-content: center;
      flex: 0 0 auto;
    }
    .igl-lb-actions .igl-lb-close-btn:active { background: rgba(255,69,58,.9); }

    /* Nút Thu nhỏ: CÁCH LY HOÀN TOÀN khỏi hàng nút chính Mở/Tải/Đóng — nổi độc lập ở góc
       trên-phải. Từng đưa nút này vào chung hàng actions rồi lặp lại đúng lỗi phóng to layout
       khi thao tác pinch gần khu vực nút — nên giữ nguyên tắc tách biệt vĩnh viễn, không gộp
       lại hàng actions nữa dù cho bất kỳ lý do gì. */
    .igl-lb-zoom-dock {
      position: absolute;
      top: max(56px, calc(env(safe-area-inset-top) + 46px));
      right: 14px;
      z-index: 3;
      width: 40px;
      height: 40px;
      border-radius: 999px;
      background: rgba(255,159,10,.85);
      border: 1px solid rgba(255,255,255,.2);
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      box-shadow: 0 2px 8px rgba(0,0,0,.4);
    }
    .igl-lb-zoom-dock svg { width: 18px; height: 18px; }
    .igl-lb-zoom-dock:active { background: rgba(255,159,10,1); }
  `;

  if (typeof GM_addStyle === 'function') {
    GM_addStyle(style);
  } else {
    const s = document.createElement('style');
    s.textContent = style;
    document.head.appendChild(s);
  }

  // ---------- Helpers ----------
  function resolveUrl(u) {
    try { return new URL(u, location.href).href; } catch (e) { return null; }
  }

  function filename(url) {
    try {
      const u = new URL(url);
      const parts = u.pathname.split('/').filter(Boolean);
      return decodeURIComponent(parts[parts.length - 1] || 'file');
    } catch (e) {
      return 'file';
    }
  }

  function extOf(url) {
    const name = filename(url).split('?')[0];
    const m = name.match(/\.([a-z0-9]+)$/i);
    return m ? m[1].toLowerCase() : '';
  }

  function formatDuration(seconds) {
    if (!seconds || !isFinite(seconds)) return '';
    const s = Math.round(seconds);
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return `${m}:${rem.toString().padStart(2, '0')}`;
  }

  function looksLikeImage(url) {
    if (!url) return false;
    if (NON_IMG_EXT_RE.test(url)) return false;
    if (VIDEO_EXT_RE.test(url)) return false;
    return true;
  }

  function iconForFile(ext) {
    const map = {
      pdf: '📕', zip: '🗜️', rar: '🗜️', '7z': '🗜️', tar: '🗜️', gz: '🗜️',
      doc: '📄', docx: '📄', xls: '📊', xlsx: '📊', ppt: '📽️', pptx: '📽️',
      txt: '📄', csv: '📊', apk: '📦', ipa: '📦', deb: '📦', dylib: '⚙️',
      exe: '⚙️', dmg: '💿', json: '🧾', xml: '🧾'
    };
    return map[ext] || '📁';
  }

  // ---------- Collect: IMAGES ----------
  function collectImages() {
    const found = new Map();

    document.querySelectorAll('img').forEach(img => {
      const raw = img.currentSrc || img.src;
      if (!raw || raw.startsWith('data:')) return;
      const url = resolveUrl(raw);
      if (!url || !looksLikeImage(url)) return;
      if (!found.has(url)) {
        found.set(url, {
          url,
          width: img.naturalWidth || img.width || 0,
          height: img.naturalHeight || img.height || 0
        });
      }
      if (img.srcset) {
        img.srcset.split(',').forEach(part => {
          const u = resolveUrl(part.trim().split(' ')[0]);
          if (u && !u.startsWith('data:') && looksLikeImage(u) && !found.has(u)) {
            found.set(u, { url: u, width: 0, height: 0 });
          }
        });
      }
    });

    document.querySelectorAll('*').forEach(el => {
      const bg = getComputedStyle(el).backgroundImage;
      if (bg && bg !== 'none') {
        for (const m of bg.matchAll(/url\(["']?([^"')]+)["']?\)/g)) {
          const raw = m[1];
          if (!raw || raw.startsWith('data:')) continue;
          const u = resolveUrl(raw);
          if (u && looksLikeImage(u) && !found.has(u)) found.set(u, { url: u, width: 0, height: 0 });
        }
      }
    });

    document.querySelectorAll('picture source[srcset]').forEach(src => {
      src.srcset.split(',').forEach(part => {
        const u = resolveUrl(part.trim().split(' ')[0]);
        if (u && !u.startsWith('data:') && looksLikeImage(u) && !found.has(u)) {
          found.set(u, { url: u, width: 0, height: 0 });
        }
      });
    });

    return Array.from(found.values());
  }

  // ---------- Collect: VIDEOS ----------
  function collectVideos() {
    const found = new Map();

    document.querySelectorAll('video').forEach(v => {
      const candidates = [v.currentSrc, v.src].filter(Boolean);
      v.querySelectorAll('source[src]').forEach(s => candidates.push(s.src));
      const duration = (isFinite(v.duration) && v.duration > 0) ? v.duration : null;
      candidates.forEach(raw => {
        const url = resolveUrl(raw);
        if (url && !url.startsWith('data:') && !found.has(url)) {
          found.set(url, { url, poster: v.poster ? resolveUrl(v.poster) : null, duration });
        }
      });
    });

    // Thẻ <a> hoặc <source> trỏ tới file video trực tiếp
    document.querySelectorAll('a[href], source[src]').forEach(el => {
      const raw = el.getAttribute('href') || el.getAttribute('src');
      if (!raw) return;
      const url = resolveUrl(raw);
      if (url && VIDEO_EXT_RE.test(url) && !found.has(url)) {
        found.set(url, { url, poster: null });
      }
    });

    // iframe nhúng từ Youtube/Vimeo... liệt kê như link video ngoài
    document.querySelectorAll('iframe[src]').forEach(f => {
      const url = resolveUrl(f.getAttribute('src'));
      if (url && /youtube\.com|youtu\.be|vimeo\.com|dailymotion\.com/i.test(url) && !found.has(url)) {
        found.set(url, { url, poster: null, embed: true });
      }
    });

    return Array.from(found.values());
  }

  // ---------- Collect: FILES (tài liệu, nén, cài đặt...) ----------
  function collectFiles() {
    const found = new Map();

    document.querySelectorAll('a[href]').forEach(a => {
      const raw = a.getAttribute('href');
      if (!raw) return;
      const url = resolveUrl(raw);
      if (!url || url.startsWith('data:') || url.startsWith('javascript:') || url.startsWith('mailto:')) return;
      if (FILE_EXT_RE.test(url) && !found.has(url)) {
        found.set(url, { url, text: (a.textContent || '').trim().slice(0, 80) });
      }
    });

    return Array.from(found.values());
  }

  // ---------- UI build ----------
  // Nút nổi: chỉ icon + số đếm dạng badge tròn, gọn nhất có thể. Cố tình dùng emoji thuần
  // (🖼️) thay vì icon .svg riêng — một số trang/extension khác có thể nhận nhầm phần tử
  // <img>/<svg> nổi trên trang thành nút chức năng của chính trang đó, gây xung đột hoặc bị
  // ẩn/chặn ngoài ý muốn. Text emoji không có rủi ro này.
  const toggleBtn = document.createElement('button');
  toggleBtn.id = BTN_ID;
  toggleBtn.innerHTML = '🖼️<span class="igl-toggle-count" id="igl-toggle-count">0</span>';
  toggleBtn.setAttribute('aria-label', 'Xem media trên trang');
  document.documentElement.appendChild(toggleBtn);
  const toggleCountEl = toggleBtn.querySelector('#igl-toggle-count');

  const panel = document.createElement('div');
  panel.id = PANEL_ID;
  panel.innerHTML = `
    <div class="igl-header">
      <div class="igl-header-row">
        <div class="igl-navbar" id="igl-tabbar">
          <button class="igl-btn" id="igl-refresh">🔄 Quét lại</button>
          <button class="igl-tab igl-tab-filter" data-tab="filter">⚙️ Filter</button>
          <button class="igl-tab active" data-tab="img">🖼️ Ảnh</button>
          <button class="igl-tab" data-tab="video">🎬 Video</button>
          <button class="igl-tab" data-tab="file">📁 File</button>
        </div>
        <button class="igl-close" id="igl-close" aria-label="Đóng">✕</button>
      </div>
      <div class="igl-filter-panel" id="igl-filter-panel">
        <label>Rộng ≥ <input type="number" id="igl-min-w" value="0" min="0"></label>
        <label>Cao ≥ <input type="number" id="igl-min-h" value="0" min="0"></label>
        <label>Cỡ ảnh
          <span class="igl-zoom-group">
            <button class="igl-btn igl-zoom-btn" id="igl-zoom-out">➖</button>
            <span id="igl-zoom-val">3 cột</span>
            <button class="igl-btn igl-zoom-btn" id="igl-zoom-in">➕</button>
          </span>
        </label>
        <button class="igl-btn" id="igl-download-all">⬇️ Tải tất cả (tab hiện tại)</button>
      </div>
    </div>
    <div class="igl-count" id="igl-count"></div>
    <div class="igl-grid" id="igl-grid"></div>
    <div class="igl-list" id="igl-list" style="display:none"></div>
  `;
  document.documentElement.appendChild(panel);

  // Lightbox kiểu Photos app (dùng cho tab IMG)
  const lightbox = document.createElement('div');
  lightbox.className = 'igl-lightbox';
  lightbox.innerHTML = `
    <div class="igl-lb-top">
      <span class="igl-lb-counter" id="igl-lb-counter">1 / 1</span>
    </div>
    <button class="igl-lb-zoom-dock" id="igl-lb-reset-zoom" style="display:none" aria-label="Thu nhỏ về kích thước gốc">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M9 3 L9 9 L3 9"/>
        <path d="M15 21 L15 15 L21 15"/>
      </svg>
    </button>
    <div class="igl-lb-track" id="igl-lb-track"></div>
    <div class="igl-lb-bottom">
      <div class="igl-lb-meta" id="igl-lb-meta"></div>
      <div class="igl-lb-actions">
        <a class="igl-lb-open" id="igl-lb-open" target="_blank" rel="noopener">↗ Mở ảnh gốc</a>
        <button class="igl-lb-dl" id="igl-lb-dl">⬇ Tải về máy</button>
        <button class="igl-lb-close-btn" id="igl-lb-close">✕</button>
      </div>
    </div>
  `;
  document.documentElement.appendChild(lightbox);

  const gridEl = panel.querySelector('#igl-grid');
  const listEl = panel.querySelector('#igl-list');
  const countEl = panel.querySelector('#igl-count');
  const tabbarEl = panel.querySelector('#igl-tabbar');
  const filterPanelEl = panel.querySelector('#igl-filter-panel');
  const minWInput = panel.querySelector('#igl-min-w');
  const minHInput = panel.querySelector('#igl-min-h');
  const zoomOutBtn = panel.querySelector('#igl-zoom-out');
  const zoomInBtn = panel.querySelector('#igl-zoom-in');
  const zoomValEl = panel.querySelector('#igl-zoom-val');

  const lbTrack = lightbox.querySelector('#igl-lb-track');
  const lbCounter = lightbox.querySelector('#igl-lb-counter');
  const lbMeta = lightbox.querySelector('#igl-lb-meta');
  const lbOpen = lightbox.querySelector('#igl-lb-open');
  const lbDl = lightbox.querySelector('#igl-lb-dl');
  const lbResetZoomBtn = lightbox.querySelector('#igl-lb-reset-zoom');
  const lbClose = lightbox.querySelector('#igl-lb-close');

  let allImages = [];
  let allVideos = [];
  let allFiles = [];
  let filteredImages = [];
  let lbIndex = 0;

  // ---------- Render: IMG tab (grid) ----------
  function renderImages() {
    const minW = parseInt(minWInput.value, 10) || 0;
    const minH = parseInt(minHInput.value, 10) || 0;
    filteredImages = allImages.filter(img => img.width >= minW && img.height >= minH);

    gridEl.style.display = 'grid';
    listEl.style.display = 'none';
    gridEl.innerHTML = '';
    countEl.textContent = `${filteredImages.length} / ${allImages.length} ảnh hiển thị`;

    if (filteredImages.length === 0) {
      gridEl.innerHTML = '<div class="igl-empty">Không tìm thấy ảnh nào phù hợp.</div>';
      return;
    }

    const frag = document.createDocumentFragment();
    filteredImages.forEach((img, idx) => {
      const cell = document.createElement('div');
      cell.className = 'igl-cell';
      cell.innerHTML = `
        <div class="igl-skel"></div>
        <img referrerpolicy="no-referrer" alt="">
        ${img.width && img.height ? `<span class="igl-dim-badge">${img.width}×${img.height}</span>` : ''}
      `;
      const imEl = cell.querySelector('img');
      imEl.dataset.src = img.url;
      imEl.addEventListener('load', () => {
        imEl.classList.add('loaded');
        if (!img.width) {
          img.width = imEl.naturalWidth;
          img.height = imEl.naturalHeight;
          if (img.width && img.height) {
            let badge = cell.querySelector('.igl-dim-badge');
            if (!badge) {
              badge = document.createElement('span');
              badge.className = 'igl-dim-badge';
              cell.appendChild(badge);
            }
            badge.textContent = `${img.width}×${img.height}`;
          }
        }
      });
      imEl.addEventListener('error', () => { cell.style.display = 'none'; });
      cell.addEventListener('click', () => openLightbox(idx));
      frag.appendChild(cell);
    });
    gridEl.appendChild(frag);

    loadImagesInBatches();
  }

  // Nạp ảnh theo từng lô tuần tự (không phụ thuộc scroll/layout của trang gốc),
  // tránh hoàn toàn lỗi "đứng im" do IntersectionObserver không fire trên một số trang.
  function loadImagesInBatches() {
    const imgs = Array.from(gridEl.querySelectorAll('img[data-src]'));
    const BATCH_SIZE = 24;
    let i = 0;
    function loadNext() {
      const batch = imgs.slice(i, i + BATCH_SIZE);
      if (batch.length === 0) return;
      batch.forEach(img => {
        img.src = img.dataset.src;
        img.removeAttribute('data-src');
      });
      i += BATCH_SIZE;
      if (i < imgs.length) {
        requestAnimationFrame(() => setTimeout(loadNext, 60));
      }
    }
    loadNext();
  }

  // ---------- Render: VIDEO tab (grid with play badge, using poster if any) ----------
  function renderVideos() {
    gridEl.style.display = 'grid';
    listEl.style.display = 'none';
    gridEl.innerHTML = '';
    countEl.textContent = `${allVideos.length} video`;

    if (allVideos.length === 0) {
      gridEl.innerHTML = '<div class="igl-empty">Không tìm thấy video nào trên trang.</div>';
      return;
    }

    const frag = document.createDocumentFragment();
    allVideos.forEach(v => {
      const cell = document.createElement('div');
      cell.className = 'igl-cell';
      const durText = formatDuration(v.duration);
      cell.innerHTML = `
        <div class="igl-skel"></div>
        ${v.poster ? `<img referrerpolicy="no-referrer" src="${v.poster}">` : ''}
        <div class="igl-play-badge">
          <svg viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z"/></svg>
        </div>
        ${durText ? `<span class="igl-duration-badge">${durText}</span>` : ''}
      `;
      const imEl = cell.querySelector('img');
      if (imEl) imEl.addEventListener('load', () => imEl.classList.add('loaded'));

      // Nếu chưa có poster và video không phải embed ngoài, tự chụp khung hình đầu làm thumbnail
      // giống cách app Ảnh của iPhone luôn hiện ảnh xem trước thật cho video.
      if (!v.poster && !v.embed) {
        generateVideoThumbnail(v.url, cell);
      }

      cell.addEventListener('click', () => {
        if (v.embed) window.open(v.url, '_blank', 'noopener');
        else openVideoPlayer(v.url);
      });
      frag.appendChild(cell);
    });
    gridEl.appendChild(frag);
  }

  // Tạo thumbnail cho video bằng cách nạp ẩn + chụp khung hình tại giây thứ 1 lên canvas.
  // Cũng nhân tiện lấy được duration thật nếu trước đó chưa có (link video rời, không phải <video> có sẵn).
  function generateVideoThumbnail(url, cell) {
    const vid = document.createElement('video');
    vid.crossOrigin = 'anonymous';
    vid.preload = 'metadata';
    vid.muted = true;
    vid.src = url;
    vid.style.display = 'none';

    const cleanup = () => { vid.remove(); };

    vid.addEventListener('loadedmetadata', () => {
      if (isFinite(vid.duration) && vid.duration > 0) {
        const durText = formatDuration(vid.duration);
        if (durText && !cell.querySelector('.igl-duration-badge')) {
          const badge = document.createElement('span');
          badge.className = 'igl-duration-badge';
          badge.textContent = durText;
          cell.appendChild(badge);
        }
      }
      try { vid.currentTime = Math.min(1, (vid.duration || 1) / 2); } catch (e) { cleanup(); }
    });

    vid.addEventListener('seeked', () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = vid.videoWidth || 300;
        canvas.height = vid.videoHeight || 300;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(vid, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
        const img = document.createElement('img');
        img.src = dataUrl;
        img.addEventListener('load', () => img.classList.add('loaded'));
        cell.insertBefore(img, cell.querySelector('.igl-play-badge'));
      } catch (e) {
        // Video bị chặn CORS -> không thể vẽ lên canvas, giữ nguyên placeholder + icon play
      }
      cleanup();
    });

    vid.addEventListener('error', cleanup);
    document.body.appendChild(vid);
  }

  function openVideoPlayer(url) {
    const wrap = document.createElement('div');
    wrap.className = 'igl-lightbox open';
    wrap.style.zIndex = '2147483647';
    wrap.innerHTML = `
      <div class="igl-lb-top">
        <span class="igl-lb-counter">Video</span>
      </div>
      <div style="flex:1;display:flex;align-items:center;justify-content:center">
        <video src="${url}" controls autoplay playsinline style="max-width:96vw;max-height:82vh"></video>
      </div>
      <div class="igl-lb-bottom">
        <div class="igl-lb-meta">${filename(url)}</div>
        <div class="igl-lb-actions">
          <a class="igl-lb-open" href="${url}" target="_blank" rel="noopener">↗ Mở gốc</a>
          <button class="igl-lb-dl" id="igl-vid-dl">⬇ Tải về máy</button>
          <button class="igl-lb-close-btn" id="igl-vid-close">✕</button>
        </div>
      </div>
    `;
    document.documentElement.appendChild(wrap);
    wrap.querySelector('#igl-vid-close').addEventListener('click', () => wrap.remove());
    wrap.querySelector('#igl-vid-dl').addEventListener('click', () => downloadFile(url));
  }

  // ---------- Render: FILE tab (list) ----------
  function renderFiles() {
    gridEl.style.display = 'none';
    listEl.style.display = 'block';
    listEl.innerHTML = '';
    countEl.textContent = `${allFiles.length} file`;

    if (allFiles.length === 0) {
      listEl.innerHTML = '<div class="igl-empty">Không tìm thấy file tài liệu nào trên trang.</div>';
      return;
    }

    const frag = document.createDocumentFragment();
    allFiles.forEach(f => {
      const ext = extOf(f.url);
      const row = document.createElement('div');
      row.className = 'igl-list-item';
      row.innerHTML = `
        <div class="igl-list-icon">${iconForFile(ext)}</div>
        <div class="igl-list-info">
          <div class="igl-list-name">${f.text || filename(f.url)}</div>
          <div class="igl-list-meta">${ext.toUpperCase() || 'FILE'} · ${filename(f.url)}</div>
        </div>
        <div class="igl-list-actions">
          <a href="${f.url}" target="_blank" rel="noopener">Mở</a>
          <button data-url="${f.url}" class="igl-file-dl">Tải</button>
        </div>
      `;
      row.querySelector('.igl-file-dl').addEventListener('click', () => downloadFile(f.url));
      frag.appendChild(row);
    });
    listEl.appendChild(frag);
  }

  function renderCurrentTab() {
    if (activeTab === 'img') renderImages();
    else if (activeTab === 'video') renderVideos();
    else if (activeTab === 'file') renderFiles();
    // 'filter' không có nội dung riêng — nó chỉ mở/đóng panel filter, giữ nguyên tab nội dung trước đó
  }

  // ---------- Tab bar interactions ----------
  tabbarEl.querySelectorAll('.igl-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      if (tab === 'filter') {
        filterOpen = !filterOpen;
        filterPanelEl.classList.toggle('open', filterOpen);
        btn.classList.toggle('active', filterOpen);
        return;
      }
      activeTab = tab;
      tabbarEl.querySelectorAll('.igl-tab').forEach(b => {
        if (b.dataset.tab !== 'filter') b.classList.toggle('active', b === btn);
      });
      renderCurrentTab();
    });
  });

  // ---------- Lightbox logic (ảnh, vuốt trái/phải) ----------
  function buildSlides() {
    lbTrack.innerHTML = '';
    filteredImages.forEach((img, i) => {
      const slide = document.createElement('div');
      slide.className = 'igl-lb-slide';
      const shouldLoad = Math.abs(i - lbIndex) <= 1;
      slide.innerHTML = shouldLoad
        ? `<img src="${img.url}" referrerpolicy="no-referrer">`
        : `<img data-src="${img.url}" referrerpolicy="no-referrer">`;
      lbTrack.appendChild(slide);
    });
  }

  function ensureSlideLoaded(index) {
    const slide = lbTrack.children[index];
    if (!slide) return;
    const img = slide.querySelector('img[data-src]');
    if (img) { img.src = img.dataset.src; img.removeAttribute('data-src'); }
  }

  function updateLbPosition(animate = true) {
    lbTrack.style.transition = animate ? 'transform .28s ease' : 'none';
    lbTrack.style.transform = `translateX(-${lbIndex * 100}%)`;
    lbCounter.textContent = `${lbIndex + 1} / ${filteredImages.length}`;
    ensureSlideLoaded(lbIndex - 1);
    ensureSlideLoaded(lbIndex);
    ensureSlideLoaded(lbIndex + 1);
    const img = filteredImages[lbIndex];
    if (img) {
      const dim = (img.width && img.height) ? `${img.width}×${img.height} · ` : '';
      lbMeta.textContent = `${dim}${filename(img.url)}`;
      lbOpen.href = img.url;
      lbDl.dataset.url = img.url;
    }
  }

  function openLightbox(index) {
    lbIndex = index;
    buildSlides();
    updateLbPosition(false);
    zoomScale = 1; zoomX = 0; zoomY = 0;
    if (lbResetZoomBtn) lbResetZoomBtn.style.display = 'none';
    resetZoom(false);
    lightbox.classList.add('open');
  }

  function closeLightbox() {
    lightbox.classList.remove('open');
    lbTrack.innerHTML = '';
    zoomScale = 1; zoomX = 0; zoomY = 0;
    if (lbResetZoomBtn) lbResetZoomBtn.style.display = 'none';
  }

  function goTo(index) {
    if (index < 0 || index >= filteredImages.length) return;
    lbIndex = index;
    updateLbPosition(true);
    zoomScale = 1; zoomX = 0; zoomY = 0;
    if (lbResetZoomBtn) lbResetZoomBtn.style.display = 'none';
    resetZoom(false);
  }

  lbClose.addEventListener('click', closeLightbox);

  // ---------- Zoom & Pan mỗi ảnh (pinch 2 ngón, double-tap, kéo khi đã zoom) ----------
  // Trạng thái zoom lưu riêng cho ảnh đang xem; reset về 1x mỗi khi chuyển sang ảnh khác.
  let zoomScale = 1, zoomX = 0, zoomY = 0;
  const ZOOM_MIN = 1, ZOOM_MAX = 4;

  function currentSlideImg() {
    const slide = lbTrack.children[lbIndex];
    return slide ? slide.querySelector('img') : null;
  }

  function applyZoomTransform(animate = false) {
    const img = currentSlideImg();
    if (!img) return;
    img.style.transition = animate ? 'transform .2s ease' : 'none';
    img.style.transform = `translate(${zoomX}px, ${zoomY}px) scale(${zoomScale})`;
    // Nút Thu nhỏ chỉ hiện khi ảnh đang được zoom lớn hơn 1x — cách chắc chắn để quay về
    // kích thước gốc, không phụ thuộc double-tap (vốn dễ bị lệch trên một số thiết bị thật).
    if (lbResetZoomBtn) lbResetZoomBtn.style.display = zoomScale > 1.02 ? 'flex' : 'none';
  }

  function resetZoom(animate = false) {
    zoomScale = 1; zoomX = 0; zoomY = 0;
    applyZoomTransform(animate);
  }

  function clampPan() {
    // Giới hạn không cho kéo ảnh trôi quá xa ra khỏi khung nhìn khi đã zoom
    const img = currentSlideImg();
    if (!img) return;
    const maxX = (img.clientWidth * (zoomScale - 1)) / 2;
    const maxY = (img.clientHeight * (zoomScale - 1)) / 2;
    zoomX = Math.max(-maxX, Math.min(maxX, zoomX));
    zoomY = Math.max(-maxY, Math.min(maxY, zoomY));
  }

  lbResetZoomBtn.addEventListener('click', () => resetZoom(true));

  let touchStartX = 0, touchStartY = 0, dragOffset = 0, dragging = false;
  let pinching = false, pinchStartDist = 0, pinchStartScale = 1;
  let panStartX = 0, panStartY = 0, panOriginX = 0, panOriginY = 0;
  let lastTapTime = 0, lastTapX = 0, lastTapY = 0;
  let suppressTouchUntil = 0;

  function touchDist(t0, t1) {
    return Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
  }

  lbTrack.addEventListener('touchstart', (e) => {
    if (e.touches.length === 2) {
      // Bắt đầu chụm 2 ngón để zoom
      pinching = true;
      dragging = false;
      pinchStartDist = touchDist(e.touches[0], e.touches[1]);
      pinchStartScale = zoomScale;
      lbTrack.style.transition = 'none';
      return;
    }
    if (e.touches.length !== 1) return;

    // Double-tap: chạm 2 lần nhanh trong <300ms và gần cùng vị trí -> zoom nhanh vào/ra
    const now = Date.now();
    const tx = e.touches[0].clientX, ty = e.touches[0].clientY;
    if (now - lastTapTime < 300 && Math.hypot(tx - lastTapX, ty - lastTapY) < 30) {
      e.preventDefault();
      dragging = false;
      pinching = false;
      dragOffset = 0;
      if (zoomScale > 1) {
        resetZoom(true);
      } else {
        zoomScale = 2.5;
        zoomX = 0;
        zoomY = 0;
        applyZoomTransform(true);
      }
      lastTapTime = 0;
      // Chặn mọi touchmove/touchend còn sót lại của cú chạm thứ 2 can thiệp vào animation
      // vừa kích hoạt — đây là nguyên nhân khiến ảnh "nhún nhẹ" rồi dừng giữa chừng thay vì
      // hoàn tất về đúng 1x.
      suppressTouchUntil = now + 250;
      return;
    }
    lastTapTime = now;
    lastTapX = tx;
    lastTapY = ty;

    if (zoomScale > 1) {
      // Đã zoom -> kéo để xem các phần khác của ảnh (pan), không chuyển slide
      panStartX = tx;
      panStartY = ty;
      panOriginX = zoomX;
      panOriginY = zoomY;
      dragging = false;
      return;
    }

    touchStartX = tx;
    touchStartY = ty;
    dragging = true;
    lbTrack.style.transition = 'none';
  }, { passive: false });

  lbTrack.addEventListener('touchmove', (e) => {
    if (Date.now() < suppressTouchUntil) return;
    if (pinching && e.touches.length === 2) {
      const dist = touchDist(e.touches[0], e.touches[1]);
      const scale = pinchStartScale * (dist / pinchStartDist);
      zoomScale = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, scale));
      clampPan();
      applyZoomTransform(false);
      return;
    }
    if (zoomScale > 1 && e.touches.length === 1) {
      // Pan ảnh đã zoom
      zoomX = panOriginX + (e.touches[0].clientX - panStartX);
      zoomY = panOriginY + (e.touches[0].clientY - panStartY);
      clampPan();
      applyZoomTransform(false);
      return;
    }
    if (!dragging || e.touches.length !== 1) return;
    const dx = e.touches[0].clientX - touchStartX;
    const dy = e.touches[0].clientY - touchStartY;
    if (Math.abs(dy) > Math.abs(dx)) return;
    dragOffset = dx;
    const pct = (dragOffset / window.innerWidth) * 100;
    lbTrack.style.transform = `translateX(calc(-${lbIndex * 100}% + ${pct}%))`;
  }, { passive: true });

  lbTrack.addEventListener('touchend', (e) => {
    if (Date.now() < suppressTouchUntil) { dragging = false; pinching = false; dragOffset = 0; return; }
    if (pinching) {
      pinching = false;
      // Chụm về gần 1x thì tự snap về đúng 1x, bỏ pan
      if (zoomScale < 1.05) resetZoom(true);
      return;
    }
    if (zoomScale > 1) return; // đang ở chế độ pan, không chuyển slide
    if (!dragging) return;
    dragging = false;
    const threshold = window.innerWidth * 0.18;
    if (dragOffset > threshold) goTo(lbIndex - 1);
    else if (dragOffset < -threshold) goTo(lbIndex + 1);
    else updateLbPosition(true);
    dragOffset = 0;
  });

  let mouseDown = false;
  lbTrack.addEventListener('mousedown', (e) => {
    if (zoomScale > 1) return;
    mouseDown = true;
    touchStartX = e.clientX;
    lbTrack.style.transition = 'none';
  });
  window.addEventListener('mousemove', (e) => {
    if (!mouseDown) return;
    dragOffset = e.clientX - touchStartX;
    const pct = (dragOffset / window.innerWidth) * 100;
    lbTrack.style.transform = `translateX(calc(-${lbIndex * 100}% + ${pct}%))`;
  });
  window.addEventListener('mouseup', () => {
    if (!mouseDown) return;
    mouseDown = false;
    const threshold = window.innerWidth * 0.18;
    if (dragOffset > threshold) goTo(lbIndex - 1);
    else if (dragOffset < -threshold) goTo(lbIndex + 1);
    else updateLbPosition(true);
    dragOffset = 0;
  });

  // Desktop: cuộn chuột (wheel) để zoom, giữ Ctrl hoặc không đều nhận
  lbTrack.addEventListener('wheel', (e) => {
    e.preventDefault();
    const delta = -e.deltaY * 0.01;
    zoomScale = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoomScale + delta));
    if (zoomScale <= 1) { resetZoom(true); return; }
    clampPan();
    applyZoomTransform(false);
  }, { passive: false });

  // Double-click desktop: giống double-tap
  lbTrack.addEventListener('dblclick', () => {
    if (zoomScale > 1) resetZoom(true);
    else { zoomScale = 2.5; applyZoomTransform(true); }
  });

  window.addEventListener('keydown', (e) => {
    if (!lightbox.classList.contains('open')) return;
    if (e.key === 'ArrowLeft') goTo(lbIndex - 1);
    else if (e.key === 'ArrowRight') goTo(lbIndex + 1);
    else if (e.key === 'Escape') closeLightbox();
  });

  // ---------- Download ----------
  function downloadFile(url) {
    const name = filename(url);
    if (typeof GM_download === 'function') {
      try { GM_download({ url, name, saveAs: false }); return; } catch (e) {}
    }
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.target = '_blank';
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  lbDl.addEventListener('click', () => { if (lbDl.dataset.url) downloadFile(lbDl.dataset.url); });

  function downloadAllCurrentTab() {
    let list = [];
    if (activeTab === 'img') list = filteredImages.map(i => i.url);
    else if (activeTab === 'video') list = allVideos.filter(v => !v.embed).map(v => v.url);
    else if (activeTab === 'file') list = allFiles.map(f => f.url);

    if (list.length === 0) { alert('Không có mục nào để tải trong tab hiện tại.'); return; }
    if (!confirm(`Tải ${list.length} mục? Trình duyệt có thể hỏi xác nhận nhiều lần.`)) return;
    list.forEach((url, i) => setTimeout(() => downloadFile(url), i * 300));
  }

  // ---------- Scan & refresh ----------
  function updateTabCounts() {
    const total = allImages.length + allVideos.length + allFiles.length;
    toggleCountEl.textContent = total > 999 ? '999+' : total;
  }

  function refresh() {
    allImages = collectImages();
    allVideos = collectVideos();
    allFiles = collectFiles();
    updateTabCounts();
    renderCurrentTab();
  }

  // Lưu vị trí cuộn của trang gốc trước khi khóa, để không bị nhảy về đầu trang
  // Trước đây khóa body bằng position:fixed + chặn touchmove toàn cục để tránh trang nền
  // GHI CHÚ VỀ GIỚI HẠN KỸ THUẬT: Safari trên iOS chỉ tự ẩn thanh địa chỉ khi phát hiện
  // CỬ CHỈ CHẠM THẬT của người dùng cuộn trên document ở tầng hệ thống — không có API công
  // khai nào cho phép trang web chủ động yêu cầu việc này, và gọi window.scrollTo() từ JS
  // (kể cả nhích 1px) KHÔNG kích hoạt được hành vi đó vì Safari phân biệt rõ cuộn do script
  // với cuộn do ngón tay người dùng. Đây là giới hạn của nền tảng, không phải lỗi có thể sửa
  // bằng code. Điều duy nhất script này có thể làm là không cản trở trang gốc cuộn tự nhiên.
  let savedScrollY = 0;

  function lockBodyScroll() {
    savedScrollY = window.scrollY || window.pageYOffset || 0;
  }

  function unlockBodyScroll() {
    window.scrollTo(0, savedScrollY);
  }

  // ---------- Kéo-thả tự do cho nút nổi, kiểu AssistiveTouch của iOS ----------
  // - Kéo tự do khắp màn hình bằng ngón tay hoặc chuột.
  // - Khi thả tay, tự "dính" (snap) vào mép trái hoặc phải gần nhất.
  // - Sau vài giây không đụng tới, tự thu gọn trôi một phần vào mép, chỉ lộ ~60%.
  // - Chạm nhẹ (không kéo) hoặc bắt đầu kéo sẽ hiện lại đầy đủ ngay lập tức.
  const DOCK_IDLE_MS = 3000;
  const DRAG_THRESHOLD = 6; // di chuyển dưới ngưỡng này vẫn tính là "chạm" (click), không phải kéo
  let btnX = 0, btnY = 0; // vị trí góc trên-trái hiện tại của nút, tính bằng px
  let dragStartX = 0, dragStartY = 0, dragStartBtnX = 0, dragStartBtnY = 0;
  let isDragging = false, didDrag = false;
  let idleTimer = null;

  function clampToViewport(x, y) {
    const w = toggleBtn.offsetWidth || 46;
    const h = toggleBtn.offsetHeight || 46;
    const maxX = window.innerWidth - w;
    const maxY = window.innerHeight - h;
    return {
      x: Math.max(0, Math.min(maxX, x)),
      y: Math.max(0, Math.min(maxY, y))
    };
  }

  function setBtnPosition(x, y) {
    toggleBtn.style.left = `${x}px`;
    toggleBtn.style.top = `${y}px`;
    toggleBtn.style.right = 'auto';
    toggleBtn.style.bottom = 'auto';
  }

  function undock() {
    toggleBtn.classList.remove('igl-docked-left', 'igl-docked-right');
    resetIdleTimer();
  }

  function dockToNearestEdge() {
    const w = toggleBtn.offsetWidth || 46;
    const centerX = btnX + w / 2;
    const isLeftHalf = centerX < window.innerWidth / 2;
    toggleBtn.classList.remove('igl-docked-left', 'igl-docked-right');
    toggleBtn.classList.add(isLeftHalf ? 'igl-docked-left' : 'igl-docked-right');
  }

  function resetIdleTimer() {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      if (!panelOpen) dockToNearestEdge();
    }, DOCK_IDLE_MS);
  }

  let wasDockedBeforeInteraction = false;

  function onDragStart(clientX, clientY) {
    isDragging = true;
    didDrag = false;
    wasDockedBeforeInteraction = toggleBtn.classList.contains('igl-docked-left') || toggleBtn.classList.contains('igl-docked-right');
    dragStartX = clientX;
    dragStartY = clientY;
    const rect = toggleBtn.getBoundingClientRect();
    dragStartBtnX = rect.left;
    dragStartBtnY = rect.top;
    toggleBtn.classList.add('igl-dragging');
    undock();
  }

  function onDragMove(clientX, clientY) {
    if (!isDragging) return;
    const dx = clientX - dragStartX;
    const dy = clientY - dragStartY;
    if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) didDrag = true;
    if (!didDrag) return;
    const clamped = clampToViewport(dragStartBtnX + dx, dragStartBtnY + dy);
    btnX = clamped.x;
    btnY = clamped.y;
    setBtnPosition(btnX, btnY);
  }

  function onDragEnd() {
    if (!isDragging) return;
    isDragging = false;
    toggleBtn.classList.remove('igl-dragging');
    if (didDrag) {
      // Snap vào mép gần nhất theo chiều ngang, giữ nguyên chiều dọc nơi vừa thả tay
      const w = toggleBtn.offsetWidth || 46;
      const centerX = btnX + w / 2;
      const snapX = centerX < window.innerWidth / 2 ? 12 : window.innerWidth - w - 12;
      btnX = snapX;
      setBtnPosition(btnX, btnY);
    }
    resetIdleTimer();
  }

  toggleBtn.addEventListener('mousedown', (e) => {
    e.preventDefault();
    onDragStart(e.clientX, e.clientY);
  });
  window.addEventListener('mousemove', (e) => onDragMove(e.clientX, e.clientY));
  window.addEventListener('mouseup', onDragEnd);

  toggleBtn.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) return;
    onDragStart(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: true });
  toggleBtn.addEventListener('touchmove', (e) => {
    if (e.touches.length !== 1) return;
    onDragMove(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: true });
  toggleBtn.addEventListener('touchend', onDragEnd);

  // Khởi tạo vị trí ban đầu (góc dưới-phải, giống vị trí mặc định cũ) rồi bắt đầu đếm giờ thu gọn
  window.addEventListener('load', initTogglePosition, { once: true });
  function initTogglePosition() {
    const w = toggleBtn.offsetWidth || 46;
    const h = toggleBtn.offsetHeight || 46;
    btnX = window.innerWidth - w - 20;
    btnY = window.innerHeight - h - 90;
    setBtnPosition(btnX, btnY);
    resetIdleTimer();
  }
  // Trang có thể đã load xong trước khi script chạy (document-idle) -> gọi luôn không đợi sự kiện load
  initTogglePosition();

  toggleBtn.addEventListener('click', () => {
    // Nếu vừa thực hiện thao tác kéo (didDrag=true) thì bỏ qua click ảo mà trình duyệt tự
    // sinh ra sau khi thả tay, tránh vô tình mở panel ngay sau khi kéo nút.
    if (didDrag) { didDrag = false; return; }
    // Nếu nút đang thu gọn ở mép TRƯỚC lúc chạm vào, lần chạm này chỉ để hiện lại đầy đủ,
    // không mở panel ngay — giống hành vi chạm vào AssistiveTouch đang ẩn nép. Dùng biến đã
    // lưu từ onDragStart vì lúc này class igl-docked-* đã bị gỡ bởi undock() rồi.
    if (wasDockedBeforeInteraction) {
      wasDockedBeforeInteraction = false;
      return;
    }
    panelOpen = !panelOpen;
    panel.classList.toggle('open', panelOpen);
    toggleBtn.classList.toggle('igl-hidden', panelOpen);
    if (panelOpen) { lockBodyScroll(); refresh(); }
    else { unlockBodyScroll(); resetIdleTimer(); }
  });

  panel.querySelector('#igl-close').addEventListener('click', () => {
    panelOpen = false;
    panel.classList.remove('open');
    toggleBtn.classList.remove('igl-hidden');
    unlockBodyScroll();
    resetIdleTimer();
  });
  panel.querySelector('#igl-refresh').addEventListener('click', refresh);
  panel.querySelector('#igl-download-all').addEventListener('click', downloadAllCurrentTab);

  // ---- Zoom số cột: 2 (to nhất, dễ bấm) đến 6 (nhỏ nhất, xem nhiều cùng lúc) ----
  let currentCols = 3;
  function applyCols() {
    gridEl.style.setProperty('--igl-cols', currentCols);
    zoomValEl.textContent = `${currentCols} cột`;
  }
  zoomOutBtn.addEventListener('click', () => {
    if (currentCols > 2) { currentCols--; applyCols(); }
  });
  zoomInBtn.addEventListener('click', () => {
    if (currentCols < 6) { currentCols++; applyCols(); }
  });
  applyCols();
  minWInput.addEventListener('input', () => { if (activeTab === 'img') renderImages(); });
  minHInput.addEventListener('input', () => { if (activeTab === 'img') renderImages(); });

  // Quét ngầm ban đầu để hiện số lượng đúng trên nút nổi
  allImages = collectImages();
  allVideos = collectVideos();
  allFiles = collectFiles();
  updateTabCounts();
})();
