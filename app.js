/* REDA – prototipe alat kader. Tanpa server: semua data tersimpan di peramban (localStorage). */
(function () {
  "use strict";

  var LS = "reda-prototipe-v1";
  var TRIGGERS = {
    hujan: { label: "Hujan deras (banjir/longsor)", sumber: "BPBD/BMKG", kata: "hujan deras", contoh: "air sungai masih di bawah batas siaga. Belum perlu mengungsi." },
    gempa: { label: "Getaran gempa", sumber: "BMKG", kata: "getaran gempa", contoh: "gempa ini tidak berpotensi tsunami dan tidak ada gempa susulan yang berbahaya." },
    gunung: { label: "Gemuruh gunung", sumber: "PVMBG", kata: "gemuruh gunung", contoh: "status gunung tidak naik dan belum perlu mengungsi." }
  };
  var STATUS = { tenang: "TENANG", bersiap: "BERSIAP", pergi: "PERGI" };
  var H = 3600 * 1000;

  var state, ui = { tab: "pemicu", status: "tenang", trigger: "hujan", lastMsg: null, pagiEvent: null, draft: {} };

  /* ---------- penyimpanan ---------- */
  function load() {
    try { var r = localStorage.getItem(LS); if (r) return JSON.parse(r); } catch (e) {}
    return null;
  }
  function save() { try { localStorage.setItem(LS, JSON.stringify(state)); } catch (e) {} }
  function blank() {
    return { cfg: { n: 3, jam: 48, min: 5, dusun: "Dusun Contoh" }, families: [], events: [], demo: false };
  }
  function seedDemo() {
    var now = Date.now();
    var s = blank(); s.demo = true;
    s.families = ["A", "B", "C", "D", "E"].map(function (k) { return { id: "K" + k, kode: "Keluarga " + k, visitedAt: null, referredAt: null }; });
    var sc = {
      KA: [8, 6, 4], KB: [7, 7, 8], KC: [5, 3, 2], KD: [8, 8, 9], KE: [6, 4, 3]
    };
    var times = [now - 9 * 24 * H, now - 5 * 24 * H, now - 20 * H];
    var kinds = ["hujan", "hujan", "hujan"];
    for (var i = 0; i < 3; i++) {
      var ev = { id: "e" + (i + 1), trigger: kinds[i], status: "tenang", at: times[i] - 9 * H, ringkasan: TRIGGERS.hujan.contoh, scores: {}, confirmedAt: times[i], morning: null };
      Object.keys(sc).forEach(function (f) { ev.scores[f] = sc[f][i]; });
      s.events.push(ev);
    }
    return s;
  }
  state = load() || seedDemo();

  /* ---------- util ---------- */
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function $(sel, root) { return (root || document).querySelector(sel); }
  function fmt(t) { return new Date(t).toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }); }
  function toast(m) { var t = $("#toast"); t.textContent = m; t.classList.add("show"); clearTimeout(toast.h); toast.h = setTimeout(function () { t.classList.remove("show"); }, 2200); }
  function copy(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(text).then(function () { toast("Pesan disalin"); }, fallback); } else fallback();
    function fallback() { var ta = document.createElement("textarea"); ta.value = text; document.body.appendChild(ta); ta.select(); try { document.execCommand("copy"); toast("Pesan disalin"); } catch (e) { toast("Salin manual dari kotak pesan"); } ta.remove(); }
  }

  /* ---------- logika inti ---------- */
  // Skor tiap keluarga, berurutan menurut waktu konfirmasi.
  function history(fid) {
    return state.events.filter(function (e) { return e.scores && e.scores[fid] != null; })
      .sort(function (a, b) { return a.confirmedAt - b.confirmedAt; })
      .map(function (e) { return { s: e.scores[fid], t: e.confirmedAt, id: e.id }; });
  }
  // Aturan (asumsi rancangan, dapat diubah di menu Atur):
  // "menetap" bila pada N pemicu terakhir skor akhir >= skor awal dan skor akhir >= batas minimal.
  function evaluate(f) {
    var h = history(f.id), n = state.cfg.n;
    if (h.length < 2) return { kind: "baru", h: h };
    var w = h.slice(-n), first = w[0].s, last = w[w.length - 1].s;
    if (w.length >= n && last >= first && last >= state.cfg.min) {
      var anchor = w[w.length - 1].t;
      return { kind: "menetap", h: h, anchor: anchor, due: anchor + state.cfg.jam * H,
        visited: !!(f.visitedAt && f.visitedAt >= anchor), referred: !!(f.referredAt && f.referredAt >= anchor) };
    }
    if (last < first) return { kind: "pulih", h: h };
    return { kind: "pantau", h: h };
  }
  function recipients(statusKey) {
    // Pesan TENANG tidak dikirim ke keluarga yang skornya sudah turun (mencegah pencarian rasa aman berulang).
    return state.families.map(function (f) { return { f: f, ev: evaluate(f) }; }).filter(function (x) {
      return statusKey !== "tenang" || x.ev.kind !== "pulih";
    });
  }
  function buildSignal(trigger, statusKey, ringkasan) {
    var t = TRIGGERS[trigger], r = ringkasan.trim() || t.contoh;
    if (statusKey === "tenang") return "Menurut " + t.sumber + ", " + r;
    return (statusKey === "pergi" ? "PERGI. " : "BERSIAP. ") + "Menurut " + t.sumber + ", " + r + " Ikuti arahan petugas desa.";
  }
  function buildMorning(ev, durasi, konfirmasi, lain) {
    var t = TRIGGERS[ev.trigger];
    var m = "Semalam " + t.kata + " sekitar " + (durasi.trim() || "beberapa jam") + ". Banyak dari kita khawatir.\n\n" +
      "Pagi ini " + t.sumber + " memastikan " + (konfirmasi.trim() || "[isi konfirmasi resmi pagi ini]") + ".";
    if (lain.trim()) m += "\n\nPerlu diketahui juga: " + lain.trim() + ".";
    return m;
  }

  /* ---------- tampilan ---------- */
  function render() {
    document.querySelectorAll(".tabs button").forEach(function (b) { b.classList.toggle("active", b.dataset.tab === ui.tab); });
    $("#dusunLabel").textContent = state.demo ? "Prototipe – data contoh, bukan data nyata" : state.cfg.dusun;
    var v = $("#view");
    v.innerHTML = ({ pemicu: vPemicu, pagi: vPagi, pantau: vPantau, atur: vAtur })[ui.tab]();
    bind(v);
    window.scrollTo(0, 0);
  }

  function vPemicu() {
    var t = TRIGGERS[ui.trigger], st = ui.status;
    var opts = Object.keys(TRIGGERS).map(function (k) { return '<option value="' + k + '"' + (k === ui.trigger ? " selected" : "") + ">" + esc(TRIGGERS[k].label) + "</option>"; }).join("");
    var seg = Object.keys(STATUS).map(function (k) { return '<button type="button" data-s="' + k + '" class="' + (k === st ? "on" : "") + '">' + STATUS[k] + "</button>"; }).join("");
    var ring = ui.draft.ring != null ? ui.draft.ring : t.contoh;
    var msg = buildSignal(ui.trigger, st, ring);
    var rec = recipients(st), skip = state.families.length - rec.length;
    var html = '<h2>1 · Saat pemicu muncul</h2><div class="card">' +
      "<label>Jenis pemicu</label><select id=trg>" + opts + "</select>" +
      '<label>Status resmi dari ' + esc(t.sumber) + " (salin, jangan menebak)</label><div class=seg>" + seg + "</div>" +
      '<p class="note warn">REDA tidak menentukan status. Kader hanya menerjemahkan informasi resmi ke bahasa gampong.</p>' +
      "<label>Isi informasi resmi (ubah sesuai sumber)</label><textarea id=ring>" + esc(ring) + "</textarea></div>" +
      '<h3>Pesan ke warga</h3><div class="msg" id=msgbox>' + esc(msg) + "</div>" +
      '<button class="btn" id=siar>Simpan kejadian &amp; salin pesan</button>' +
      '<p class="note">Penerima: ' + rec.length + " keluarga" + (skip ? ". " + skip + " keluarga yang skornya sudah turun tidak diberi pesan TENANG, supaya tidak terbiasa mengecek rasa aman berulang-ulang." : ".") + "</p>";
    if (rec.length) html += '<div class="card"><div class="note">Daftar penerima</div>' + rec.map(function (x) { return "<div>" + esc(x.f.kode) + "</div>"; }).join("") + "</div>";
    return html;
  }

  function vPagi() {
    var pend = state.events.filter(function (e) { return !e.confirmedAt; });
    if (!pend.length) {
      return '<h2>2 · Pagi sesudahnya</h2><div class="card"><p>Tidak ada kejadian yang menunggu konfirmasi pagi.</p><p class="note">Catat kejadian baru di menu 1 (Pemicu), lalu kembali ke sini keesokan paginya.</p></div>';
    }
    var ev = pend.filter(function (e) { return e.id === ui.pagiEvent; })[0] || pend[pend.length - 1];
    ui.pagiEvent = ev.id;
    var d = ui.draft, t = TRIGGERS[ev.trigger];
    var sel = pend.map(function (e) { return '<option value="' + e.id + '"' + (e.id === ev.id ? " selected" : "") + ">" + esc(TRIGGERS[e.trigger].label + " · " + fmt(e.at)) + "</option>"; }).join("");
    var msg = buildMorning(ev, d.durasi || "", d.konf || "", d.lain || "");
    var fams = state.families.map(function (f) {
      var cur = d.sc && d.sc[f.id] != null ? d.sc[f.id] : null, btns = "";
      for (var i = 0; i <= 10; i++) btns += '<button type="button" data-f="' + f.id + '" data-v="' + i + '" class="' + (cur === i ? "on" : "") + '">' + i + "</button>";
      return '<div class="fam"><div class="name">' + esc(f.kode) + '</div><div class="scale">' + btns + "</div></div>";
    }).join("");
    return '<h2>2 · Pagi sesudahnya</h2><div class="card"><label>Kejadian</label><select id=pev>' + sel + "</select>" +
      "<label>Berapa lama kejadian semalam?</label><input type=text id=dur placeholder=\"mis. tiga jam\" value=\"" + esc(d.durasi || "") + '">' +
      "<label>Konfirmasi resmi pagi ini dari " + esc(t.sumber) + "</label><textarea id=konf placeholder=\"mis. sungai tetap di bawah batas siaga dan tidak ada banjir di dusun kita\">" + esc(d.konf || "") + "</textarea>" +
      "<label>Kejadian di dusun lain (wajib disebut bila ada)</label><input type=text id=lain placeholder=\"kosongkan bila tidak ada\" value=\"" + esc(d.lain || "") + '"></div>' +
      '<h3>Pesan pagi (membingkai ulang: yang ditakutkan tidak terjadi)</h3><div class="msg" id=msgbox>' + esc(msg) + "</div>" +
      '<button class="btn alt" id=salin>Salin pesan</button>' +
      '<h3>Satu pertanyaan untuk tiap keluarga</h3><div class="card"><div>Seberapa takut tadi malam? <span class=note>(0 = tidak takut, 10 = sangat takut)</span></div>' +
      (fams || '<p class="note">Belum ada keluarga. Tambahkan di menu Atur.</p>') + "</div>" +
      '<p class="note">Skor ini hanya untuk membaca tren antar-pemicu. Skor bukan diagnosis.</p>' +
      '<button class="btn" id=simpanPagi>Simpan skor pagi</button>';
  }

  function stepsHtml(e, f) {
    var s1 = '<span class="' + (e.visited ? "done" : "now") + '">Kunjungan kader &lt; ' + state.cfg.jam + " jam</span>";
    var s2 = '<span class="' + (e.referred ? "done" : e.visited ? "now" : "") + '">Skrining SRQ-20 di puskesmas</span>';
    var s3 = "<span>Psikolog klinis (bila perlu)</span>";
    return '<div class="steps">' + s1 + s2 + s3 + "</div>";
  }

  function vPantau() {
    var rows = state.families.map(function (f) { return { f: f, e: evaluate(f) }; });
    var flagged = rows.filter(function (r) { return r.e.kind === "menetap" && !r.e.visited; });
    var banner = flagged.length ?
      '<div class="banner warn"><b>' + flagged.length + " keluarga skornya menetap.</b> Jadwalkan kunjungan dalam " + state.cfg.jam + " jam.</div>" :
      '<div class="banner ok">Tidak ada keluarga yang menunggu kunjungan.</div>';
    var cards = rows.map(function (r) {
      var f = r.f, e = r.e, sc = e.h.slice(-state.cfg.n).map(function (x) { return x.s; }).join("  ") || "–";
      var pill = { baru: ["gray", "belum cukup data"], pantau: ["gray", "dipantau"], pulih: ["ok", "pulih alami"], menetap: ["warn", e.visited ? (e.referred ? "dirujuk" : "sudah dikunjungi") : "kunjungi"] }[e.kind];
      var extra = "";
      if (e.kind === "menetap") {
        var left = e.due - Date.now();
        var due = e.visited ? "" : (left > 0 ? '<div class="note warn">Batas kunjungan: ' + fmt(e.due) + " (sisa " + Math.max(1, Math.round(left / H)) + " jam)</div>" : '<div class="note warn"><b>Lewat batas kunjungan</b> (' + fmt(e.due) + ")</div>");
        extra = due + stepsHtml(e, f) +
          '<div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap">' +
          (!e.visited ? '<button class="btn small" data-act="visit" data-f="' + f.id + '">Tandai sudah dikunjungi</button>' : "") +
          (e.visited && !e.referred ? '<button class="btn small" data-act="refer" data-f="' + f.id + '">Rujuk ke skrining SRQ-20</button>' : "") + "</div>";
      }
      return '<div class="card"><div class="row"><div><div class="name"><b>' + esc(f.kode) + '</b></div><div class="scores">' + esc(sc) + '</div></div><span class="pill ' + pill[0] + '">' + pill[1] + "</span></div>" + extra + "</div>";
    }).join("");
    return '<h2>3 · Pemantauan keluarga</h2>' + banner +
      '<p class="note">Skor takut, ' + state.cfg.n + " pemicu terakhir. Aturan: skor tidak turun selama " + state.cfg.n + " pemicu berturut-turut dan skor akhir ≥ " + state.cfg.min + ". Ambang ini adalah asumsi rancangan, ditetapkan bersama psikolog puskesmas.</p>" +
      (cards || '<div class="card"><p>Belum ada keluarga.</p></div>') +
      '<div class="card"><b>Bila seseorang menyampaikan ingin menyakiti diri atau tampak dalam bahaya</b><p class="note">Jangan menunggu aturan di atas. Dampingi orang itu dan segera hubungi puskesmas atau layanan darurat setempat.</p></div>';
  }

  function vAtur() {
    var c = state.cfg;
    var fams = state.families.map(function (f) { return '<div class="row fam"><span>' + esc(f.kode) + '</span><button class="btn small danger" data-act="del" data-f="' + f.id + '">Hapus</button></div>'; }).join("") || '<p class="note">Belum ada keluarga.</p>';
    return '<h2>Atur</h2><div class="card"><div><b>Tambah keluarga</b></div>' +
      '<label>Kode keluarga (jangan pakai nama lengkap)</label><input type=text id=kode placeholder="mis. KL-07">' +
      '<label class=check><input type=checkbox id=cons> Keluarga sudah setuju dipantau dan tahu datanya hanya skor 0–10.</label>' +
      '<button class="btn small" id=addf>Tambah</button><div style="margin-top:10px">' + fams + "</div></div>" +
      '<div class="card"><div><b>Ambang rancangan</b></div><p class="note">Nilai awal adalah asumsi rancangan, bukan temuan. Ubah bersama psikolog puskesmas.</p>' +
      '<label>Jumlah pemicu berturut-turut tanpa penurunan</label><input type=number id=cn min=2 max=6 value="' + c.n + '">' +
      '<label>Batas waktu kunjungan (jam)</label><input type=number id=cj min=12 max=168 value="' + c.jam + '">' +
      '<label>Skor akhir minimal agar ditandai</label><input type=number id=cm min=1 max=10 value="' + c.min + '">' +
      '<label>Nama dusun</label><input type=text id=cd value="' + esc(c.dusun) + '">' +
      '<button class="btn small" id=savec>Simpan</button></div>' +
      '<div class="card"><div><b>Data</b></div><p class="note">Semua data hanya tersimpan di peramban ponsel ini. Tidak ada yang dikirim ke server.</p>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn small alt" id=csv>Unduh CSV</button><button class="btn small alt" id=demo>Muat data contoh</button><button class="btn small danger" id=wipe>Hapus semua &amp; mulai kosong</button></div></div>' +
      '<div class="card"><b>Tentang prototipe</b><p class="note">Ini prototipe untuk menguji alur kerja kader, bukan alat klinis. Ia tidak mendiagnosis dan tidak menentukan status bahaya; status selalu berasal dari BMKG, BPBD, atau PVMBG. Skor hanya dipakai untuk membaca tren, rujukan tetap lewat skrining SRQ-20 di puskesmas.</p></div>';
  }

  /* ---------- event ---------- */
  function bind(v) {
    var el;
    if (ui.tab === "pemicu") {
      $("#trg").onchange = function (e) { ui.trigger = e.target.value; ui.draft.ring = null; render(); };
      v.querySelectorAll(".seg button").forEach(function (b) { b.onclick = function () { ui.status = b.dataset.s; render(); }; });
      $("#ring").oninput = function (e) { ui.draft.ring = e.target.value; $("#msgbox").textContent = buildSignal(ui.trigger, ui.status, e.target.value); };
      $("#siar").onclick = function () {
        var ring = ui.draft.ring != null ? ui.draft.ring : TRIGGERS[ui.trigger].contoh;
        var msg = buildSignal(ui.trigger, ui.status, ring);
        state.events.push({ id: "e" + Date.now(), trigger: ui.trigger, status: ui.status, at: Date.now(), ringkasan: ring, scores: {}, confirmedAt: null });
        save(); copy(msg); ui.draft = {}; $("#siar").disabled = true; $("#siar").textContent = "Tersimpan. Lanjutkan besok pagi di menu 2"; toast("Kejadian tersimpan");
      };
    }
    if (ui.tab === "pagi" && $("#pev")) {
      $("#pev").onchange = function (e) { ui.pagiEvent = e.target.value; render(); };
      var upd = function () { ui.draft.durasi = $("#dur").value; ui.draft.konf = $("#konf").value; ui.draft.lain = $("#lain").value; var ev = state.events.filter(function (x) { return x.id === ui.pagiEvent; })[0]; $("#msgbox").textContent = buildMorning(ev, ui.draft.durasi, ui.draft.konf, ui.draft.lain); };
      ["dur", "konf", "lain"].forEach(function (id) { $("#" + id).oninput = upd; });
      v.querySelectorAll(".scale button").forEach(function (b) {
        b.onclick = function () { ui.draft.sc = ui.draft.sc || {}; ui.draft.sc[b.dataset.f] = +b.dataset.v; b.parentNode.querySelectorAll("button").forEach(function (x) { x.classList.toggle("on", x === b); }); };
      });
      $("#salin").onclick = function () { copy($("#msgbox").textContent); };
      $("#simpanPagi").onclick = function () {
        var ev = state.events.filter(function (x) { return x.id === ui.pagiEvent; })[0];
        if (!(ui.draft.konf || "").trim()) { toast("Isi konfirmasi resmi pagi ini dulu"); return; }
        var sc = ui.draft.sc || {}, miss = state.families.filter(function (f) { return sc[f.id] == null; });
        if (miss.length && !confirm(miss.length + " keluarga belum diberi skor. Simpan tetap?")) return;
        Object.keys(sc).forEach(function (k) { ev.scores[k] = sc[k]; });
        ev.confirmedAt = Date.now(); ev.morning = $("#msgbox").textContent;
        save(); ui.draft = {}; ui.pagiEvent = null; ui.tab = "pantau"; toast("Skor tersimpan"); render();
      };
    }
    if (ui.tab === "pantau") {
      v.querySelectorAll("[data-act]").forEach(function (b) {
        b.onclick = function () {
          var f = state.families.filter(function (x) { return x.id === b.dataset.f; })[0];
          if (b.dataset.act === "visit") f.visitedAt = Date.now();
          if (b.dataset.act === "refer") f.referredAt = Date.now();
          save(); render();
        };
      });
    }
    if (ui.tab === "atur") {
      $("#addf").onclick = function () {
        var k = $("#kode").value.trim();
        if (!k) { toast("Isi kode keluarga"); return; }
        if (!$("#cons").checked) { toast("Persetujuan keluarga wajib dicentang"); return; }
        state.families.push({ id: "F" + Date.now(), kode: k, visitedAt: null, referredAt: null });
        if (state.demo) { /* tetap tampil sebagai contoh sampai dihapus */ }
        save(); render(); toast("Keluarga ditambahkan");
      };
      v.querySelectorAll('[data-act="del"]').forEach(function (b) {
        b.onclick = function () { if (!confirm("Hapus keluarga ini beserta skornya?")) return; var id = b.dataset.f; state.families = state.families.filter(function (f) { return f.id !== id; }); state.events.forEach(function (e) { delete e.scores[id]; }); save(); render(); };
      });
      $("#savec").onclick = function () {
        var n = +$("#cn").value, j = +$("#cj").value, m = +$("#cm").value;
        if (!(n >= 2 && n <= 6 && j >= 12 && j <= 168 && m >= 1 && m <= 10)) { toast("Nilai di luar rentang"); return; }
        state.cfg = { n: n, jam: j, min: m, dusun: $("#cd").value.trim() || "Dusun Contoh" };
        save(); toast("Tersimpan"); render();
      };
      $("#demo").onclick = function () { if (confirm("Ganti semua data dengan data contoh?")) { state = seedDemo(); save(); render(); } };
      $("#wipe").onclick = function () { if (confirm("Hapus semua data di ponsel ini?")) { state = blank(); save(); render(); } };
      $("#csv").onclick = function () {
        var done = state.events.filter(function (e) { return e.confirmedAt; });
        var head = ["kode_keluarga"].concat(done.map(function (e) { return fmt(e.confirmedAt) + " " + TRIGGERS[e.trigger].label; }));
        var rows = state.families.map(function (f) { return [f.kode].concat(done.map(function (e) { return e.scores[f.id] != null ? e.scores[f.id] : ""; })); });
        var csv = [head].concat(rows).map(function (r) { return r.map(function (c) { return '"' + String(c).replace(/"/g, '""') + '"'; }).join(","); }).join("\n");
        var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); a.download = "reda-skor.csv"; a.click();
      };
    }
  }

  document.querySelectorAll(".tabs button").forEach(function (b) { b.onclick = function () { ui.tab = b.dataset.tab; ui.draft = {}; render(); }; });
  render();
})();
