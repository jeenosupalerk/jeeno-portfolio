// ============================================
// Supalerk Chaonchom — Portfolio interactions
// Vanilla JS: no build step needed, deploys as-is.
// ============================================

(function () {
  "use strict";

  var root = document.documentElement;
  var LANG_KEY = "jeeno-portfolio-lang";

  /* ---------- Language toggle ---------- */

  function applyLang(lang) {
    root.setAttribute("data-lang", lang);
    root.setAttribute("lang", lang === "th" ? "th" : "en");

    document.querySelectorAll("[data-en]").forEach(function (el) {
      var text = lang === "th" ? el.getAttribute("data-th") : el.getAttribute("data-en");
      if (text != null) el.innerHTML = text;
    });

    document.querySelectorAll("[data-lang-btn]").forEach(function (btn) {
      btn.classList.toggle("active", btn.getAttribute("data-lang-btn") === lang);
    });

    try { localStorage.setItem(LANG_KEY, lang); } catch (e) { /* ignore */ }
  }

  function initLang() {
    var saved = "en";
    try { saved = localStorage.getItem(LANG_KEY) || "en"; } catch (e) { /* ignore */ }
    applyLang(saved);

    var toggle = document.getElementById("langToggle");
    if (toggle) {
      toggle.addEventListener("click", function () {
        var current = root.getAttribute("data-lang") || "en";
        applyLang(current === "en" ? "th" : "en");
      });
    }
  }

  /* ---------- Scroll reveal ---------- */

  function initReveal() {
    var items = document.querySelectorAll(".reveal");
    if (!("IntersectionObserver" in window)) {
      items.forEach(function (el) { el.classList.add("in-view"); });
      return;
    }
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("in-view");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -60px 0px" }
    );
    items.forEach(function (el) { observer.observe(el); });
  }

  /* ---------- Services accordion ---------- */

  function initAccordion() {
    var acc = document.getElementById("servicesAccordion");
    if (!acc) return;
    acc.querySelectorAll(".accordion-head").forEach(function (head) {
      head.addEventListener("click", function () {
        var item = head.closest(".accordion-item");
        var wasOpen = item.classList.contains("is-open");
        acc.querySelectorAll(".accordion-item").forEach(function (el) {
          el.classList.remove("is-open");
        });
        if (!wasOpen) item.classList.add("is-open");
      });
    });
  }

  /* ---------- Mobile nav ---------- */

  function initMobileNav() {
    var toggle = document.getElementById("menuToggle");
    var links = document.getElementById("navLinks");
    if (!toggle || !links) return;
    toggle.addEventListener("click", function () {
      links.classList.toggle("is-open");
    });
    links.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", function () { links.classList.remove("is-open"); });
    });
  }

  /* ---------- Hover-to-reveal color (photo + work thumbnails) ---------- */

  function initPhotoReveal() {
    var items = document.querySelectorAll(".photo-reveal");
    if (!items.length) return;

    items.forEach(function (el) {
      function setPos(clientX, clientY) {
        var rect = el.getBoundingClientRect();
        var x = ((clientX - rect.left) / rect.width) * 100;
        var y = ((clientY - rect.top) / rect.height) * 100;
        x = Math.max(0, Math.min(100, x));
        y = Math.max(0, Math.min(100, y));
        el.style.setProperty("--mx", x + "%");
        el.style.setProperty("--my", y + "%");
      }

      el.addEventListener("pointerenter", function (e) {
        el.classList.add("is-active");
        setPos(e.clientX, e.clientY);
      });
      el.addEventListener("pointermove", function (e) {
        setPos(e.clientX, e.clientY);
      });
      el.addEventListener("pointerleave", function () {
        el.classList.remove("is-active");
      });
    });
  }

  /* ---------- Footer year ---------- */

  function initYear() {
    var el = document.getElementById("year");
    if (el) el.textContent = new Date().getFullYear();
  }

  /* ---------- Work-card motion preview ----------
     Desktop: the clip plays while the pointer is over the card.
     Touch (no hover): it plays whenever the card is on screen.
  */

  function initWorkPreview() {
    var videos = document.querySelectorAll(".work-video");
    if (!videos.length) return;

    var canHover = window.matchMedia && window.matchMedia("(hover: hover)").matches;

    videos.forEach(function (video) {
      var card = video.closest(".work-card");
      if (!card) return;

      function play() {
        var p = video.play();
        if (p && p.catch) p.catch(function () { /* autoplay blocked: poster stays */ });
      }
      function stop() {
        video.pause();
        try { video.currentTime = 0; } catch (e) { /* ignore */ }
      }

      if (canHover) {
        card.addEventListener("pointerenter", play);
        card.addEventListener("pointerleave", stop);
        return;
      }

      video.classList.add("is-playing");
      if (!("IntersectionObserver" in window)) { play(); return; }
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) play(); else video.pause();
        });
      }, { threshold: 0.45 });
      io.observe(card);
    });
  }

  /* ---------- PDF download ----------
     On the real deployed site, the plain <a download> works natively,
     so this only steps in when running inside the claude.ai Artifact
     preview (where window.claude.use("downloads") exists) — plain
     download links do nothing there.
  */

  function initPdfDownload() {
    var links = document.querySelectorAll(".cs-pdf-download");
    if (!links.length) return;
    if (!window.claude || typeof window.claude.use !== "function") return;

    links.forEach(function (link) {
      link.addEventListener("click", function (e) {
        e.preventDefault();
        if (link.classList.contains("is-downloading")) return;
        link.classList.add("is-downloading");

        window.claude
          .use("downloads")
          .then(function (downloads) {
            if (!downloads) {
              window.open(link.getAttribute("href"), "_blank");
              return null;
            }
            return fetch(link.getAttribute("href"))
              .then(function (resp) { return resp.blob(); })
              .then(function (blob) {
                var filename = link.getAttribute("data-filename") ||
                  link.getAttribute("href").split("/").pop();
                return downloads.save({ filename: filename, data: blob });
              });
          })
          .catch(function (err) {
            /* declined / rate_limited / unavailable: no retry, no loop */
            if (window.console && console.warn) {
              console.warn("PDF download unavailable:", err && err.code ? err.code : err);
            }
          })
          .then(function () {
            link.classList.remove("is-downloading");
          });
      });
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    initLang();
    initReveal();
    initAccordion();
    initMobileNav();
    initPhotoReveal();
    initYear();
    initWorkPreview();
    initPdfDownload();
  });
})();
