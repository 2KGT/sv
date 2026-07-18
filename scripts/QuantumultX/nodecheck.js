/**
 * Kiểm Tra Chặn Node · Script kiểm tra khả năng kết nối của node
 * Bản gốc: https://github.com/RavelloH
 * Việt hoá & tự host: 2KGT <https://github.com/2KGT/sv>
 *
 * Chức năng:
 *   Kiểm tra node hiện tại có kết nối được không, và phân biệt node
 *   offline hay đang bị nhà mạng / GFW chặn.
 *
 * Cấu hình (Quantumult X):
 *   [task_local]
 *   event-interaction https://raw.githubusercontent.com/2KGT/sv/refs/heads/main/scripts/QuantumultX/nodecheck.js, tag=Kiểm Tra Chặn Node, img-url=bolt.horizontal.icloud.fill.system, enabled=true
 *
 * Cách dùng: nhấn giữ node trong danh sách → chọn chạy script
 */

const IP_API = "http://ip-api.com/json?lang=vi";
const CHECK_HOST = "https://check-host.net";
const GP_API = "https://api.globalping.io/v1/measurements";
const TIMEOUT = 8000;

function run() {
  const tag = $environment.params;
  if (!tag) return done("Không lấy được tên node");

  $configuration.sendMessage({
    action: "get_server_description",
    content: tag
  }).then(function(resolve) {
    var host = null, port = null;
    if (resolve.ret && resolve.ret[tag]) {
      var desc = resolve.ret[tag];
      var eq = desc.indexOf("=");
      if (eq !== -1) {
        var afterEq = desc.substring(eq + 1);
        var comma = afterEq.indexOf(",");
        var hp = comma === -1 ? afterEq : afterEq.substring(0, comma);
        var colon = hp.lastIndexOf(":");
        if (colon !== -1) {
          host = hp.substring(0, colon);
          port = hp.substring(colon + 1);
        }
      }
    }
    startChecks(tag, host, port);
  }, function() {
    startChecks(tag, null, null);
  });
}

function startChecks(tag, host, port) {
  var opts = { policy: $environment.params };

  var pA = $task.fetch({ url: IP_API, opts: opts, timeout: TIMEOUT })
    .then(function(r) { return { src: "node", ok: true, data: JSON.parse(r.body) }; })
    .catch(function() { return { src: "node", ok: false }; });

  var pB = $task.fetch({ url: IP_API, timeout: TIMEOUT })
    .then(function(r) { return { src: "direct", ok: true, data: JSON.parse(r.body) }; })
    .catch(function() { return { src: "direct", ok: false }; });

  var pC;
  if (host && port) {
    var target = host + ":" + port;
    var checkUrl = CHECK_HOST + "/check-tcp?host=" + encodeURIComponent(target) + "&max_nodes=10";
    pC = $task.fetch({ url: checkUrl, headers: { "Accept": "application/json" }, timeout: TIMEOUT })
      .then(function(r) {
        var d = JSON.parse(r.body);
        if (!d.ok || !d.request_id) return { src: "remote", ok: false, error: "Gửi yêu cầu thất bại" };
        var rid = d.request_id;
        var nodeList = d.nodes || {};
        var nodeNames = Object.keys(nodeList);
        var countryMap = {};
        nodeNames.forEach(function(n) {
          var info = nodeList[n];
          if (info && info.length >= 1) countryMap[n] = info[0];
        });
        return new Promise(function(resolve) {
          setTimeout(function() {
            $task.fetch({ url: CHECK_HOST + "/check-result/" + rid, headers: { "Accept": "application/json" }, timeout: TIMEOUT })
              .then(function(r2) {
                var res = JSON.parse(r2.body);
                var reachable = false;
                var items = [];
                nodeNames.forEach(function(n) {
                  var cc = countryMap[n] || "";
                  var flag = cc ? getFlag(cc) : "🌍";
                  var nr = res[n];
                  var ms = '<code style="font-family: Menlo, Monaco, monospace; font-size: 12px">--.--ms</code>';
                  if (nr && Array.isArray(nr) && nr.length > 0 && nr[0].time !== undefined) {
                    reachable = true;
                    ms = '<code style="font-family: Menlo, Monaco, monospace; font-size: 12px">' + formatMs(nr[0].time * 1000) + '</code>';
                  }
                  items.push({ flag: flag, ms: ms });
                });
                resolve({ src: "remote", ok: reachable, data: items });
              }, function() {
                resolve({ src: "remote", ok: false, error: "Truy vấn thất bại" });
              });
          }, 3500);
        });
      })
      .catch(function() { return { src: "remote", ok: false, error: "Yêu cầu thất bại" }; });
  } else {
    pC = Promise.resolve({ src: "remote", ok: false, error: "Không có thông tin địa chỉ" });
  }

  Promise.allSettled([pA, pB, pC]).then(function(results) {
    var node = results[0].value;
    var direct = results[1].value;
    var checkHost = results[2].value;

    var nOk = node && node.ok;
    var dOk = direct && direct.ok;
    var cOk = checkHost && checkHost.ok;

    // check-host thông + node không thông → kích hoạt định vị trong nước
    if (dOk && cOk && !nOk && host && port) {
      runGlobalping(tag, host, port, node, direct, checkHost);
    } else {
      render(tag, node, direct, checkHost, null);
    }
  });
}

