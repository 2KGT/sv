/**
 * Kiểm Tra Chặn Node · Surge Panel script
 * Bản gốc: https://gist.githubusercontent.com/RavelloH/383354955aa3800e1d7e98666e11e16f/raw/block_check.js
 * Tác giả gốc: https://github.com/RavelloH
 * Chuyển thể Surge & Việt hoá: 2KGT <https://github.com/2KGT/sv>
 *
 * Ghi chú về Surge:
 *   Cơ chế event-interaction của QuantumultX không có tương đương hoàn
 *   toàn trong Surge. Bản này dùng Panel (bảng thông tin) để thay thế:
 *   xem panel tại màn hình chọn policy trong Surge, bấm làm mới là kiểm
 *   tra được chênh lệch kết nối giữa policy (node) đang chọn với DIRECT.
 *
 * Cách dùng:
 *   1. Đặt .sgmodule và nodecheck-surge.js vào thư mục cấu hình Surge
 *      (hoặc dùng thẳng script-path trỏ raw URL như trong .sgmodule).
 *   2. Vào Surge → Module (Mô-đun), bật module này.
 *   3. Vào màn hình chọn policy, bấm nút làm mới trên panel.
 */

const IP_API = "http://ip-api.com/json?lang=vi";
const TIMEOUT = 8;

function fetchIpInfo(policy) {
  return new Promise((resolve) => {
    const opts = { url: IP_API, timeout: TIMEOUT };
    if (policy) opts.policy = policy;
    $httpClient.get(opts, (error, response, data) => {
      if (error || !data) return resolve({ ok: false, error });
      try {
        resolve({ ok: true, data: JSON.parse(data) });
      } catch (e) {
        resolve({ ok: false, error: e });
      }
    });
  });
}

function render(node, direct) {
  const nOk = node && node.ok;
  const dOk = direct && direct.ok;

  let lines = [];

  // Node proxy
  lines.push(`Node proxy: ${nOk ? "✅ Bình thường" : "❌ Không kết nối được"}`);
  if (nOk && node.data) {
    const d = node.data;
    lines.push(`IP: ${d.query}`);
    lines.push(`Vị trí: ${[d.country, d.regionName, d.city].filter(Boolean).join(" - ")}`);
    lines.push(`ISP: ${d.isp || "Không rõ"}`);
  }

  lines.push("");

  // Mạng máy
  lines.push(`Mạng máy: ${dOk ? "✅ Bình thường" : "❌ Bất thường"}`);
  if (dOk && direct.data) {
    const d = direct.data;
    lines.push(`IP: ${d.query}`);
    lines.push(`Vị trí: ${[d.country, d.regionName, d.city].filter(Boolean).join(" - ")}`);
    lines.push(`ISP: ${d.isp || "Không rõ"}`);
  }

  lines.push("");

  // Kết luận
  let conclusion;
  let style = "info";
  if (!dOk) {
    conclusion = "⚠️ Mạng máy bất thường";
    style = "alert";
  } else if (nOk) {
    conclusion = "✅ Node hoạt động bình thường";
    style = "good";
  } else {
    conclusion = "🚫 Nghi bị nhà mạng / GFW chặn";
    style = "error";
  }
  lines.push(`Kết luận: ${conclusion}`);

  return { content: lines.join("\n"), style };
}

Promise.all([
  fetchIpInfo(),        // Qua policy (node) đang active
  fetchIpInfo("DIRECT") // Qua kết nối trực tiếp
]).then(([node, direct]) => {
  const { content, style } = render(node, direct);
  $done({
    title: "🌐 Kiểm Tra Chặn Node",
    content: content,
    style: style,
    icon: "bolt.horizontal.icloud.fill",
    "icon-color": style === "good" ? "#34C759" : style === "error" ? "#FF3B30" : style === "alert" ? "#FF9500" : "#007AFF"
  });
}).catch((err) => {
  $done({
    title: "🌐 Kiểm Tra Chặn Node",
    content: "🛑 Có lỗi khi kiểm tra, vui lòng kiểm tra mạng hoặc xem log Surge.",
    style: "error",
    icon: "exclamationmark.triangle.fill",
    "icon-color": "#FF3B30"
  });
});
