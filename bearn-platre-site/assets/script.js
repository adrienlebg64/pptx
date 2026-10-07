/* Béarn Plâtre — interactions (menu, en-tête, formulaire) */
(function () {
  "use strict";

  // Année du pied de page
  document.querySelectorAll("[data-year]").forEach(function (el) {
    el.textContent = new Date().getFullYear();
  });

  // ---------- Menu mobile ----------
  var toggle = document.querySelector(".menu-toggle");
  var nav = document.getElementById("main-nav");

  function setMenu(open) {
    if (!toggle || !nav) return;
    toggle.setAttribute("aria-expanded", String(open));
    nav.classList.toggle("is-open", open);
  }

  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      setMenu(toggle.getAttribute("aria-expanded") !== "true");
    });
    nav.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", function () { setMenu(false); });
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") setMenu(false);
    });
    window.matchMedia("(min-width: 961px)").addEventListener("change", function () { setMenu(false); });
  }

  // ---------- En-tête : bordure au défilement ----------
  var header = document.querySelector(".site-header");
  function onScroll() {
    if (header) header.classList.toggle("is-scrolled", window.scrollY > 8);
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  // ---------- Lien actif dans le menu ----------
  var links = nav ? nav.querySelectorAll('a[href^="#"]') : [];
  if ("IntersectionObserver" in window && links.length) {
    var byId = {};
    links.forEach(function (a) { byId[a.getAttribute("href").slice(1)] = a; });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var link = byId[entry.target.id];
        if (!link) return;
        if (entry.isIntersecting) {
          links.forEach(function (l) { l.removeAttribute("aria-current"); });
          link.setAttribute("aria-current", "true");
        }
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    Object.keys(byId).forEach(function (id) {
      var section = document.getElementById(id);
      if (section) io.observe(section);
    });
  }

  // ---------- Illustration : cadrage resserré sur mobile ----------
  var art = document.getElementById("hero-art");
  if (art) {
    var mq = window.matchMedia("(max-width: 720px)");
    var frame = function () {
      art.setAttribute("viewBox", mq.matches ? "4 8 392 356" : "4 8 520 356");
    };
    mq.addEventListener("change", frame);
    frame();
  }

  // ---------- Formulaire de devis (envoi sans quitter la page) ----------
  var form = document.getElementById("devis-form");
  if (!form) return;

  var status = form.querySelector(".form-status");
  var button = form.querySelector('button[type="submit"]');
  var phone = "06 30 39 21 57";

  function show(kind, title, text) {
    status.className = "form-status is-visible" + (kind === "error" ? " is-error" : "");
    status.innerHTML = "<b>" + title + "</b>" + text;
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();

    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    // Piège à robots : champ invisible rempli = envoi ignoré
    if (form.querySelector('[name="_honey"]').value) return;

    var data = new FormData(form);
    var travaux = data.getAll("Travaux");
    data.delete("Travaux");
    data.set("Travaux", travaux.length ? travaux.join(", ") : "Non précisé");
    if (!data.get("Chantier")) data.set("Chantier", "Non précisé");
    data.set("_replyto", data.get("email"));

    button.setAttribute("aria-busy", "true");
    status.className = "form-status";

    fetch(form.action.replace("formsubmit.co/", "formsubmit.co/ajax/"), {
      method: "POST",
      headers: { Accept: "application/json" },
      body: data
    })
      .then(function (res) { return res.json().then(function (json) { return { ok: res.ok, json: json }; }); })
      .then(function (r) {
        if (!r.ok || String(r.json.success) !== "true") throw new Error(r.json.message || "Erreur");
        form.reset();
        show("ok", "Merci, votre demande est bien envoyée.",
          "Nous vous recontactons dès que possible. Pour une question urgente : " + phone + ".");
      })
      .catch(function () {
        show("error", "L'envoi n'a pas abouti.",
          "Merci de réessayer dans un instant, ou d'appeler directement le " + phone + ".");
      })
      .then(function () {
        button.removeAttribute("aria-busy");
        status.scrollIntoView({ behavior: "smooth", block: "nearest" });
      });
  });
})();
