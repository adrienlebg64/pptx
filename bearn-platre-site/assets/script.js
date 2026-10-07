/* Béarn Plâtre — interactions (menu, en-tête, formulaire) */
(function () {
  "use strict";

  // Année du pied de page
  document.querySelectorAll("[data-year]").forEach(function (el) {
    el.textContent = new Date().getFullYear();
  });

  // MediaQueryList.addEventListener n'existe pas avant Safari 14
  function onMediaChange(mq, fn) {
    if (mq.addEventListener) mq.addEventListener("change", fn);
    else if (mq.addListener) mq.addListener(fn);
  }

  // ---------- Menu mobile ----------
  var toggle = document.querySelector(".menu-toggle");
  var nav = document.getElementById("main-nav");

  function setMenu(open) {
    if (!toggle || !nav) return;
    toggle.setAttribute("aria-expanded", String(open));
    nav.classList.toggle("is-open", open);
    document.documentElement.classList.toggle("menu-open", open);
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
    onMediaChange(window.matchMedia("(min-width: 961px)"), function () { setMenu(false); });
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
        if (!entry.isIntersecting) return;
        // Section sans lien dans le menu (accueil, déroulement) : rien n'est souligné
        links.forEach(function (l) { l.removeAttribute("aria-current"); });
        var link = byId[entry.target.id];
        if (link) link.setAttribute("aria-current", "true");
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    document.querySelectorAll("main > section").forEach(function (section) {
      io.observe(section);
    });
  }

  // ---------- Illustration : cadrage resserré sur mobile ----------
  var art = document.getElementById("hero-art");
  if (art) {
    var mq = window.matchMedia("(max-width: 720px)");
    var frame = function () {
      art.setAttribute("viewBox", mq.matches ? "4 8 392 356" : "4 8 520 356");
    };
    onMediaChange(mq, frame);
    frame();
  }

  // ---------- Cookies : la carte Google Maps n'est chargée qu'avec l'accord du visiteur ----------
  var CONSENT_KEY = "bp-consent";
  var CONSENT_DAYS = 182; // environ 6 mois, durée recommandée par la CNIL
  var sessionChoice = null; // si le navigateur bloque le stockage, le choix vaut pour la visite

  function readConsent() {
    try {
      var c = JSON.parse(localStorage.getItem(CONSENT_KEY));
      var age = c ? Date.now() - c.t : -1;
      if (c && typeof c.maps === "boolean" && age >= 0 && age < CONSENT_DAYS * 864e5) return c.maps;
    } catch (e) {}
    return sessionChoice;
  }
  function saveConsent(maps) {
    sessionChoice = maps;
    try { localStorage.setItem(CONSENT_KEY, JSON.stringify({ maps: maps, t: Date.now() })); } catch (e) {}
  }

  var mapFrame = document.getElementById("map");
  var mapWaiting = mapFrame ? mapFrame.innerHTML : "";

  function bindMapButton() {
    var btn = mapFrame && mapFrame.querySelector("[data-map-load]");
    if (btn) btn.addEventListener("click", function (e) { e.preventDefault(); setConsent(true); });
  }
  function showMap() {
    if (!mapFrame || mapFrame.querySelector("iframe")) return;
    var iframe = document.createElement("iframe");
    iframe.src = mapFrame.getAttribute("data-src");
    iframe.title = "Carte Google Maps : Béarn Plâtre, Asté-Béon";
    iframe.loading = "lazy";
    iframe.referrerPolicy = "no-referrer-when-downgrade";
    iframe.allowFullscreen = true;
    mapFrame.innerHTML = "";
    mapFrame.appendChild(iframe);
  }
  function hideMap() {
    if (!mapFrame || !mapFrame.querySelector("iframe")) return;
    mapFrame.innerHTML = mapWaiting;
    bindMapButton();
  }

  // Annonce discrète pour les lecteurs d'écran
  var live = document.createElement("p");
  live.className = "visually-hidden";
  live.setAttribute("role", "status");
  document.body.appendChild(live);

  var banner = null;
  var opener = null; // élément qui a rouvert le bandeau, pour y rendre le focus

  function reserveSpace() {
    // laisse de la place en bas de page pour que le pied de page ne reste pas caché sous le bandeau
    var open = banner && !banner.hidden;
    document.documentElement.classList.toggle("cookie-open", !!open);
    document.documentElement.style.setProperty("--cookie-h", open ? banner.offsetHeight + "px" : "0px");
  }
  function openBanner(focus) {
    if (!banner) {
      banner = document.createElement("div");
      banner.className = "cookie-banner";
      banner.setAttribute("role", "region");
      banner.setAttribute("aria-labelledby", "cookie-title");
      banner.innerHTML =
        '<h2 class="cookie-title" id="cookie-title">Cookies</h2>' +
        "<p>La carte de la rubrique « Secteur » est fournie par Google Maps, qui dépose des cookies. " +
        'Acceptez-vous ces cookies ? <a href="mentions-legales.html#cookies">En savoir plus</a></p>' +
        '<div class="cookie-actions">' +
        '<button class="btn" type="button" data-consent="false">Refuser</button>' +
        '<button class="btn" type="button" data-consent="true">Accepter</button>' +
        "</div>";
      banner.querySelectorAll("[data-consent]").forEach(function (b) {
        b.addEventListener("click", function () { setConsent(b.getAttribute("data-consent") === "true"); });
      });
      // en tête du document (juste après le lien d'évitement) : atteint en premier au clavier
      var skip = document.querySelector(".skip");
      document.body.insertBefore(banner, skip ? skip.nextSibling : document.body.firstChild);
      window.addEventListener("resize", reserveSpace);
    }
    banner.hidden = false;
    reserveSpace();
    if (focus) {
      opener = document.activeElement;
      banner.querySelector("button").focus();
    }
  }
  function closeBanner() {
    if (!banner || banner.hidden) return;
    var hadFocus = banner.contains(document.activeElement);
    banner.hidden = true;
    reserveSpace();
    if (hadFocus) {
      var target = opener && document.contains(opener) ? opener : document.getElementById("contenu");
      if (target === document.getElementById("contenu")) target.setAttribute("tabindex", "-1");
      if (target) target.focus({ preventScroll: true });
    }
    opener = null;
  }
  function applyConsent() {
    var c = readConsent();
    if (c === true) showMap(); else hideMap();
    if (c === null && mapFrame) openBanner(false);
    else if (c !== null) closeBanner();
  }
  function setConsent(maps) {
    saveConsent(maps);
    if (maps) showMap(); else hideMap();
    closeBanner();
    live.textContent = maps ? "Choix enregistré : carte Google Maps acceptée." : "Choix enregistré : carte Google Maps refusée.";
  }

  bindMapButton();
  applyConsent();
  document.querySelectorAll("[data-consent-open]").forEach(function (el) {
    el.addEventListener("click", function (e) { e.preventDefault(); openBanner(true); });
  });
  // Choix modifié sur une autre page puis retour arrière (cache du navigateur), ou dans un autre onglet
  window.addEventListener("pageshow", function (e) { if (e.persisted) applyConsent(); });
  window.addEventListener("storage", function (e) { if (e.key === CONSENT_KEY || e.key === null) applyConsent(); });

  // ---------- Réalisations : visionneuse plein écran ----------
  var shots = Array.prototype.slice.call(document.querySelectorAll(".gallery .shot a"));
  if (shots.length && typeof HTMLDialogElement === "function") {
    var box = document.createElement("dialog");
    box.className = "lightbox";
    box.setAttribute("aria-label", "Photo de chantier");
    box.innerHTML =
      '<img alt=""><p></p>' +
      '<button class="lb-btn lb-close" type="button" aria-label="Fermer">×</button>' +
      '<button class="lb-btn lb-prev" type="button" aria-label="Photo précédente">‹</button>' +
      '<button class="lb-btn lb-next" type="button" aria-label="Photo suivante">›</button>';
    document.body.appendChild(box);
    var boxImg = box.querySelector("img");
    var boxText = box.querySelector("p");
    var current = 0;

    var showShot = function (i) {
      current = (i + shots.length) % shots.length;
      var a = shots[current];
      var img = a.querySelector("img");
      var cap = a.parentNode.querySelector("figcaption");
      boxImg.src = a.getAttribute("href");
      boxImg.alt = img ? img.alt : "";
      boxText.innerHTML = cap ? cap.innerHTML.replace("</b>", "</b> · ") : "";
    };

    shots.forEach(function (a, i) {
      a.addEventListener("click", function (e) {
        e.preventDefault();
        showShot(i);
        box.showModal();
      });
    });
    box.querySelector(".lb-close").addEventListener("click", function () { box.close(); });
    box.querySelector(".lb-prev").addEventListener("click", function () { showShot(current - 1); });
    box.querySelector(".lb-next").addEventListener("click", function () { showShot(current + 1); });
    box.addEventListener("click", function (e) { if (e.target === box) box.close(); });
    box.addEventListener("keydown", function (e) {
      if (e.key === "ArrowLeft") showShot(current - 1);
      if (e.key === "ArrowRight") showShot(current + 1);
    });
    var prevBtn = box.querySelector(".lb-prev");
    var nextBtn = box.querySelector(".lb-next");
    if (shots.length < 2) { prevBtn.hidden = true; nextBtn.hidden = true; }
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
