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

  /* ---------- About photo: hover-to-reveal color ---------- */

  function initPhotoReveal() {
    var el = document.getElementById("photoReveal");
    if (!el) return;

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
  }

  /* ---------- Footer year ---------- */

  function initYear() {
    var el = document.getElementById("year");
    if (el) el.textContent = new Date().getFullYear();
  }

  document.addEventListener("DOMContentLoaded", function () {
    initLang();
    initReveal();
    initAccordion();
    initMobileNav();
    initPhotoReveal();
    initYear();
  });
})();
