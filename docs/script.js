/* mem docs — theme, sidebar, scroll-spy, copy, mobile nav, search */
(function () {
  "use strict";

  // ── theme ────────────────────────────────────────────────
  var root = document.documentElement;
  var saved = null;
  try { saved = localStorage.getItem("mem-docs-theme"); } catch (e) {}
  if (saved) root.setAttribute("data-theme", saved);
  else if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches)
    root.setAttribute("data-theme", "dark");

  var themeBtn = document.getElementById("theme-btn");
  themeBtn && themeBtn.addEventListener("click", function () {
    var cur = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
    if (cur === "light") root.removeAttribute("data-theme"); else root.setAttribute("data-theme", cur);
    try { localStorage.setItem("mem-docs-theme", cur === "light" ? "light" : "dark"); } catch (e) {}
  });

  // ── mobile sidebar ────────────────────────────────────────
  var menuBtn = document.getElementById("menu-btn");
  var sidebar = document.getElementById("sidebar");
  var overlay = document.getElementById("overlay");
  function closeSidebar() { sidebar.classList.remove("open"); overlay && overlay.classList.remove("show"); }
  menuBtn && menuBtn.addEventListener("click", function () {
    sidebar.classList.add("open"); overlay && overlay.classList.add("show");
  });
  overlay && overlay.addEventListener("click", closeSidebar);

  // ── copy buttons ──────────────────────────────────────────
  document.querySelectorAll(".codeblock").forEach(function (block) {
    var btn = block.querySelector(".copy");
    if (!btn) return;
    btn.addEventListener("click", function () {
      var code = block.querySelector("pre code") || block.querySelector("pre");
      var text = code ? code.innerText : "";
      var done = function () { btn.textContent = "copied"; setTimeout(function () { btn.textContent = "copy"; }, 1200); };
      if (navigator.clipboard && navigator.clipboard.writeText)
        navigator.clipboard.writeText(text).then(done).catch(function () { fallbackCopy(text); done(); });
      else { fallbackCopy(text); done(); }
    });
  });
  function fallbackCopy(text) {
    var ta = document.createElement("textarea"); ta.value = text;
    ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); } catch (e) {}
    document.body.removeChild(ta);
  }

  // ── scroll-spy: sidebar + TOC + section heading ───────────
  var navLinks = Array.prototype.slice.call(document.querySelectorAll(".sidebar a[data-target]"));
  var tocLinks = Array.prototype.slice.call(document.querySelectorAll(".toc a[data-target]"));
  var sections = [];
  function lookupSection(id) {
    return document.getElementById(id) || document.querySelector('[data-anchor="' + id + '"]');
  }
  function refresh() {
    sections = (navLinks.length ? navLinks : tocLinks).map(function (a) {
      return { id: a.getAttribute("data-target"), el: lookupSection(a.getAttribute("data-target")), link: a };
    }).filter(function (s) { return s.el; });
  }
  refresh();

  var ticking = false;
  function onScroll() {
    if (ticking) return; ticking = true;
    requestAnimationFrame(function () {
      var pos = window.scrollY + 100;
      var active = null;
      for (var i = 0; i < sections.length; i++) {
        if (sections[i].el.offsetTop <= pos) active = sections[i];
      }
      var activeId = active ? active.id : (sections[0] ? sections[0].id : null);
      function mark(list) {
        list.forEach(function (a) {
          a.classList.toggle("active", a.getAttribute("data-target") === activeId);
        });
      }
      if (activeId) { mark(navLinks); mark(tocLinks); }
      ticking = false;
    });
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", refresh, { passive: true });
  onScroll();

  // ── command palette (⌘K / Ctrl+K) ─────────────────────────
  var index = [];
  function buildIndex() {
    index = navLinks.map(function (a) {
      return { id: a.getAttribute("data-target"), label: a.textContent.trim(), link: a };
    });
  }
  buildIndex();
  document.addEventListener("keydown", function (e) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
      e.preventDefault(); openPalette();
    }
    if (e.key === "Escape") closePalette();
  });
  document.getElementById("search-btn") && document.getElementById("search-btn").addEventListener("click", openPalette);

  function openPalette() {
    var existing = document.getElementById("palette");
    if (existing) { existing.querySelector("input").focus(); return; }
    var pal = document.createElement("div");
    pal.id = "palette";
    pal.style.cssText = "position:fixed;inset:0;z-index:100;display:flex;align-items:flex-start;justify-content:center;padding:12vh 20px 0;background:rgba(0,0,0,.45);backdrop-filter:blur(3px)";
    var box = document.createElement("div");
    box.style.cssText = "width:100%;max-width:520px;background:var(--bg);border:1px solid var(--border-strong);border-radius:12px;box-shadow:var(--shadow);overflow:hidden";
    var input = document.createElement("input");
    input.placeholder = "Jump to section…";
    input.style.cssText = "width:100%;border:0;outline:0;padding:16px 18px;font-size:15px;background:var(--bg);color:var(--text);font-family:var(--sans);border-bottom:1px solid var(--border)";
    var list = document.createElement("div");
    list.style.cssText = "max-height:320px;overflow-y:auto";
    box.appendChild(input); box.appendChild(list); pal.appendChild(box);
    document.body.appendChild(pal);
    var items = [];
    function render(q) {
      list.innerHTML = ""; items = [];
      var ql = q.toLowerCase().trim();
      var matches = ql ? index.filter(function (it) { return it.label.toLowerCase().indexOf(ql) >= 0 || it.id.indexOf(ql) >= 0; }) : index;
      matches.slice(0, 8).forEach(function (it, i) {
        var row = document.createElement("div");
        row.textContent = it.label;
        row.style.cssText = "padding:10px 18px;cursor:pointer;font-size:14px;border-bottom:1px solid var(--border)" + (i === 0 ? ";background:var(--accent-soft);color:var(--accent-text)" : "");
        row.addEventListener("mouseenter", function () { select(i); });
        row.addEventListener("click", function () { go(it); });
        list.appendChild(row); items.push(row);
      });
      sel = 0;
    }
    var sel = 0;
    function select(i) {
      items.forEach(function (r) { r.style.background = ""; r.style.color = ""; });
      if (items[i]) { items[i].style.background = "var(--accent-soft)"; items[i].style.color = "var(--accent-text)"; items[i].scrollIntoView({ block: "nearest" }); }
      sel = i;
    }
    function go(it) { closePalette(); var el = lookupSection(it.id); if (el) el.scrollIntoView({_behavior:"smooth"}); }
    input.addEventListener("input", function () { render(input.value); });
    input.addEventListener("keydown", function (e) {
      if (e.key === "ArrowDown") { e.preventDefault(); select(Math.min(sel + 1, items.length - 1)); }
      else if (e.key === "ArrowUp") { e.preventDefault(); select(Math.max(sel - 1, 0)); }
      else if (e.key === "Enter") { e.preventDefault(); if (items[sel]) items[sel].click(); }
    });
    pal.addEventListener("click", function (e) { if (e.target === pal) closePalette(); });
    render("");
    input.focus();
  }
  function closePalette() {
    var pal = document.getElementById("palette");
    if (pal) pal.remove();
  }

  // ── gh/anchor link enhancement: ensure smooth scroll on click ──
  document.querySelectorAll('a[href^="#"]').forEach(function (a) {
    a.addEventListener("click", function () {
      var id = a.getAttribute("href").slice(1);
      var el = document.getElementById(id);
      if (el) { el.scrollIntoView({ behavior: "smooth" }); history.replaceState(null, "", "#" + id); closeSidebar(); }
    });
  });

  // ── terminal typing animation (hero demo) ─────────────────
  var OUTPUTS = {
    "2": '<span class="ok">3 matches</span>\n  <span class="ok">docker compose up -d</span>     recent\n  <span class="muted">docker compose down</span>      <span class="muted">used 8×</span>\n  <span class="muted">docker compose logs -f</span>   <span class="muted">used 3×</span>\n',
    "4": '<span class="ok">mem stats</span>\n  <span class="muted">History</span>  1,234 commands (567 unique)\n\n  <span class="muted">Top 10 commands</span>\n   <span class="muted">1.</span> git status                   <span class="ok">45</span> <span class="bar">████████████████████</span>\n   <span class="muted">2.</span> docker compose up -d         <span class="ok">32</span> <span class="bar">██████████████</span>\n   <span class="muted">3.</span> npm run build                <span class="ok">28</span> <span class="bar">████████████</span>\n',
    "6": '<span class="ok">mem recent</span>\n  <span class="muted">Last 3 commands</span>\n\n   <span class="muted">1.</span> npm test\n   <span class="muted">2.</span> git status\n   <span class="muted">3.</span> docker compose up -d\n'
  };

  function typeInto(el, text, speed) {
    return new Promise(function (resolve) {
      var i = 0;
      el.textContent = "";
      var t = setInterval(function () {
        if (i >= text.length) { clearInterval(t); resolve(); return; }
        el.textContent += text[i++];
      }, speed || 35);
    });
  }

  function runDemo() {
    var body = document.getElementById("terminal-body");
    if (!body) return;
    var lines = Array.prototype.slice.call(body.querySelectorAll(".t-line"));
    var outs = Array.prototype.slice.call(body.querySelectorAll(".t-out"));

    async function play() {
      for (var i = 0; i < lines.length; i++) {
        var line = lines[i];
        var cmdEl = line.querySelector(".t-cmd");
        var cmd = cmdEl ? cmdEl.getAttribute("data-cmd") || "" : "";
        await typeInto(cmdEl, cmd, 38);
        line.classList.add("done");
        var outEl = outs[i];
        if (outEl && OUTPUTS[String(i + 1)]) {
          await new Promise(function (r) { setTimeout(r, parseInt(outEl.getAttribute("data-delay") || "300", 10)); });
          outEl.innerHTML = OUTPUTS[String(i + 1)];
          outEl.classList.add("show");
        }
      }
    }
    play();
  }

  // Play on load + replay when terminal scrolls into view
  if (document.getElementById("terminal-body")) {
    setTimeout(runDemo, 600);
  }

  // ── Animate every code block once it scrolls into view ─────
  var blocks = document.querySelectorAll(".codeblock pre");
  var observer = ("IntersectionObserver" in window) ? new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      var pre = e.target;
      observer.unobserve(pre);
      var code = pre.querySelector("code") || pre;
      var full = code.textContent;
      if (!full) return;
      var block = pre.parentElement;
      block.classList.add("typing");
      code.textContent = "";
      var i = 0;
      var speed = full.length > 200 ? 6 : 14;
      var t = setInterval(function () {
        if (i >= full.length) { clearInterval(t); block.classList.remove("typing"); return; }
        var chunk = full.charCodeAt(i) === 10 ? "\n" : full[i];
        code.textContent += chunk;
        i++;
        if (i % 3 === 0) pre.scrollTop = pre.scrollHeight;
      }, speed);
    });
  }, { threshold: 0.2, rootMargin: "0px 0px -10% 0px" }) : null;

  if (observer) {
    blocks.forEach(function (b) { observer.observe(b); });
  }
})();
