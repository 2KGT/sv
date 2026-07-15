// ==UserScript==
// @name         Auto Open in App (Native Safari Prompt)
// @namespace    https://local.script/openinapp
// @version      5.0
// @description  Dùng cơ chế hỏi native của Safari để mở app; nếu Hủy, tự chuyển sang duyệt web. Không hỏi lặp lại khi back/forward.
// @author       You
// @match        *://*/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function () {
  'use strict';

  // ----- Chống hỏi lặp lại khi back/forward -----
  // Ghi nhớ URL đã được xử lý (đã hiện prompt "Mở trong app?") trong một
  // khoảng thời gian ngắn. Nếu người dùng back/forward qua lại trang này,
  // hoặc trang được khôi phục từ BFCache, sẽ KHÔNG hỏi lại.
  // Nếu quay lại sau khoảng thời gian dài hơn, hoặc chủ động bấm link lần nữa
  // thì vẫn hoạt động bình thường.
  const PROMPT_TTL_MS = 60 * 1000; // 60 giây
  const STORAGE_KEY = 'oia_prompted_urls';

  function loadPromptedMap() {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  function savePromptedMap(map) {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(map));
    } catch {
      /* ignore quota errors */
    }
  }

  function wasRecentlyPrompted(webUrl) {
    const map = loadPromptedMap();
    const ts = map[webUrl];
    if (!ts) return false;
    if (Date.now() - ts > PROMPT_TTL_MS) return false;
    return true;
  }

  function markPrompted(webUrl) {
    const map = loadPromptedMap();
    map[webUrl] = Date.now();
    // Dọn các mục cũ để tránh phình storage
    for (const key in map) {
      if (Date.now() - map[key] > PROMPT_TTL_MS) delete map[key];
    }
    savePromptedMap(map);
  }

  const RESOLVERS = [
    {
      test: (h) => /(^|\.)facebook\.com$/.test(h),
      build: (url) => {
        const path = url.pathname.replace(/^\/+|\/+$/g, '');
        if (url.searchParams.has('id')) {
          return `fb://profile/${url.searchParams.get('id')}`;
        }
        return path
          ? `fb://facewebmodal/f?href=${encodeURIComponent(url.href)}`
          : 'fb://';
      }
    },
    {
      test: (h) => /(^|\.)instagram\.com$/.test(h),
      build: (url) => {
        const path = url.pathname.replace(/^\/+|\/+$/g, '');
        if (!path) return 'instagram://app';
        if (path.startsWith('p/')) {
          const shortcode = path.split('/')[1];
          return `instagram://media?id=${shortcode}`;
        }
        const seg = path.split('/')[0];
        return `instagram://user?username=${seg}`;
      }
    },
    {
      test: (h) => /(^|\.)twitter\.com$|(^|\.)x\.com$/.test(h),
      build: (url) => `twitter://${url.pathname.replace(/^\//, '')}`
    },
    {
      test: (h) => /(^|\.)youtube\.com$/.test(h),
      build: (url) => {
        const v = url.searchParams.get('v');
        return v ? `youtube://watch?v=${v}` : 'youtube://';
      }
    },
    {
      test: (h) => /(^|\.)tiktok\.com$/.test(h),
      build: (url) => `snssdk1128://${url.pathname.replace(/^\//, '')}`
    }
  ];

  function resolveScheme(href) {
    let url;
    try {
      url = new URL(href, location.href);
    } catch {
      return null;
    }
    for (const r of RESOLVERS) {
      if (r.test(url.hostname)) {
        const scheme = r.build(url);
        if (scheme) return { scheme, webUrl: url.href };
      }
    }
    return null;
  }

  // Kích hoạt scheme trực tiếp qua window.location — đây chính là cách Safari
  // nhận diện và tự hiện hộp thoại native "Mở trong 'X'?". Không dùng iframe,
  // không tự tạo hộp thoại riêng — để Safari xử lý toàn bộ phần UI.
  function triggerScheme(scheme) {
    window.location.href = scheme;
  }

  // Khóa trong bộ nhớ (không phải storage) để chặn double-fire trong cùng
  // một cú bấm (ví dụ sự kiện click nổi bọt qua nhiều phần tử lồng nhau).
  let inFlight = false;

  function handleLink(scheme, webUrl) {
    if (inFlight) return;
    inFlight = true;

    markPrompted(webUrl);

    let handled = false;

    // Safari không cho JS biết trực tiếp người dùng bấm "Mở" hay "Hủy" trên
    // hộp thoại native (giới hạn bảo mật của WebKit). Cách duy nhất để suy luận:
    // nếu bấm "Mở" -> trang bị ẩn đi (chuyển sang app) -> visibilitychange bắt được.
    // Nếu bấm "Hủy" -> trang vẫn hiển thị -> không có sự kiện nào xảy ra.
    const onHide = () => {
      if (document.hidden) handled = true;
    };
    document.addEventListener('visibilitychange', onHide);

    triggerScheme(scheme);

    // Sau ~1.2s, nếu trang vẫn hiển thị (tức đã bấm Hủy, hoặc app không có
    // để Safari xử lý), tự động chuyển sang duyệt web bình thường tại đúng link đó.
    setTimeout(() => {
      document.removeEventListener('visibilitychange', onHide);
      inFlight = false;
      if (!handled && !document.hidden) {
        window.location.href = webUrl;
      }
    }, 1200);
  }

  document.addEventListener('click', function (e) {
    const link = e.target.closest && e.target.closest('a[href]');
    if (!link) return;

    const resolved = resolveScheme(link.href);
    if (!resolved) return; // không khớp app nào -> để hành vi mặc định

    // Đã hỏi cho đúng URL này gần đây (ví dụ do back/forward lặp lại) -> bỏ qua,
    // để trình duyệt xử lý link như link web bình thường.
    if (wasRecentlyPrompted(resolved.webUrl)) return;

    e.preventDefault();
    e.stopPropagation();

    handleLink(resolved.scheme, resolved.webUrl);
  }, true);

})();
