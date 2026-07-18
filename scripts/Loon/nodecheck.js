/**
 * Kiểm Tra Chặn Node · Loon generic script
 *
 * Cách dùng: tại trang node hoặc policy group của Loon, chạy script "Kiểm Tra Chặn Node" trên mục tiêu cần kiểm tra
 *
 * @Author: @RavelloH <https://github.com/RavelloH>
 * @Modifier: MaYIHEI <https://github.com/MaYIHEI/paperclip>
 * @Channel: Kênh Telegram https://t.me/mayihei
 * @Localized (VI) & self-hosted: 2KGT <https://github.com/2KGT/sv>
 * @Updated: 2026-07-17
 *
 * ===== Loon =====
 * [Script]
 * generic script-path=https://raw.githubusercontent.com/2KGT/sv/refs/heads/main/scripts/Loon/nodecheck.js, tag=Kiểm Tra Chặn Node, timeout=20, img-url=bolt.horizontal.icloud.fill.system, enable=true
 */

const SCRIPT_VERSION = "2026-07-17.r1";
const IP_API = "http://ip-api.com/json?lang=vi";
const CHECK_HOST = "https://check-host.net";
const REQUEST_TIMEOUT = 8000;
const RESULT_DELAY = 3500;
const RESULT_RETRY_DELAY = 2500;

const params = typeof $environment !== "undefined" && $environment.params
    ? $environment.params
    : {};
const nodeName = params.node || "";
const nodeInfo = params.nodeInfo || {};

console.log(`[INFO] Kiểm Tra Chặn Node ${SCRIPT_VERSION}`);
console.log(`[INFO] Node: ${nodeName || "chưa lấy được"}`);

if (!nodeName) {
    finishError("Không lấy được tên node hoặc policy group");
} else {
    run();
}

function run() {
    Promise.all([
        requestGeo(nodeName).then(
            (data) => ({ ok: true, data }),
            (error) => ({ ok: false, error: errorMessage(error) })
        ),
        requestGeo("DIRECT").then(
            (data) => ({ ok: true, data }),
            (error) => ({ ok: false, error: errorMessage(error) })
        ),
        checkRemote(nodeInfo),
    ]).then(
        (results) => render(results[0], results[1], results[2]),
        (error) => finishError(`Lỗi khi kiểm tra: ${errorMessage(error)}`)
    );
}

function requestGeo(node) {
    return requestJson(IP_API, node).then((data) => {
        if (data && data.status === "fail") {
            throw new Error(data.message || "Truy vấn IP thất bại");
        }
        return data;
    });
}

function requestJson(url, node) {
    return new Promise((resolve, reject) => {
        const options = {
            url,
            timeout: REQUEST_TIMEOUT,
            headers: {
                Accept: "application/json",
                "User-Agent": "Loon Node Check",
            },
        };
        if (node) options.node = node;

        $httpClient.get(options, (error, response, body) => {
            if (error) {
                reject(new Error(String(error)));
                return;
            }
            const status = Number(response && response.status);
            if (status < 200 || status >= 300) {
                reject(new Error(`HTTP ${status || "?"}`));
                return;
            }
            try {
                resolve(JSON.parse(body));
            } catch (_) {
                reject(new Error("Không phân tích được phản hồi"));
            }
        });
    });
}

function checkRemote(info) {
    const address = info && info.address ? String(info.address) : "";
    const port = info && info.port ? String(info.port) : "";
    if (!address || !port) {
        return Promise.resolve({
            available: false,
            reachable: false,
            error: "Policy group chưa cung cấp địa chỉ node, vui lòng chạy trực tiếp trên node cụ thể",
        });
    }

    const host = address.indexOf(":") !== -1 && address.charAt(0) !== "["
        ? `[${address}]`
        : address;
    const target = `${host}:${port}`;
    const submitUrl = `${CHECK_HOST}/check-tcp?host=${encodeURIComponent(target)}&max_nodes=10`;

    return requestJson(submitUrl, "DIRECT").then(
        (submission) => {
            if (!submission || !submission.ok || !submission.request_id) {
                return {
                    available: false,
                    reachable: false,
                    target,
                    error: "Gửi yêu cầu kiểm tra từ xa thất bại",
                };
            }

            const nodes = submission.nodes || {};
            const names = Object.keys(nodes);
            const countries = {};
            names.forEach((name) => {
                countries[name] = Array.isArray(nodes[name]) ? nodes[name][0] : "";
            });

            return wait(RESULT_DELAY)
                .then(() => getRemoteResult(submission.request_id, names, countries))
                .then((result) => {
                    if (result.complete) return result;
                    return wait(RESULT_RETRY_DELAY)
                        .then(() => getRemoteResult(submission.request_id, names, countries));
                })
                .then((result) => {
                    if (!result.complete) {
                        return {
                            available: false,
                            reachable: false,
                            target,
                            error: "Kiểm tra từ xa chưa trả kết quả",
                        };
                    }
                    return {
                        available: true,
                        reachable: result.reachable,
                        data: result.items,
                        target,
                    };
                });
        },
        (error) => ({
            available: false,
            reachable: false,
            target,
            error: `Kiểm tra từ xa không khả dụng: ${errorMessage(error)}`,
        })
    ).then(
        (result) => result,
        (error) => ({
            available: false,
            reachable: false,
            target,
            error: `Kiểm tra từ xa không khả dụng: ${errorMessage(error)}`,
        })
    );
}

