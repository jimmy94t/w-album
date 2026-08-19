/* ============================================================
   電子婚紗 · 翻頁引擎
   一般情況不需要改這個檔案。要改內容請改「config/album.js」
   ============================================================ */
(function () {
  "use strict";

  var C = window.相簿設定;
  var IMGDIR = "photos/";
  var RATIO_PC = 0.75;            // 電腦：單頁 寬/高
  var RATIO_M = 0.62;             // 手機：單頁 寬/高
  var FLIP_MS = 950;

  /* ---------------- 組出所有頁面 ---------------- */
  var pages = [];
  var tocList = [];

  pages.push({ 型: "封面" });
  C.章節.forEach(function (ch, i) {
    tocList.push({ i: i, at: pages.length, ch: ch });
    pages.push({ 型: "章名", ch: ch });
    (ch.頁面 || []).forEach(function (p) {
      var q = {};
      for (var k in p) q[k] = p[k];
      q.__ch = ch;
      pages.push(q);
    });
  });
  pages.push({ 型: "結語" });

  /* ---------------- 頁面 HTML ---------------- */
  function esc(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  function img(name) {
    return '<img loading="lazy" src="' + IMGDIR + encodeURIComponent(name) + '" alt="">';
  }
  function cap(t) {
    return '<div class="cap' + (t ? "" : " empty") + '">' + esc(t || "") + "</div>";
  }

  function pageHTML(p, n) {
    if (!p) return '<div class="page"></div>';

    if (p.型 === "封面") {
      var c = C.封面 || {};
      return '<div class="cover">' +
        '<div class="head">' +
          '<div class="en">' + esc(c.英文標) + "</div>" +
          "<h1>" + esc(c.主標) + "</h1>" +
          '<div class="rule"></div>' +
          '<div class="sub">' + esc(c.副標) + "</div>" +
        "</div>" +
        '<div class="shot">' + img(c.圖) + "</div>" +
        '<div class="foot"><div class="tiny">' + esc(c.小字) + "</div></div>" +
        "</div>";
    }

    if (p.型 === "結語") {
      var e = C.結語 || {};
      return '<div class="ending">' +
        '<div class="head">' +
          '<div class="en">' + esc(e.英文標) + "</div>" +
          "<h2>" + esc(e.主標) + "</h2>" +
          '<div class="rule"></div>' +
        "</div>" +
        '<div class="shot">' + img(e.圖) + "</div>" +
        '<div class="foot"><p>' + esc(e.內文) + "</p>" +
        '<div class="sign">' + esc(e.署名) + "</div></div>" +
        "</div>";
    }

    var body = "";

    if (p.型 === "章名") {
      var ch = p.ch;
      body = '<div class="chapter">' +
        '<div class="num">' + esc(ch.編號) + "</div>" +
        '<div class="rule"></div>' +
        "<h2>" + esc(ch.標題) + "</h2>" +
        '<div class="en">' + esc(ch.英文) + "</div>" +
        '<div class="lead">' + esc(ch.引言) + "</div>" +
        "</div>";
    } else if (p.型 === "文字") {
      body = '<div class="textpage"><p>' + esc(p.主文) + "</p>" +
        (p.署名 ? '<div class="sign">' + esc(p.署名) + "</div>" : "") + "</div>";
    } else if (p.型 === "滿版") {
      body = '<div class="shots"><div class="shot">' + img(p.圖) + "</div></div>" + cap(p.說明);
    } else if (p.型 === "雙直") {
      body = '<div class="shots">' +
        '<div class="shot">' + img(p.圖[0]) + "</div>" +
        '<div class="shot">' + img(p.圖[1]) + "</div>" +
        "</div>" + cap(p.說明);
    } else if (p.型 === "雙橫") {
      body = '<div class="shots col">' +
        '<div class="shot">' + img(p.圖[0]) + "</div>" +
        '<div class="shot">' + img(p.圖[1]) + "</div>" +
        "</div>" + cap(p.說明);
    } else {
      body = ""; // 空白頁
    }

    var num = (p.型 === "章名" || p.型 === "空白") ? "" : '<div class="pnum">' + n + "</div>";
    return '<div class="page">' + body + num + "</div>";
  }

  /* ---------------- DOM ---------------- */
  var stage = document.getElementById("stage");
  var book = document.getElementById("book");
  var counter = document.getElementById("counter");
  var btnPrev = document.getElementById("prev");
  var btnNext = document.getElementById("next");
  var hint = document.getElementById("hint");

  var mobile = false;
  var leaves = [];
  var pos = 0;            // 桌機:已翻頁數 / 手機:目前頁索引
  var animating = false;

  function isMobileNow() {
    var vw = window.innerWidth, vh = window.innerHeight;
    return vw < 860 || vw / vh < 1.15;
  }

  function sizeUp() {
    var vw = window.innerWidth, vh = window.innerHeight, ph, ratio;
    if (mobile) {
      ratio = RATIO_M;
      ph = Math.min(vh - 104, (vw - 16) / ratio);
    } else {
      ratio = RATIO_PC;
      ph = Math.min(vh - 132, (vw - 90) / 2 / ratio);
    }
    ph = Math.max(260, Math.round(ph));
    document.documentElement.style.setProperty("--ph", ph + "px");
    document.documentElement.style.setProperty("--pw", Math.round(ph * ratio) + "px");
  }

  function build() {
    mobile = isMobileNow();
    document.body.classList.toggle("mobile", mobile);
    sizeUp();
    book.innerHTML = '<div id="spine"></div>';
    leaves = [];

    if (mobile) {
      pages.forEach(function (p, i) {
        var lf = document.createElement("div");
        lf.className = "leaf";
        lf.style.zIndex = pages.length - i;
        lf.innerHTML =
          '<div class="face front">' + pageHTML(p, i) + "</div>" +
          '<div class="face back"><div class="page"></div></div>';
        book.appendChild(lf);
        leaves.push(lf);
      });
    } else {
      var list = pages.slice();
      if (list.length % 2) list.push({ 型: "空白" });
      for (var i = 0; i < list.length; i += 2) {
        var lf = document.createElement("div");
        lf.className = "leaf";
        lf.innerHTML =
          '<div class="face front">' + pageHTML(list[i], i) + "</div>" +
          '<div class="face back">' + pageHTML(list[i + 1], i + 1) + "</div>";
        book.appendChild(lf);
        leaves.push(lf);
      }
    }
    apply(true);
  }

  function total() { return leaves.length; }

  function apply(instant) {
    if (instant) {
      leaves.forEach(function (l) { l.style.transition = "none"; });
    }
    leaves.forEach(function (l, i) {
      var flipped = i < pos;
      l.classList.toggle("flipped", flipped);
      l.style.zIndex = flipped ? i + 1 : total() - i + 1;
      if (mobile) l.style.display = (flipped && i < pos - 1) ? "none" : "";
    });
    if (!mobile) {
      book.classList.toggle("closed", pos === 0);
      book.classList.toggle("finished", pos >= total());
      book.classList.toggle("opened", pos > 0 && pos < total());
    }
    if (instant) {
      void book.offsetWidth;
      leaves.forEach(function (l) { l.style.transition = ""; });
    }
    updateUI();
  }

  function updateUI() {
    var cur, max;
    if (mobile) { cur = pos + 1; max = pages.length; }
    else { cur = pos; max = total(); }
    counter.textContent = mobile
      ? cur + " / " + max
      : (pos === 0 ? "封面" : (pos >= max ? "封底" : pos + " / " + max));
    btnPrev.disabled = pos <= 0;
    btnNext.disabled = mobile ? pos >= pages.length - 1 : pos >= total();
  }

  function go(dir) {
    if (animating) return;
    var limit = mobile ? pages.length - 1 : total();
    var np = pos + dir;
    if (np < 0 || np > limit) return;
    animating = true;
    if (mobile && dir < 0) {
      // 先讓上一頁出現，再轉回來
      var l = leaves[np];
      if (l) l.style.display = "";
    }
    pos = np;
    apply(false);
    setTimeout(function () { animating = false; apply(false); }, FLIP_MS);
  }

  function jump(target) {
    if (animating) return;
    pos = mobile ? target : Math.floor(target / 2);
    apply(true);
  }

  /* ---------------- 操作 ---------------- */
  btnPrev.addEventListener("click", function () { go(-1); });
  btnNext.addEventListener("click", function () { go(1); });

  document.addEventListener("keydown", function (e) {
    if (document.getElementById("toc").classList.contains("on")) {
      if (e.key === "Escape") closeToc();
      return;
    }
    if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") { e.preventDefault(); go(1); }
    if (e.key === "ArrowLeft" || e.key === "PageUp") { e.preventDefault(); go(-1); }
  });

  stage.addEventListener("click", function (e) {
    var r = stage.getBoundingClientRect();
    go(e.clientX - r.left < r.width / 2 ? -1 : 1);
  });

  var tx = 0, ty = 0, tmoved = false;
  stage.addEventListener("touchstart", function (e) {
    tx = e.touches[0].clientX; ty = e.touches[0].clientY; tmoved = false;
  }, { passive: true });
  stage.addEventListener("touchmove", function () { tmoved = true; }, { passive: true });
  stage.addEventListener("touchend", function (e) {
    if (!tmoved) return;
    var dx = e.changedTouches[0].clientX - tx;
    var dy = e.changedTouches[0].clientY - ty;
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) { go(dx < 0 ? 1 : -1); }
  }, { passive: true });

  var wheelLock = 0;
  stage.addEventListener("wheel", function (e) {
    var now = Date.now();
    if (now - wheelLock < 700) return;
    var d = Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
    if (Math.abs(d) < 12) return;
    wheelLock = now;
    go(d > 0 ? 1 : -1);
  }, { passive: true });

  var rt;
  window.addEventListener("resize", function () {
    clearTimeout(rt);
    rt = setTimeout(function () {
      var wasMobile = mobile;
      var absolute = mobile ? pos : pos * 2;
      if (isMobileNow() !== wasMobile) { build(); jump(absolute); }
      else { sizeUp(); }
    }, 180);
  });

  /* ---------------- 目錄 ---------------- */
  var toc = document.getElementById("toc");
  var tocBox = document.getElementById("tocbox");
  tocList.forEach(function (t) {
    var a = document.createElement("a");
    a.innerHTML = '<span class="n">' + String(t.i + 1).padStart(2, "0") + "</span>" +
      '<span class="t">' + esc(t.ch.標題) + "</span>" +
      '<span class="e">' + esc(t.ch.英文) + "</span>";
    a.addEventListener("click", function () { closeToc(); jump(t.at); });
    tocBox.appendChild(a);
  });
  function openToc() { toc.classList.add("on"); }
  function closeToc() { toc.classList.remove("on"); }
  document.getElementById("btn-toc").addEventListener("click", openToc);
  toc.addEventListener("click", function (e) { if (e.target === toc) closeToc(); });

  /* ---------------- 音樂 ---------------- */
  var audio = document.getElementById("bgm");
  var btnMusic = document.getElementById("btn-music");
  audio.src = "music/" + encodeURIComponent((C.音樂 && C.音樂.檔名) || "bgm.mp3");
  audio.volume = (C.音樂 && typeof C.音樂.音量 === "number") ? C.音樂.音量 : 0.35;

  function setMusic(on) {
    if (on) {
      var pr = audio.play();
      if (pr && pr.catch) pr.catch(function () { btnMusic.textContent = "♪ 音樂"; });
      btnMusic.textContent = "♪ 音樂 開";
      btnMusic.classList.add("on");
    } else {
      audio.pause();
      btnMusic.textContent = "♪ 音樂 關";
      btnMusic.classList.remove("on");
    }
  }
  btnMusic.addEventListener("click", function () { setMusic(audio.paused); });

  /* ---------------- 開場 ---------------- */
  var intro = document.getElementById("intro");
  function start(withMusic) {
    setMusic(!!withMusic);
    intro.classList.add("hide");
    setTimeout(function () { intro.style.display = "none"; }, 850);
    hint.classList.add("on");
    setTimeout(function () { hint.classList.remove("on"); }, 4200);
  }
  document.getElementById("start-music").addEventListener("click", function () { start(true); });
  document.getElementById("start-mute").addEventListener("click", function () { start(false); });

  /* ---------------- 走 ---------------- */
  document.title = C.網頁標題 || "Our Story";
  document.getElementById("intro-title").textContent = (C.封面 && C.封面.主標) || "";
  document.getElementById("intro-en").textContent = (C.封面 && C.封面.英文標) || "";
  document.getElementById("intro-sub").textContent = (C.封面 && C.封面.副標) || "";
  build();
})();