function runGlobalping(tag, host, port, node, direct, checkHost) {
  var body = {
    type: "ping",
    target: host,
    measurementOptions: { port: parseInt(port), protocol: "TCP" },
    locations: [{ country: "CN", tags: ["eyeball-network"] }],
    limit: 12
  };

  $task.fetch({
    url: GP_API,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    timeout: TIMEOUT
  }).then(function(r) {
    var d = JSON.parse(r.body);
    if (!d.id) { render(tag, node, direct, checkHost, null); return; }

    setTimeout(function() {
      $task.fetch({
        url: GP_API + "/" + d.id,
        headers: { "Accept": "application/json" },
        timeout: TIMEOUT
      }).then(function(r2) {
        render(tag, node, direct, checkHost, JSON.parse(r2.body));
      }, function() {
        render(tag, node, direct, checkHost, null);
      });
    }, 6000);
  }).catch(function() {
    render(tag, node, direct, checkHost, null);
  });
}

function classifyISP(network) {
  var n = network.toLowerCase();
  if (n.indexOf("unicom") !== -1 || n.indexOf("china unicom") !== -1) return "China Unicom";
  if (n.indexOf("chinanet") !== -1 || n.indexOf("telecom") !== -1 || n.indexOf("china telecom") !== -1) return "China Telecom";
  if (n.indexOf("mobile") !== -1 || n.indexOf("china mobile") !== -1) return "China Mobile";
  return null;
}

function analyzeBlockSource(gpData) {
  var results = gpData.results;
  if (!results) return null;

  var ispGroups = {};
  for (var i = 0; i < results.length; i++) {
    var r = results[i];
    var isp = classifyISP(r.probe.network);
    if (!isp) continue;

    if (!ispGroups[isp]) ispGroups[isp] = { probes: [], reachable: false };

    var res = r.result;
    var ok = false;
    var ms = "--.--ms";
    var stats = res.stats;
    if (res.status === "finished" && stats) {
      ok = stats.rcv > 0;
      ms = ok ? formatMs(stats.avg || 0) : "--.--ms";
    }
    if (ok) ispGroups[isp].reachable = true;

    ispGroups[isp].probes.push({
      city: cnCity(r.probe.city),
      ok: ok,
      ms: ms
    });
  }

  var reachableIsps = [], blockedIsps = [];
  var keys = Object.keys(ispGroups);
  for (var k = 0; k < keys.length; k++) {
    var g = ispGroups[keys[k]];
    if (g.probes.length === 0) continue;
    if (g.reachable) reachableIsps.push(keys[k]); else blockedIsps.push(keys[k]);
  }

  var conclusion;
  if (reachableIsps.length === 0) {
    conclusion = "🚫 GFW chặn toàn diện — cả 3 nhà mạng lớn của Trung Quốc đều không truy cập được";
  } else if (blockedIsps.length > 0) {
    conclusion = "🚫 Bị chặn ở cấp nhà mạng — " + blockedIsps.join("、") + " không kết nối được, " + reachableIsps.join("、") + " bình thường";
  } else {
    conclusion = "✅ Cả 3 nhà mạng lớn của Trung Quốc đều kết nối được, không phải do GFW hay nhà mạng chặn, hãy kiểm tra lại cấu hình client";
  }

  return { ispGroups: ispGroups, conclusion: conclusion };
}

