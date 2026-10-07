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
      art.setAttribute("viewBox", mq.matches ? "-40 8 436 380" : "4 8 520 356");
    };
    onMediaChange(mq, frame);
    frame();
  }

  var calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---------- Dessin d'accueil en relief : les couches suivent la souris et s'écartent au défilement ----------
  if (art && !calm && window.requestAnimationFrame) {
    var hero = document.querySelector(".hero");
    var DEPTH = [-3, 1, 5, 9];        // décalage de chaque couche selon la souris (fond -> devant)
    var ISO = [-0.866, 0.5];          // direction « vers le visiteur » dans le dessin isométrique
    var layers = [1, 2, 3, 4].map(function (n) {
      return { n: n, g: art.querySelector(".l" + n + " .px"), layer: art.querySelector(".l" + n), lift: 0 };
    });
    var callouts = Array.prototype.map.call(art.querySelectorAll(".callout"), function (c) {
      return {
        el: c, n: +c.getAttribute("data-layer"),
        ax: +c.getAttribute("data-ax"), ay: +c.getAttribute("data-ay"),
        lx: +c.getAttribute("data-lx"), ly: +c.getAttribute("data-ly"),
        dot: c.querySelector(".dot"), leader: c.querySelector(".leader")
      };
    });
    var legendItems = Array.prototype.slice.call(document.querySelectorAll(".legend li[data-layer]"));
    var goal = { mx: 0, my: 0, hover: 0, scroll: 0, hot: 0 };
    var now = { mx: 0, my: 0, spread: 0 };
    var running = false;

    var tick = function () {
      var k = 0.12, moving = false;
      var spreadGoal = Math.max(goal.hover, goal.scroll);
      [["mx", goal.mx], ["my", goal.my], ["spread", spreadGoal]].forEach(function (p) {
        var d = p[1] - now[p[0]];
        if (Math.abs(d) > 0.002) { now[p[0]] += d * k; moving = true; } else now[p[0]] = p[1];
      });
      layers.forEach(function (L, i) {
        var liftGoal = goal.hot === L.n ? 1 : 0;
        var d = liftGoal - L.lift;
        if (Math.abs(d) > 0.002) { L.lift += d * 0.18; moving = true; } else L.lift = liftGoal;
        var out = now.spread * i * 9 + L.lift * 12;
        L.x = now.mx * DEPTH[i] + out * ISO[0];
        L.y = now.my * DEPTH[i] * 0.6 + out * ISO[1];
        L.g.setAttribute("transform", "translate(" + L.x.toFixed(2) + " " + L.y.toFixed(2) + ")");
      });
      callouts.forEach(function (c) {
        var L = layers[c.n - 1];
        c.dot.setAttribute("transform", "translate(" + L.x.toFixed(2) + " " + L.y.toFixed(2) + ")");
        c.leader.setAttribute("d", "M" + (c.ax + L.x).toFixed(1) + "," + (c.ay + L.y).toFixed(1) + " L" + c.lx + "," + c.ly);
      });
      running = moving;
      if (moving) requestAnimationFrame(tick);
    };
    var wake = function () { if (!running) { running = true; requestAnimationFrame(tick); } };

    var setHot = function (n) {
      goal.hot = n;
      art.classList.toggle("has-hot", n > 0);
      layers.forEach(function (L) { L.layer.classList.toggle("is-hot", L.n === n); });
      callouts.forEach(function (c) { c.el.classList.toggle("is-hot", c.n === n); });
      legendItems.forEach(function (li) { li.classList.toggle("is-hot", +li.getAttribute("data-layer") === n); });
      wake();
    };

    // souris (ordinateur)
    if (window.matchMedia("(hover: hover) and (pointer: fine)").matches && hero) {
      hero.addEventListener("pointermove", function (e) {
        var r = art.getBoundingClientRect();
        goal.mx = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / (r.width / 2)));
        goal.my = Math.max(-1, Math.min(1, (e.clientY - (r.top + r.height / 2)) / (r.height / 2)));
        goal.hover = 0.55;
        wake();
      });
      hero.addEventListener("pointerleave", function () { goal.mx = goal.my = goal.hover = 0; wake(); });
    }
    // survol d'un repère ou d'une couche : la couche ressort, les autres s'effacent
    // (souris uniquement : au doigt, le navigateur simule des survols qui brouilleraient l'effet)
    var mouseOnly = function (fn) { return function (e) { if (e.pointerType === "mouse") fn(); }; };
    var lastPointer = "";
    art.addEventListener("pointerdown", function (e) { lastPointer = e.pointerType; });
    callouts.forEach(function (c) {
      c.el.addEventListener("pointerenter", mouseOnly(function () { setHot(c.n); }));
      c.el.addEventListener("pointerleave", mouseOnly(function () { setHot(0); }));
      // au doigt ou au stylet, un appui allume / éteint ; à la souris, le survol suffit
      c.el.addEventListener("click", function () { if (lastPointer !== "mouse") setHot(goal.hot === c.n ? 0 : c.n); });
    });
    // zones de survol fixes : la couche peut ressortir sans quitter le curseur (pas de clignotement)
    Array.prototype.forEach.call(art.querySelectorAll(".layer-hit"), function (hit) {
      var n = +hit.getAttribute("data-layer");
      hit.addEventListener("pointerenter", mouseOnly(function () { setHot(n); }));
      hit.addEventListener("pointerleave", mouseOnly(function () { setHot(0); }));
    });
    // légende (téléphone) : un appui met la couche en avant, un second l'efface
    legendItems.forEach(function (li) {
      li.addEventListener("click", function () {
        var n = +li.getAttribute("data-layer");
        setHot(goal.hot === n ? 0 : n);
      });
    });
    // défilement : le mur « s'ouvre » quand on descend
    var onHeroScroll = function () {
      var s = Math.max(0, Math.min(1, window.scrollY / 420));
      if (Math.abs(s * 1.3 - goal.scroll) > 0.001) { goal.scroll = s * 1.3; wake(); }
    };
    window.addEventListener("scroll", onHeroScroll, { passive: true });
    onHeroScroll();
  }

  // ---------- Déroulement : chaque scène s'anime en arrivant à l'écran ----------
  var stepItems = document.querySelectorAll(".steps li");
  if ("IntersectionObserver" in window) {
    var stepIo = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) { entry.target.classList.add("is-in"); stepIo.unobserve(entry.target); }
      });
    }, { threshold: 0.35 });
    stepItems.forEach(function (li) { stepIo.observe(li); });
  } else {
    stepItems.forEach(function (li) { li.classList.add("is-in"); });
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
    iframe.title = "Carte Google Maps : Béarn Plâtre, Aste-Béon";
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
    var lbIndex = 0;

    var showShot = function (i) {
      lbIndex = (i + shots.length) % shots.length;
      var a = shots[lbIndex];
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
    box.querySelector(".lb-prev").addEventListener("click", function () { showShot(lbIndex - 1); });
    box.querySelector(".lb-next").addEventListener("click", function () { showShot(lbIndex + 1); });
    box.addEventListener("click", function (e) { if (e.target === box) box.close(); });
    box.addEventListener("keydown", function (e) {
      if (e.key === "ArrowLeft") showShot(lbIndex - 1);
      if (e.key === "ArrowRight") showShot(lbIndex + 1);
    });
    var lbPrev = box.querySelector(".lb-prev");
    var lbNext = box.querySelector(".lb-next");
    if (shots.length < 2) { lbPrev.hidden = true; lbNext.hidden = true; }
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

  // Étapes : sans JavaScript, tout le formulaire s'affiche d'un bloc
  var steps = Array.prototype.slice.call(form.querySelectorAll(".wiz-step"));
  var marks = Array.prototype.slice.call(form.querySelectorAll(".wiz-progress li"));
  var wizPrev = form.querySelector(".wiz-prev");
  var wizNext = form.querySelector(".wiz-next");
  var stepError = form.querySelector("#wiz-error-1");
  var recap = form.querySelector(".wiz-recap");
  var stepIndex = 0;

  function values(name) {
    return Array.prototype.map.call(form.querySelectorAll('[name="' + name + '"]:checked'), function (i) { return i.value; });
  }
  function fillRecap() {
    if (!recap) return;
    var bits = [values("Travaux").join(", "), values("Chantier")[0], values("Surface")[0], values("Délai")[0],
      (form.querySelector('[name="Commune"]').value || "").trim()].filter(Boolean);
    recap.querySelector(".wiz-recap-text").textContent = bits.join(" · ");
    recap.hidden = !bits.length;
  }
  function goTo(i, focus) {
    stepIndex = Math.max(0, Math.min(steps.length - 1, i));
    steps.forEach(function (s, k) { s.classList.toggle("is-active", k === stepIndex); });
    marks.forEach(function (m, k) {
      m.classList.toggle("is-stepIndex", k === stepIndex);
      m.classList.toggle("is-done", k < stepIndex);
    });
    if (wizPrev) wizPrev.hidden = stepIndex === 0;
    if (wizNext) wizNext.hidden = stepIndex === steps.length - 1;
    if (stepIndex === steps.length - 1) fillRecap();
    if (focus) {
      var top = form.getBoundingClientRect().top;
      if (top < 0 || top > window.innerHeight * 0.6) form.scrollIntoView({ behavior: calm ? "instant" : "smooth", block: "start" });
      steps[stepIndex].querySelector(".wiz-legend").focus({ preventScroll: true });
    }
  }
  function stepIsValid(i) {
    if (i === 0) {
      var ok = values("Travaux").length > 0;
      if (stepError) stepError.hidden = ok;
      if (!ok) {
        steps[0].querySelector("input").focus({ preventScroll: true });
        if (stepError) stepError.scrollIntoView({ behavior: calm ? "instant" : "smooth", block: "center" });
      }
      return ok;
    }
    var fields = steps[i].querySelectorAll("input, textarea, select");
    for (var k = 0; k < fields.length; k++) {
      if (!fields[k].checkValidity()) { fields[k].reportValidity(); return false; }
    }
    return true;
  }
  if (steps.length && wizNext) {
    wizNext.addEventListener("click", function () { if (stepIsValid(stepIndex)) goTo(stepIndex + 1, true); });
    wizPrev.addEventListener("click", function () { goTo(stepIndex - 1, true); });
    form.querySelectorAll('[name="Travaux"]').forEach(function (box) {
      box.addEventListener("change", function () { if (stepError && values("Travaux").length) stepError.hidden = true; });
    });
    // Entrée dans un champ avant la dernière étape : passer à l'étape suivante
    // (le navigateur n'envoie pas le formulaire quand le bouton « Envoyer » est caché)
    form.addEventListener("keydown", function (e) {
      var tag = e.target.tagName;
      if (e.key !== "Enter" || tag === "TEXTAREA" || tag === "BUTTON" || tag === "A") return;
      if (stepIndex < steps.length - 1) {
        e.preventDefault();
        if (stepIsValid(stepIndex)) goTo(stepIndex + 1, true);
      }
    });
    var edit = form.querySelector(".wiz-edit");
    if (edit) edit.addEventListener("click", function () { goTo(0, true); });
    goTo(0, false);
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();

    // Touche Entrée avant la dernière étape : on passe simplement à l'étape suivante
    if (steps.length && wizNext && stepIndex < steps.length - 1) {
      if (stepIsValid(stepIndex)) goTo(stepIndex + 1, true);
      return;
    }
    if (!form.checkValidity()) {
      var bad = form.querySelector(":invalid:not(fieldset)");
      var owner = bad ? steps.indexOf(bad.closest(".wiz-step")) : -1;
      if (owner > -1 && owner !== stepIndex) goTo(owner, false);
      if (bad) bad.reportValidity(); else form.reportValidity();
      return;
    }

    // Envoi déjà en cours (double appui sur Entrée ou sur le bouton)
    if (button.getAttribute("aria-busy") === "true") return;

    // Piège à robots : champ invisible rempli = envoi ignoré
    if (form.querySelector('[name="_honey"]').value) return;

    var data = new FormData(form);
    var travaux = data.getAll("Travaux");
    data.delete("Travaux");
    data.set("Travaux", travaux.length ? travaux.join(", ") : "Non précisé");
    ["Chantier", "Surface", "Délai"].forEach(function (k) { if (!data.get(k)) data.set(k, "Non précisé"); });
    data.set("_replyto", data.get("email"));
    var commune = (data.get("Commune") || "").trim();
    data.set("_subject", "Devis " + (commune || "commune non précisée") + " : " + data.get("Travaux"));

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
        if (steps.length && wizNext) goTo(0, false);
        show("ok", "Merci, votre demande est bien envoyée.",
          "Nous vous recontactons dès que possible. Pour une question urgente : " + phone + ".");
      })
      .catch(function () {
        show("error", "L'envoi n'a pas abouti.",
          "Merci de réessayer dans un instant, ou d'appeler directement le " + phone + ".");
      })
      .then(function () {
        button.removeAttribute("aria-busy");
        status.setAttribute("tabindex", "-1");
        status.focus({ preventScroll: true });
        status.scrollIntoView({ behavior: calm ? "instant" : "smooth", block: "center" });
      });
  });
})();
