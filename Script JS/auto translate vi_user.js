// ==UserScript==
// @name         Auto Translate to Vietnamese (Google Translate)
// @namespace    https://2kgt.github.io/
// @version      1.1
// @description  Tự động nhúng Google Translate widget và dịch trang sang tiếng Việt
// @author       Pass Just
// @match        *://*/*
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function () {
  'use strict';

  const TARGET_LANG = 'vi';
  const COOKIE_NAME = 'googtrans';

  // Bỏ qua nếu trang đã là Google Translate hoặc đã có widget
  if (location.hostname.includes('translate.google.com')) return;
  if (document.getElementById('google_translate_element')) return;

  // Không dịch lại nếu trang có vẻ đã ở tiếng Việt (heuristic đơn giản qua thẻ <html lang>)
  const htmlLang = (document.documentElement.lang || '').toLowerCase();
  if (htmlLang.startsWith('vi')) return;

  function setGoogTransCookie() {
    const value = `/auto/${TARGET_LANG}`;
    const domain = location.hostname;
    // Set cho domain hiện tại và cả domain cha (phòng subdomain)
    document.cookie = `${COOKIE_NAME}=${value}; path=/;`;
    document.cookie = `${COOKIE_NAME}=${value}; path=/; domain=.${domain};`;
  }

  function injectContainer() {
    if (document.getElementById('google_translate_element')) return;
    const div = document.createElement('div');
    div.id = 'google_translate_element';
    // Ẩn widget khỏi giao diện, chỉ dùng để kích hoạt engine dịch
    div.style.position = 'fixed';
    div.style.top = '-9999px';
    div.style.left = '-9999px';
    div.style.width = '0';
    div.style.height = '0';
    div.style.overflow = 'hidden';
    document.body.appendChild(div);
  }

  function injectInitFunction() {
    window.googleTranslateElementInit = function () {
      new google.translate.TranslateElement(
        {
          pageLanguage: 'auto',
          includedLanguages: TARGET_LANG,
          autoDisplay: true,
        },
        'google_translate_element'
      );
    };
  }

  function injectScript() {
    if (document.getElementById('google-translate-sdk')) return;
    const script = document.createElement('script');
    script.id = 'google-translate-sdk';
    script.src = 'https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
    script.async = true;
    document.body.appendChild(script);
  }

  function hideGoogleBanner() {
    // Ẩn triệt để mọi thành phần Google Translate có thể tự bung ra:
    // banner dịch, tooltip từ gốc, popup "Văn bản gốc", nút feedback...
    const style = document.createElement('style');
    style.textContent = `
      .goog-te-banner-frame, .goog-te-gadget-icon { display: none !important; }
      body { top: 0 !important; position: static !important; }
      .skiptranslate iframe { display: none !important; }

      /* Popup tooltip hiện khi bấm vào từ đã dịch ("Văn bản gốc", nút thumbs up/down...) */
      #goog-gt-tt,
      .goog-te-balloon-frame,
      .goog-tooltip,
      .goog-tooltip:hover,
      .goog-text-highlight {
        display: none !important;
        visibility: hidden !important;
        background: none !important;
        box-shadow: none !important;
        pointer-events: none !important;
      }

      /* Container gốc luôn ẩn hoàn toàn, kể cả khi Google cố gắng tự resize nó */
      #google_translate_element {
        display: none !important;
        width: 0 !important;
        height: 0 !important;
        overflow: hidden !important;
      }
    `;
    document.head.appendChild(style);

    // Một số phiên bản Google Translate chèn tooltip trực tiếp qua inline style
    // sau khi script tải xong (không kịp bị CSS trên chặn nếu chèn muộn) -
    // dùng MutationObserver để dọn liên tục các phần tử này nếu chúng xuất hiện.
    const observer = new MutationObserver(() => {
      document.querySelectorAll('#goog-gt-tt, .goog-te-balloon-frame').forEach((el) => {
        el.style.display = 'none';
        el.style.visibility = 'hidden';
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function init() {
    setGoogTransCookie();
    hideGoogleBanner();
    injectInitFunction();
    injectContainer();
    injectScript();
  }

  if (document.body) {
    init();
  } else {
    document.addEventListener('DOMContentLoaded', init);
  }
})();