function cnCity(en) {
  var map = {
    "Beijing": "Bắc Kinh", "Shanghai": "Thượng Hải", "Guangzhou": "Quảng Châu",
    "Shenzhen": "Thâm Quyến", "Chengdu": "Thành Đô", "Hangzhou": "Hàng Châu",
    "Wuhan": "Vũ Hán", "Nanjing": "Nam Kinh", "Tianjin": "Thiên Tân",
    "Xi'an": "Tây An", "Changsha": "Trường Sa", "Zhengzhou": "Trịnh Châu",
    "Jinan": "Tế Nam", "Qingdao": "Thanh Đảo", "Dalian": "Đại Liên",
    "Xiamen": "Hạ Môn", "Fuzhou": "Phúc Châu", "Kunming": "Côn Minh",
    "Hefei": "Hợp Phì", "Ningbo": "Ninh Ba", "Suzhou": "Tô Châu",
    "Wuxi": "Vô Tích", "Changzhou": "Thường Châu", "Guilin": "Quế Lâm",
    "Nanning": "Nam Ninh", "Haikou": "Hải Khẩu", "Sanya": "Tam Á",
    "Guiyang": "Quý Dương", "Lanzhou": "Lan Châu", "Urumqi": "Urumqi",
    "Hohhot": "Hohhot", "Harbin": "Cáp Nhĩ Tân", "Changchun": "Trường Xuân",
    "Shenyang": "Thẩm Dương", "Shijiazhuang": "Thạch Gia Trang", "Taiyuan": "Thái Nguyên",
    "Xuzhou": "Từ Châu", "Yancheng": "Diêm Thành", "Taishan": "Đài Sơn",
    "Nanchang": "Nam Xương", "Foshan": "Phật Sơn", "Dongguan": "Đông Hoản",
    "Zhuhai": "Châu Hải", "Zhongshan": "Trung Sơn", "Huizhou": "Huệ Châu"
  };
  return map[en] || en;
}

function formatMs(ms) {
  if (ms >= 10000) {
    return Math.floor(ms) + "ms";
  } else if (ms >= 1000) {
    return Math.floor(ms).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",") + "ms";
  } else if (ms >= 100) {
    return ms.toFixed(1) + "ms";
  } else if (ms >= 10) {
    return ms.toFixed(2) + "ms";
  } else if (ms <= 0) {
    return "0.00ms";
  } else {
    return ms.toFixed(3) + "ms";
  }
}