function getRemoteResult(requestId, names, countries) {
    return requestJson(`${CHECK_HOST}/check-result/${requestId}`, "DIRECT").then((result) => {
        let reachable = false;
        let complete = false;
        const items = names.map((name) => {
            const records = result && result[name];
            const record = Array.isArray(records) && records.length ? records[0] : null;
            const seconds = record && Number(record.time);
            if (record !== null) complete = true;
            if (Number.isFinite(seconds) && seconds >= 0) reachable = true;
            return {
                flag: getFlag(countries[name]),
                ms: Number.isFinite(seconds) && seconds >= 0
                    ? formatMs(seconds * 1000)
                    : "--.--ms",
            };
        });
        return { reachable, complete, items };
    });
}

function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function render(node, direct, remote) {
    const parts = [];

    let nodeBlock = `<b>Node proxy</b>: ${node.ok ? "✅ Bình thường" : "❌ Không kết nối được"}`;
    if (node.ok && node.data) {
        const data = node.data;
        const location = [data.country, data.regionName || data.region, data.city].filter(Boolean).join(" - ");
        nodeBlock += `<br/><b>IP</b>: ${escapeHtml(data.ip || data.query || "Không rõ")}`;
        if (location) nodeBlock += `<br/><b>Vị trí</b>: ${escapeHtml(location)}`;
        nodeBlock += `<br/><b>ISP</b>: ${escapeHtml(data.isp || data.organization || "Không rõ")}`;
    } else if (node.error) {
        nodeBlock += `<br/><small>${escapeHtml(node.error)}</small>`;
    }
    parts.push(nodeBlock);

    let directBlock = `<b>Mạng máy</b>: ${direct.ok ? "✅ Bình thường" : "❌ Bất thường"}`;
    if (!direct.ok && direct.error) {
        directBlock += `<br/><small>${escapeHtml(direct.error)}</small>`;
    }
    parts.push(directBlock);

    let remoteBlock;
    if (!remote.available) {
        remoteBlock = "<b>Kiểm tra từ xa</b>: ⚠️ Chưa hoàn tất";
        if (remote.error) remoteBlock += `<br/><small>${escapeHtml(remote.error)}</small>`;
    } else {
        remoteBlock = `<b>Kiểm tra từ xa</b>: ${remote.reachable ? "✅ Kết nối được" : "❌ Không kết nối được"}`;
        if (remote.data && remote.data.length) {
            for (let i = 0; i < remote.data.length; i += 2) {
                const left = remote.data[i];
                const right = remote.data[i + 1];
                remoteBlock += `<br/>${left.flag} <code>${left.ms}</code>`;
                if (right) remoteBlock += `&emsp;&emsp;${right.flag} <code>${right.ms}</code>`;
            }
        }
    }
    parts.push(remoteBlock);

    parts.push("<b>📋 Kết luận</b>");
    if (!direct.ok) {
        parts.push("⚠️ Mạng máy bất thường");
    } else if (node.ok) {
        parts.push("✅ Node hoạt động bình thường");
    } else if (remote.available && remote.reachable) {
        parts.push("🚫 Nghi bị nhà mạng / GFW chặn");
    } else if (remote.available) {
        parts.push("💤 Node nghi ngờ đã offline");
    } else {
        parts.push("❓ Không đủ dữ liệu để phân biệt bị chặn hay offline");
    }

    const type = nodeInfo.type ? ` · ${escapeHtml(nodeInfo.type)}` : "";
    parts.push(`<b>Node</b>: <span style="color:#467fcf">${escapeHtml(nodeName)}${type}</span>`);
    if (remote.target) {
        parts.push(`<small>Mục tiêu kiểm tra: ${escapeHtml(remote.target)}</small>`);
    }

    $done({
        title: "   🌐 Kiểm Tra Chặn Node",
        htmlMessage: `<div style="font-family:-apple-system;font-size:large">${parts.join("<br/><br/>")}</div>`,
    });
}

function formatMs(ms) {
    if (ms >= 10000) return `${Math.floor(ms)}ms`;
    if (ms >= 1000) return `${Math.floor(ms).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")}ms`;
    if (ms >= 100) return `${ms.toFixed(1)}ms`;
    if (ms >= 10) return `${ms.toFixed(2)}ms`;
    if (ms <= 0) return "0.00ms";
    return `${ms.toFixed(3)}ms`;
}

function getFlag(countryCode) {
    if (!countryCode || String(countryCode).length !== 2) return "🌍";
    const points = String(countryCode).toUpperCase().split("").map((char) => 127397 + char.charCodeAt());
    return String.fromCodePoint.apply(null, points);
}

function escapeHtml(value) {
    return String(value === undefined || value === null ? "" : value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function errorMessage(error) {
    return error && error.message ? error.message : String(error || "Lỗi không xác định");
}

function finishError(message) {
    $done({
        title: "   🌐 Kiểm Tra Chặn Node",
        htmlMessage: `<div style="font-family:-apple-system;font-size:large"><b>🛑 ${escapeHtml(message)}</b></div>`,
    });
}