function render(tag, node, direct, remote, gpData) {
  var nOk = node && node.ok;
  var dOk = direct && direct.ok;
  var rOk = remote && remote.ok;

  var parts = [];

  // Node proxy
  var nodeStr = '<span style="font-weight: bold">Node proxy</span>: ' + (nOk ? "✅ Bình thường" : "❌ Không kết nối được");
  if (nOk && node.data) {
    var d = node.data;
    nodeStr += '<br/>' + '<span style="font-weight: bold">IP</span>: ' + d.query;
    nodeStr += '<br/>' + '<span style="font-weight: bold">Vị trí</span>: ' + [d.country, d.regionName, d.city].filter(Boolean).join(" - ");
    nodeStr += '<br/>' + '<span style="font-weight: bold">ISP</span>: ' + (d.isp || "Không rõ");
  }
  parts.push(nodeStr);

  // Mạng máy
  parts.push('<span style="font-weight: bold">Mạng máy</span>: ' + (dOk ? "✅ Bình thường" : "❌ Bất thường"));

  // Kiểm tra từ xa
  var remoteStr = '<span style="font-weight: bold">Kiểm tra từ xa</span>: ' + (rOk ? "✅ Kết nối được" : "❌ Không kết nối được");
  if (remote && remote.data && remote.data.length > 0) {
    var items = remote.data;
    for (var i = 0; i < items.length; i += 2) {
      var left = items[i];
      var right = i + 1 < items.length ? items[i + 1] : null;
      remoteStr += '<br/>' + left.flag + " " + left.ms;
      if (right) {
        remoteStr += "&emsp;&emsp;" + right.flag + " " + right.ms;
      }
    }
  } else if (remote && remote.error) {
    remoteStr += '<br/>' + remote.error;
  }
  parts.push(remoteStr);

  // Định vị trong nước (chỉ có dữ liệu khi nghi bị chặn)
  if (gpData && gpData.results) {
    var analysis = analyzeBlockSource(gpData);
    if (analysis) {
      // Gom tất cả probe, sắp theo nhà mạng: Điện Tín → Liên Thông → Di Động
      var ispOrder = ["China Telecom", "China Unicom", "China Mobile"];
      var ispAbbr = { "China Telecom": "Điện Tín", "China Unicom": "Liên Thông", "China Mobile": "Di Động" };
      var allProbes = [];
      for (var j = 0; j < ispOrder.length; j++) {
        var key = ispOrder[j];
        var group = analysis.ispGroups[key];
        if (!group) continue;
        for (var p = 0; p < group.probes.length; p++) {
          allProbes.push({
            label: ispAbbr[key] + "·" + group.probes[p].city,
            ms: group.probes[p].ms,
            ok: group.probes[p].ok
          });
        }
      }

      var domesticReachable = allProbes.some(function(p) { return p.ok; });
      var gpStr = '<span style="font-weight: bold">Kiểm tra tại Trung Quốc</span>: ' + (domesticReachable ? "✅ Kết nối được" : "❌ Không kết nối được");
      if (allProbes.length > 0) {
        for (var i2 = 0; i2 < allProbes.length; i2 += 2) {
          var left = allProbes[i2];
          var right = i2 + 1 < allProbes.length ? allProbes[i2 + 1] : null;
          var lc = left.ok ? "#4CAF50" : "#f44336";
          gpStr += '<br/>' + left.label + ' ';
          gpStr += '<code style="font-family: Menlo, Monaco, monospace; font-size: 12px; color: ' + lc + '">' + left.ms + '</code>';
          if (right) {
            var rc = right.ok ? "#4CAF50" : "#f44336";
            gpStr += "&emsp;&emsp;" + right.label + ' ';
            gpStr += '<code style="font-family: Menlo, Monaco, monospace; font-size: 12px; color: ' + rc + '">' + right.ms + '</code>';
          }
        }
      }
      parts.push(gpStr);
    }
  }

  // Kết luận
  parts.push('<span style="font-weight: bold">📋 Kết luận</span>');

  if (!dOk) {
    parts.push('⚠️ Mạng máy bất thường');
  } else if (nOk && rOk) {
    parts.push('✅ Node hoạt động bình thường');
  } else if (!nOk && rOk && dOk) {
    if (gpData && gpData.results) {
      var a2 = analyzeBlockSource(gpData);
      if (a2 && a2.conclusion) {
        parts.push(a2.conclusion);
      } else {
        parts.push('🚫 Nghi bị nhà mạng / GFW chặn');
      }
    } else {
      parts.push('🚫 Nghi bị nhà mạng / GFW chặn');
    }
  } else if (!nOk && !rOk && dOk) {
    parts.push('💤 Node đã offline');
  } else {
    parts.push('❓ Dữ liệu không đầy đủ');
  }

  // Tên node
  parts.push('<span style="font-weight: bold">Node</span>: <span style="color: #467fcf">' + (tag || "Node hiện tại") + '</span>');

  var html = parts.join('<br/><br/>');

  $done({
    "title": "   🌐 Kiểm Tra Chặn Node",
    htmlMessage: '<div style="font-family: -apple-system; font-size: large">' + html + '</div>'
  });
}

function getFlag(cc) {
  if (!cc || cc.length !== 2) return "🌍";
  var cp = cc.toUpperCase().split('').map(function(c) { return 127397 + c.charCodeAt(); });
  return String.fromCodePoint.apply(null, cp);
}

function done(msg) {
  $done({
    "title": "   🌐 Kiểm Tra Chặn Node",
    htmlMessage: '<div style="font-family: -apple-system; font-size: large"><span style="font-weight: bold">🛑 ' + msg + '</span></div>'
  });
}

run();
