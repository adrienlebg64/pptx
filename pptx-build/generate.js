const pptxgen = require("pptxgenjs");

// ── Palette (from the approved Blue Professional HTML) ──────────────────
const BG = "FDFAE7";
const PRIMARY = "1E2BFA";
const TEXT = "111111";
const TEXT_MUTED = "6B6B6B";
const TEXT_LIGHT = "9A9A9A";

function hex2rgb(h) {
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
function rgb2hex([r, g, b]) {
  return [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("").toUpperCase();
}
function blend(fgHex, bgHex, alphaPct) {
  const fg = hex2rgb(fgHex), bgc = hex2rgb(bgHex), a = alphaPct / 100;
  return rgb2hex(fg.map((c, i) => c * a + bgc[i] * (1 - a)));
}
const CARD_BG = blend(PRIMARY, BG, 5); // ~cobalt-at-4/5%
const BORDER = blend(PRIMARY, BG, 22); // ~cobalt-at-20%
const ACCENT_LIGHT = blend(PRIMARY, BG, 9); // tag pill bg

const FONT = "Arial"; // safe-list substitute for Space Grotesk / Inter (guaranteed metrics)

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE"; // 13.333 x 7.5
const PW = 13.333, PH = 7.5;
const MX = 0.7; // side margin
const CONTENT_W = PW - MX * 2;

pres.defineSlideMaster({
  title: "BASE",
  background: { color: BG },
});

// ── Generic helpers ───────────────────────────────────────────────────
function newSlide() {
  return pres.addSlide({ masterName: "BASE" });
}

function header(slide, eyebrow, tag) {
  const tagW = tag ? 0.16 * tag.length + 0.5 : 0;
  slide.addText(eyebrow.toUpperCase(), {
    x: MX, y: 0.5, w: CONTENT_W - tagW - 0.3, h: 0.35,
    fontFace: FONT, fontSize: 12, bold: true, color: PRIMARY, charSpacing: 1,
    align: "left", valign: "top", margin: 0,
  });
  if (tag) {
    const tw = tagW;
    slide.addShape("roundRect", {
      x: PW - MX - tw, y: 0.46, w: tw, h: 0.36, rectRadius: 0.18,
      fill: { color: ACCENT_LIGHT }, line: { type: "none" },
    });
    slide.addText(tag, {
      x: PW - MX - tw, y: 0.46, w: tw, h: 0.36,
      fontFace: FONT, fontSize: 10.5, bold: true, color: PRIMARY,
      align: "center", valign: "middle", margin: 0,
    });
  }
}

function title(slide, text, opts = {}) {
  slide.addText(text, {
    x: MX, y: 0.95, w: opts.w || CONTENT_W, h: opts.h || 0.85,
    fontFace: FONT, fontSize: opts.fontSize || 27, bold: true, color: TEXT,
    align: "left", valign: "top", margin: 0, lineSpacing: opts.fontSize ? opts.fontSize * 1.08 : 29,
  });
}

function bodyText(slide, text, x, y, w, h, opts = {}) {
  slide.addText(text, {
    x, y, w, h,
    fontFace: FONT, fontSize: opts.fontSize || 13, color: opts.color || TEXT_MUTED,
    align: "left", valign: "top", margin: 0, lineSpacing: opts.lineSpacing || (opts.fontSize ? opts.fontSize * 1.35 : 18),
  });
}

function bulletList(slide, items, x, y, w, h, opts = {}) {
  const fontSize = opts.fontSize || 13;
  const arr = items.map((it, i) => ({
    text: it,
    options: {
      bullet: { code: "2022", indent: 18 },
      breakLine: true,
      color: opts.color || TEXT,
      fontSize,
      fontFace: FONT,
      paraSpaceAfter: opts.gap || 12,
    },
  }));
  slide.addText(arr, { x, y, w, h, valign: "top", margin: 0, lineSpacing: fontSize * 1.3 });
}

function numberedList(slide, items, x, y, w, h, opts = {}) {
  const fontSize = opts.fontSize || 13;
  const gap = opts.gap || 16;
  let cy = y;
  const rowH = opts.rowH || (fontSize / 72) * 1.35 * 2 + gap / 72;
  items.forEach((it, i) => {
    slide.addText(String(i + 1).padStart(2, "0"), {
      x, y: cy, w: 0.5, h: rowH,
      fontFace: FONT, fontSize: fontSize - 1, bold: true, color: PRIMARY, valign: "top", margin: 0,
    });
    slide.addText(it, {
      x: x + 0.55, y: cy, w: w - 0.55, h: rowH,
      fontFace: FONT, fontSize, color: TEXT, valign: "top", margin: 0, lineSpacing: fontSize * 1.3,
    });
    cy += rowH + gap / 72;
  });
  return cy;
}

function simpleStat(slide, x, y, w, h, value, label) {
  slide.addShape("roundRect", {
    x, y, w, h, rectRadius: 0.1,
    fill: { color: CARD_BG }, line: { color: BORDER, width: 1.25 },
  });
  slide.addText(value, {
    x: x + 0.22, y: y + 0.16, w: w - 0.44, h: 0.5,
    fontFace: FONT, fontSize: 26, bold: true, color: PRIMARY, valign: "top", margin: 0,
  });
  slide.addText(label, {
    x: x + 0.22, y: y + 0.74, w: w - 0.44, h: h - 0.9,
    fontFace: FONT, fontSize: 12.5, bold: true, color: TEXT, valign: "top", margin: 0, lineSpacing: 15,
  });
}

function detailBlock(slide, x, y, w, h, blockTitle, bullets, opts = {}) {
  slide.addShape("roundRect", {
    x, y, w, h, rectRadius: 0.09,
    fill: { color: CARD_BG }, line: { color: BORDER, width: 1 },
  });
  slide.addText(blockTitle, {
    x: x + 0.22, y: y + 0.16, w: w - 0.44, h: 0.55,
    fontFace: FONT, fontSize: opts.titleSize || 14, bold: true, color: TEXT, valign: "top", margin: 0, lineSpacing: (opts.titleSize || 14) * 1.15,
  });
  const arr = bullets.map((b) => ({
    text: b,
    options: { bullet: { code: "2022", indent: 14 }, breakLine: true, color: TEXT_MUTED, fontSize: opts.fontSize || 11, fontFace: FONT, paraSpaceAfter: 6 },
  }));
  slide.addText(arr, {
    x: x + 0.22, y: y + 0.74, w: w - 0.44, h: h - 0.9,
    valign: "top", margin: 0, lineSpacing: (opts.fontSize || 11) * 1.28,
  });
}

function dataTable(slide, x, y, w, headers, rows, opts = {}) {
  const colW = opts.colW; // array summing to w
  const rowH = opts.rowH || 0.4;
  const headFS = opts.headFS || 10;
  const bodyFS = opts.bodyFS || 11;
  const headerRow = headers.map((htext, i) => ({
    text: htext.toUpperCase(),
    options: {
      fill: { color: CARD_BG }, color: PRIMARY, bold: true, fontSize: headFS, fontFace: FONT,
      align: opts.align && opts.align[i] === "center" ? "center" : "left",
      valign: "middle", border: [{ type: "solid", color: BORDER, pt: 0.75 }, { type: "solid", color: BORDER, pt: 0.75 }, { type: "solid", color: BORDER, pt: 0.75 }, { type: "solid", color: BORDER, pt: 0.75 }],
    },
  }));
  const bodyRows = rows.map((r, ri) => {
    const highlight = opts.highlightRows && opts.highlightRows.includes(ri);
    return r.map((cell, ci) => ({
      text: cell,
      options: {
        fill: { color: highlight ? blend(PRIMARY, BG, 16) : BG },
        color: TEXT, bold: !!highlight, fontSize: bodyFS, fontFace: FONT,
        align: opts.align && opts.align[ci] === "center" ? "center" : "left",
        valign: "top",
        border: [{ type: "solid", color: BORDER, pt: 0.5 }, { type: "solid", color: BORDER, pt: 0.5 }, { type: "solid", color: BORDER, pt: 0.5 }, { type: "solid", color: BORDER, pt: 0.5 }],
      },
    }));
  });
  slide.addTable([headerRow, ...bodyRows], {
    x, y, w, colW,
    rowH: [rowH * 0.85, ...rows.map(() => rowH)],
    autoPage: false,
  });
}

function stepCircle(slide, cx, cy, d, num, opacity = 1) {
  slide.addShape("ellipse", {
    x: cx - d / 2, y: cy - d / 2, w: d, h: d,
    fill: { color: PRIMARY, transparency: (1 - opacity) * 100 },
    line: { type: "none" },
  });
  slide.addText(String(num), {
    x: cx - d / 2, y: cy - d / 2, w: d, h: d,
    fontFace: FONT, fontSize: 15, bold: true, color: "FFFFFF",
    align: "center", valign: "middle", margin: 0,
  });
}

function connector(slide, x1, y, x2) {
  slide.addShape("line", {
    x: x1, y, w: x2 - x1, h: 0,
    line: { color: BORDER, width: 1.5 },
  });
}

function callout(slide, x, y, w, h, runs) {
  slide.addShape("roundRect", {
    x, y, w, h, rectRadius: 0.09,
    fill: { color: ACCENT_LIGHT }, line: { type: "none" },
  });
  slide.addText(runs, {
    x: x + 0.3, y: y + 0.18, w: w - 0.6, h: h - 0.36,
    valign: "middle", margin: 0, lineSpacing: 20,
  });
}

function decorPanel(slide) {
  // Right-side tinted panel — the cover's visual motif, kept consistent everywhere it appears.
  slide.addShape("rect", {
    x: PW * 0.68, y: 0, w: PW * 0.32, h: PH,
    fill: { color: ACCENT_LIGHT }, line: { type: "none" },
  });
  const dotsX = PW - 2.1, dotsY = PH - 2.4;
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      slide.addShape("ellipse", {
        x: dotsX + c * 0.22, y: dotsY + r * 0.22, w: 0.07, h: 0.07,
        fill: { color: PRIMARY, transparency: 70 }, line: { type: "none" },
      });
    }
  }
}

function closingCircles(slide) {
  [3.6, 2.55].forEach((r) => {
    slide.addShape("ellipse", {
      x: PW / 2 - r, y: PH / 2 - r + 0.15, w: r * 2, h: r * 2,
      fill: { type: "none" }, line: { color: BORDER, width: 1 },
    });
  });
}

// =========================================================================
// SLIDE 1 — Cover
// =========================================================================
{
  const s = newSlide();
  decorPanel(s);
  s.addText("DIRECTION GÉNÉRALE · COMITÉ DE PILOTAGE (COPIL) SI", {
    x: MX, y: 2.15, w: 8.5, h: 0.4, fontFace: FONT, fontSize: 13, bold: true, color: PRIMARY, charSpacing: 1, margin: 0,
  });
  s.addText("Superviser le portefeuille\nprojets de la DSI", {
    x: MX, y: 2.65, w: 8.3, h: 1.9, fontFace: FONT, fontSize: 42, bold: true, color: TEXT, margin: 0, lineSpacing: 46,
  });
  s.addText(
    "Zoom projet : mise en place de l'authentification forte des utilisateurs internes — CESI École d'Ingénieurs, Projet Expérientiel Collaboratif.",
    { x: MX, y: 4.65, w: 7.6, h: 0.9, fontFace: FONT, fontSize: 15, color: TEXT_MUTED, margin: 0, lineSpacing: 20 }
  );
  s.addText(
    "Cellule PMO — DSI Time'Eats · [Prénom NOM] · [Prénom NOM] · [Prénom NOM]  ·  PMO-TE-COLLAB-2026 · V1.0",
    { x: MX, y: 6.55, w: 8.3, h: 0.4, fontFace: FONT, fontSize: 11, color: TEXT_LIGHT, margin: 0 }
  );
}

// =========================================================================
// SLIDE 2 — Sommaire
// =========================================================================
{
  const s = newSlide();
  header(s, "Sommaire", "Vue d'ensemble");
  title(s, "Ce que ce support présente");
  const items = [
    ["01", "Contexte et mission de la cellule PMO", "Time'Eats, son ambition, et pourquoi une cellule PMO a été créée."],
    ["02", "Définir, prioriser et faire vivre le portefeuille", "Processus commun, référentiel documentaire, grille de priorisation."],
    ["03", "Superviser et conduire le projet sélectionné", "Authentification forte des utilisateurs internes, de bout en bout."],
    ["04", "Clore le projet et capitaliser l'expérience", "Documents de clôture, PV de recette, processus de REX."],
    ["05", "Organisation du groupe et bilan", "Répartition du travail sur les 4 jours, points forts et axes d'amélioration."],
  ];
  const colW = (CONTENT_W - 0.5) / 2;
  const rowH = 1.5;
  const startY = 2.05;
  items.forEach((it, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const x = MX + col * (colW + 0.5);
    const y = startY + row * (rowH + 0.15);
    s.addText(it[0], { x, y, w: 0.7, h: rowH, fontFace: FONT, fontSize: 30, bold: true, color: PRIMARY, valign: "top", margin: 0 });
    s.addText(it[1], { x: x + 0.75, y, w: colW - 0.75, h: 0.55, fontFace: FONT, fontSize: 15, bold: true, color: TEXT, valign: "top", margin: 0, lineSpacing: 18 });
    s.addText(it[2], { x: x + 0.75, y: y + 0.55, w: colW - 0.75, h: 0.7, fontFace: FONT, fontSize: 11.5, color: TEXT_MUTED, valign: "top", margin: 0, lineSpacing: 15 });
    if (row < 2) s.addShape("line", { x, y: y + rowH, w: colW, h: 0, line: { color: BORDER, width: 0.75 } });
  });
}

// =========================================================================
// SLIDE 3 — Contexte
// =========================================================================
{
  const s = newSlide();
  header(s, "01 · Contexte", "Time'Eats");
  title(s, "Time'Eats et la mission confiée à la cellule PMO");
  bodyText(s,
    "Time'Eats vend de la nourriture préparée et lance la livraison à domicile, avec un réseau de traiteurs et de chefs partenaires. Ambition de la Direction : un million de nouveaux clients et dix mille restaurants ou traiteurs partenaires en deux ans, pour devenir un acteur reconnu en France à cinq ans — sans concurrencer directement les grandes plateformes internationales.",
    MX, 2.0, CONTENT_W, 1.1, { fontSize: 13.5 }
  );
  bodyText(s,
    "Pour tenir ce rythme, la DSI doit livrer beaucoup en peu de temps — application web, applications mobiles, CRM, sécurité renforcée. Onze projets sont lancés ou à lancer sur l'année, pilotés par une cellule PMO de cinq chefs de projet tout juste créée. La Direction nous a demandé de structurer le pilotage du portefeuille avant qu'un projet n'échoue faute d'organisation.",
    MX, 3.15, CONTENT_W, 1.3, { fontSize: 13.5 }
  );
  const stats = [["200", "salariés dans l'entreprise"], ["21", "collaborateurs à la DSI"], ["11", "projets dans le portefeuille DSI"], ["25 %", "de part de marché visée à 5 ans"]];
  const gap = 0.3;
  const cw = (CONTENT_W - gap * 3) / 4;
  stats.forEach((st, i) => simpleStat(s, MX + i * (cw + gap), 4.75, cw, 1.75, st[0], st[1]));
}

// =========================================================================
// SLIDE 4 — Divider Partie 1
// =========================================================================
function dividerSlide(kicker, h1, sub) {
  const s = newSlide();
  decorPanel(s);
  s.addText(kicker.toUpperCase(), { x: MX, y: 2.7, w: 8, h: 0.4, fontFace: FONT, fontSize: 13, bold: true, color: PRIMARY, charSpacing: 1, margin: 0 });
  s.addText(h1, { x: MX, y: 3.2, w: 8.2, h: 1.9, fontFace: FONT, fontSize: 34, bold: true, color: TEXT, margin: 0, lineSpacing: 38 });
  s.addText(sub, { x: MX, y: 5.05, w: 7.5, h: 1.0, fontFace: FONT, fontSize: 15, color: TEXT_MUTED, margin: 0, lineSpacing: 20 });
  return s;
}
dividerSlide(
  "Partie 1 · 01",
  "Définir, prioriser et faire vivre le portefeuille de projets",
  "Harmoniser le processus de management, bâtir un référentiel documentaire commun, et prioriser objectivement les 11 projets du portefeuille DSI."
);

// =========================================================================
// SLIDE 5 — Cycle 6 phases + méthodes
// =========================================================================
{
  const s = newSlide();
  header(s, "Partie 1 · 1.1", "Processus");
  title(s, "Harmoniser le processus de management des projets", { fontSize: 23, h: 0.6 });
  bodyText(s,
    "Avant la cellule PMO, chaque chef de projet gérait son projet à sa manière. Nous retenons une trame commune, construite à partir de trois référentiels reconnus, adaptée à la taille des projets de Time'Eats plutôt qu'appliquée à la lettre.",
    MX, 1.85, CONTENT_W, 0.75, { fontSize: 13 }
  );
  s.addText("FIGURE 1 — CYCLE DE VIE COMMUN EN 6 PHASES", {
    x: MX, y: 2.65, w: 8, h: 0.3, fontFace: FONT, fontSize: 11, bold: true, color: PRIMARY, charSpacing: 0.8, margin: 0,
  });
  const phases = ["Cadrage & lancement", "Conception / paramétrage", "Réalisation", "Recette", "Déploiement", "Clôture & stabilisation"];
  const n = phases.length;
  const rowY = 3.55, d = 0.62;
  const usableW = CONTENT_W;
  const cellW = usableW / n;
  phases.forEach((p, i) => {
    const cx = MX + cellW * i + cellW / 2;
    stepCircle(s, cx, rowY, d, i + 1, 1 - i * 0.03);
    if (i < n - 1) connector(s, cx + d / 2 + 0.08, rowY, MX + cellW * (i + 1) + cellW / 2 - d / 2 - 0.08);
    s.addText(p, {
      x: MX + cellW * i, y: rowY + d / 2 + 0.14, w: cellW, h: 0.55,
      fontFace: FONT, fontSize: 11.5, bold: true, color: TEXT, align: "center", valign: "top", margin: 0, lineSpacing: 13,
    });
  });
  const methods = [
    ["PMI (PMBOK)", "Sert d'ossature : découpage en phases et rubriques du plan de management (charte, budget, planning, risques)."],
    ["PRINCE2", "Inspire la gouvernance : un comité valide chaque jalon avant de passer à la phase suivante (logique de « Go / No-Go »)."],
    ["Agile (Scrum)", "S'applique pendant la réalisation des projets applicatifs (CRM, applis mobiles, refonte web), par sprints courts."],
  ];
  const mGap = 0.3, mW = (CONTENT_W - mGap * 2) / 3, mY = 4.85, mH = 1.85;
  methods.forEach((m, i) => detailBlock(s, MX + i * (mW + mGap), mY, mW, mH, m[0], [m[1]], { fontSize: 12.5, titleSize: 15 }));
}

// =========================================================================
// SLIDE 6 — Référentiel documentaire (2 tables)
// =========================================================================
{
  const s = newSlide();
  header(s, "Partie 1 · 1.2", "Référentiel");
  title(s, "Le référentiel documentaire commun", { fontSize: 24, h: 0.6 });
  bodyText(s, "Dix documents types couvrent l'ensemble du cycle de vie d'un projet IT, du cadrage à la capitalisation.", MX, 1.8, CONTENT_W, 0.4, { fontSize: 13 });
  const colGap = 0.4, colW = (CONTENT_W - colGap) / 2;
  s.addText("TABLEAU 1 — SOCLE DE CADRAGE", { x: MX, y: 2.35, w: colW, h: 0.3, fontFace: FONT, fontSize: 10.5, bold: true, color: PRIMARY, margin: 0 });
  dataTable(s, MX, 2.68, colW, ["Document", "Objectif", "Moment"],
    [
      ["Charte de projet", "Formaliser l'accord de lancement", "Cadrage"],
      ["Cahier des charges", "Détailler les exigences à respecter", "Cadrage / conception"],
      ["Budget prévisionnel", "Décomposer et justifier l'enveloppe", "Lancement, mis à jour à chaque jalon"],
      ["Planning prévisionnel", "Séquencer phases et jalons", "Lancement, suivi hebdomadaire"],
      ["Registre des risques", "Identifier, coter, traiter les risques", "Tout au long du projet"],
    ],
    { colW: [colW * 0.28, colW * 0.42, colW * 0.30], rowH: 0.62, bodyFS: 10.5 }
  );
  const x2 = MX + colW + colGap;
  s.addText("TABLEAU 2 — PILOTAGE ET CLÔTURE", { x: x2, y: 2.35, w: colW, h: 0.3, fontFace: FONT, fontSize: 10.5, bold: true, color: PRIMARY, margin: 0 });
  dataTable(s, x2, 2.68, colW, ["Document", "Objectif", "Moment"],
    [
      ["Plan de communication", "Organiser messages, canaux, fréquences", "Lancement, utilisé en continu"],
      ["Tableau de bord de suivi", "Piloter avancement, budget, qualité", "En continu"],
      ["Procès-verbal de recette", "Acter la conformité des livrables", "Clôture / mise en production"],
      ["Document de clôture", "Bilan administratif, contractuel, technique", "Clôture"],
      ["Fiche de capitalisation (REX)", "Consigner les enseignements", "Clôture"],
    ],
    { colW: [colW * 0.30, colW * 0.42, colW * 0.28], rowH: 0.62, bodyFS: 10.5 }
  );
  bodyText(s,
    "Les cinq premiers documents forment le socle minimal pour lancer tout projet DSI ; les cinq suivants accompagnent le pilotage et la clôture.",
    MX, 6.75, CONTENT_W, 0.4, { fontSize: 11.5 }
  );
}

// =========================================================================
// SLIDE 7 — Rubriques clés de 3 documents pivots
// =========================================================================
{
  const s = newSlide();
  header(s, "Partie 1 · 1.2", "Documents pivots");
  title(s, "Rubriques clés de trois documents pivots", { fontSize: 25, h: 0.6 });
  bodyText(s, "Le formalisme complet de chaque document est laissé au chef de projet ; trois documents structurent tout le reste et méritent d'être détaillés.", MX, 1.8, CONTENT_W, 0.55, { fontSize: 13.5 });
  const blocks = [
    ["1 · Charte de projet (1 page)", ["Objectif et périmètre", "Sponsor et chef de projet", "Budget et planning cadres", "Critères de succès"]],
    ["2 · Cahier des charges (7 rubriques)", ["Contexte et objectifs", "Exigences fonctionnelles / non fonctionnelles", "Contraintes et interfaces", "Livrables attendus", "Critères d'acceptation — Annexes"]],
    ["3 · Registre des risques", ["Identifiant et catégorie", "Probabilité × impact = criticité", "Stratégie de traitement", "Plan d'action et responsable"]],
  ];
  const gap = 0.3, w = (CONTENT_W - gap * 2) / 3, y = 2.55, h = 3.55;
  blocks.forEach((b, i) => detailBlock(s, MX + i * (w + gap), y, w, h, b[0], b[1], { fontSize: 13, titleSize: 15 }));
  bodyText(s, "Ce référentiel commun facilite aussi l'arrivée d'un nouveau chef de projet dans la cellule PMO.", MX, y + h + 0.25, CONTENT_W, 0.4, { fontSize: 12 });
}

// =========================================================================
// SLIDE 8 — Critères de priorisation
// =========================================================================
{
  const s = newSlide();
  header(s, "Partie 1 · 1.3", "Priorisation");
  title(s, "Le tableau de bord de supervision du portefeuille", { fontSize: 22, h: 0.55 });
  bodyText(s, "La priorisation suit la stratégie de l'entreprise plutôt que des impressions personnelles. Cinq axes en découlent :", MX, 1.75, CONTENT_W, 0.45, { fontSize: 13 });
  const leftW = CONTENT_W * 0.34, rightX = MX + leftW + 0.4, rightW = CONTENT_W - leftW - 0.4;
  numberedList(
    s,
    ["Conquérir de nouveaux clients", "Construire un socle technique fiable", "Limiter les risques, garder l'activité en marche", "Respecter la réglementation", "Maîtriser les coûts, donner de la visibilité à la Direction"],
    MX, 2.4, leftW, 4.0, { fontSize: 13.5, gap: 20, rowH: 0.62 }
  );
  s.addText("TABLEAU 3 — CRITÈRES DE PRIORISATION ET COTATION", { x: rightX, y: 2.3, w: rightW, h: 0.3, fontFace: FONT, fontSize: 10.5, bold: true, color: PRIMARY, margin: 0 });
  dataTable(s, rightX, 2.63, rightW, ["Critère", "Ce qu'il mesure", "Échelle"],
    [
      ["Nécessité stratégique", "Importance pour la stratégie Time'Eats", "1 à 5 — un projet réglementaire est toujours coté 5"],
      ["Rentabilité attendue", "Nouveaux clients, CA, économies", "1 (faible) à 5 (fort)"],
      ["Maîtrise des risques", "Confiance de l'équipe dans le projet", "1 (mal maîtrisés) à 5 (bien maîtrisés)"],
    ],
    { colW: [rightW * 0.24, rightW * 0.35, rightW * 0.41], rowH: 0.72, bodyFS: 10.5 }
  );
  callout(s, rightX, 4.95, rightW, 1.65, [
    { text: "Score = Nécessité + Rentabilité + Maîtrise des risques", options: { bold: true, color: PRIMARY, fontFace: FONT, fontSize: 12.5, breakLine: true } },
    { text: " (sur 15). P1 — Engagé (≥ 12) · P2 — Important (9-11) · P3 — À surveiller (≤ 8).", options: { color: TEXT, fontFace: FONT, fontSize: 12.5, breakLine: true } },
    { text: "Exception : un projet réglementaire reste engagé quel que soit son score.", options: { italic: true, color: TEXT_MUTED, fontFace: FONT, fontSize: 11 } },
  ]);
}

// =========================================================================
// SLIDE 9 — Application aux 11 projets
// =========================================================================
{
  const s = newSlide();
  header(s, "Partie 1 · 1.3", "Portefeuille");
  title(s, "Application de la grille aux 11 projets du portefeuille", { fontSize: 22, h: 0.55 });
  s.addText("TABLEAU 4 — CLASSEMENT DES 11 PROJETS DU PORTEFEUILLE", { x: MX, y: 1.75, w: CONTENT_W, h: 0.3, fontFace: FONT, fontSize: 10.5, bold: true, color: PRIMARY, margin: 0 });
  const rows = [
    ["1=", "Application mobile clients", "5", "5", "3", "13", "P1"],
    ["1=", "Sauvegarde Cloud", "5", "3", "5", "13", "P1"],
    ["3=", "Mise en place d'un CRM", "5", "3", "4", "12", "P1"],
    ["3=", "Application mobile fournisseurs", "5", "5", "2", "12", "P1"],
    ["3=", "Refonte de l'application web", "5", "5", "2", "12", "P1"],
    ["3=", "Authentification forte des utilisateurs internes", "5", "3", "4", "12", "P1"],
    ["7=", "MAJ réglementaire des outils de paie *", "5", "1", "4", "10", "P2"],
    ["7=", "Stockage / gestion des fichiers", "4", "3", "3", "10", "P2"],
    ["9=", "Mise en place d'Office 365", "4", "2", "3", "9", "P2"],
    ["9=", "Plateforme de livraison continue", "3", "3", "3", "9", "P2"],
    ["11", "Migration MS Azure des applications métiers", "3", "4", "1", "8", "P3"],
  ];
  dataTable(s, MX, 2.1, CONTENT_W, ["Rang", "Projet", "Néc.", "Rent.", "M.R.", "Score /15", "Priorité"], rows, {
    colW: [0.7, CONTENT_W - 0.7 - 0.9 * 4 - 1.0, 0.9, 0.9, 0.9, 1.0, 0.9],
    rowH: 0.34, bodyFS: 10.5, headFS: 9.5,
    align: ["center", "left", "center", "center", "center", "center", "center"],
    highlightRows: [5],
  });
  bodyText(s,
    "* Projet réglementaire : engagé quel que soit son score. L'authentification forte (juillet) et la sauvegarde Cloud (octobre) ne se chevauchent pas dans le temps. Elle se classe en Priorité 1 (rang 3 sur 11), ce qui confirme la pertinence du projet imposé pour cet exercice.",
    MX, 6.05, CONTENT_W, 0.75, { fontSize: 11 }
  );
}

// =========================================================================
// SLIDE 10 — Divider Partie 2
// =========================================================================
dividerSlide(
  "Partie 2 · 02",
  "Superviser et conduire le projet sélectionné",
  "Authentification forte des utilisateurs internes — de la charte de projet au tableau de bord de suivi."
);

// =========================================================================
// SLIDE 11 — Fiche d'identité
// =========================================================================
{
  const s = newSlide();
  header(s, "Partie 2 · Présentation", "Fiche projet");
  title(s, "Authentification forte des utilisateurs internes", { fontSize: 25, h: 0.6 });
  bodyText(s,
    "Intégrer une solution d'authentification multi-facteurs (MFA) pour renforcer la sécurité des accès aux applications internes et tierces de Time'Eats, et protéger les données sensibles. Le projet concerne l'ensemble des collaborateurs, tous sites confondus.",
    MX, 1.85, CONTENT_W, 0.85, { fontSize: 13.5 }
  );
  const stats = [["150 k€", "Budget prévisionnel"], ["4 mois", "Juillet → Octobre N"], ["120 j/h", "Charge de travail estimée"], ["12/15 — P1", "Score et priorité (rang 3/11)"]];
  const gap = 0.3, cw = (CONTENT_W - gap * 3) / 4;
  stats.forEach((st, i) => simpleStat(s, MX + i * (cw + gap), 2.85, cw, 1.55, st[0], st[1]));
  s.addText("POURQUOI CE PROJET A ÉTÉ RETENU", { x: MX, y: 4.75, w: CONTENT_W, h: 0.3, fontFace: FONT, fontSize: 11.5, bold: true, color: PRIMARY, margin: 0 });
  bodyText(s,
    "Le sujet impose ce projet à tous les groupes pour cet exercice — mais il se classe aussi en Priorité 1 du portefeuille (Partie 1.3), avec un profil proche du CRM. Sécuriser les accès est une base à poser avant la montée en puissance du CRM et des applications mobiles.",
    MX, 5.1, CONTENT_W, 1.3, { fontSize: 13.5 }
  );
}

// =========================================================================
// SLIDE 12 — Charte + CDC
// =========================================================================
{
  const s = newSlide();
  header(s, "Partie 2 · 2.1 Plan de management (1/3)", "Charte & CDC");
  title(s, "Charte de projet et cahier des charges", { fontSize: 24, h: 0.55 });
  s.addText(
    "Les consignes excluent un plan de management complet pour ce projet : nous détaillons l'intérêt de chaque rubrique, sans détailler chaque champ.",
    { x: MX, y: 1.75, w: CONTENT_W, h: 0.45, fontFace: FONT, fontSize: 12, italic: true, color: TEXT_MUTED, margin: 0, lineSpacing: 16 }
  );
  const gap = 0.4, w = (CONTENT_W - gap) / 2, y = 2.35, h = 4.15;
  detailBlock(s, MX, y, w, h, "Charte de projet", [
    "Objectif — Sécuriser l'accès aux applications internes et tierces par une authentification à plusieurs facteurs",
    "Périmètre — Tous les collaborateurs Time'Eats, tous sites (Rennes, Morlaix, Concarneau, bureaux régionaux)",
    "Cadre budget / délai — 150 k€ — 4 mois (juillet à octobre N)",
    "Sponsor — Directeur des Systèmes d'Information (RSSI)",
    "Critère de succès — MFA actif sur 100 % des comptes à risque fin octobre, sans interruption de service majeure",
  ], { fontSize: 12.5, titleSize: 16 });
  detailBlock(s, MX + w + gap, y, w, h, "Cahier des charges", [
    "Exigences fonctionnelles — Au moins 2 méthodes MFA au choix, auto-inscription guidée, SSO avec l'AD existant",
    "Exigences non fonctionnelles — Disponibilité ≥ 99,5 %, compatibilité avec les applications tierces, accessible à tous les profils",
    "Livrables attendus — Solution MFA déployée, guide utilisateur, procédure de support",
    "Critères d'acceptation — Base du plan de test — voir Partie 3 (clôture)",
  ], { fontSize: 12.5, titleSize: 16 });
}

// =========================================================================
// SLIDE 13 — Budget + Planning
// =========================================================================
{
  const s = newSlide();
  header(s, "Partie 2 · 2.1 Plan de management (2/3)", "Budget & planning");
  title(s, "Budget prévisionnel et planning", { fontSize: 24, h: 0.55 });
  const colGap = 0.4, colW = (CONTENT_W - colGap) / 2;
  s.addText("TABLEAU 5 — BUDGET PRÉVISIONNEL (150 K€)", { x: MX, y: 1.9, w: colW, h: 0.3, fontFace: FONT, fontSize: 10.5, bold: true, color: PRIMARY, margin: 0 });
  dataTable(s, MX, 2.23, colW, ["Poste de dépense", "Montant", "Commentaire"],
    [
      ["Solution MFA (licences)", "40 k€", "Pour l'ensemble des collaborateurs"],
      ["Intégration (prestation ESN)", "55 k€", "Interfaçage AD + applications tierces"],
      ["Ressources internes", "25 k€", "Équipe infrastructure mobilisée"],
      ["Formation & communication", "15 k€", "Supports, sessions, renfort helpdesk"],
      ["Provision pour aléas", "15 k€", "Couvre le registre des risques"],
      ["Total", "150 k€", "Validé dans la charte de projet"],
    ],
    { colW: [colW * 0.38, colW * 0.18, colW * 0.44], rowH: 0.52, bodyFS: 10.5, highlightRows: [5] }
  );
  const x2 = MX + colW + colGap;
  s.addText("TABLEAU 6 — PLANNING PRÉVISIONNEL (JUILLET–OCTOBRE N)", { x: x2, y: 1.9, w: colW, h: 0.3, fontFace: FONT, fontSize: 10.5, bold: true, color: PRIMARY, margin: 0 });
  dataTable(s, x2, 2.23, colW, ["Phase", "Période", "Jalon"],
    [
      ["Cadrage & lancement", "Juillet (S1-S2)", "Charte validée"],
      ["Choix solution & conception", "Juillet (S3-S4)", "Dossier de conception validé"],
      ["Paramétrage & intégration", "Août – mi-sept.", "Intégration AD terminée"],
      ["Pilote (site de Rennes)", "Mi-septembre", "Retour du pilote, ajustements"],
      ["Déploiement généralisé", "Fin sept. – mi-oct.", "Bascule de tous les sites"],
      ["Recette & clôture", "Fin octobre", "PV de recette signé"],
    ],
    { colW: [colW * 0.40, colW * 0.26, colW * 0.34], rowH: 0.52, bodyFS: 10.5 }
  );
  bodyText(s,
    "Intégration technique confiée à un prestataire ; formation portée en interne, là où l'équipe connaît mieux le contexte de Time'Eats.",
    MX, 5.95, CONTENT_W, 0.5, { fontSize: 12 }
  );
}

// =========================================================================
// SLIDE 14 — Registre des risques
// =========================================================================
{
  const s = newSlide();
  header(s, "Partie 2 · 2.1 Plan de management (3/3)", "Registre des risques");
  title(s, "Registre des risques du projet", { fontSize: 25, h: 0.55 });
  bodyText(s, "Probabilité × impact = criticité (échelle 1 à 5). Le registre est ouvert au lancement et mis à jour à chaque comité de pilotage.", MX, 1.78, CONTENT_W, 0.4, { fontSize: 12.5 });
  s.addText("TABLEAU 7 — REGISTRE DES RISQUES DU PROJET AUTHENTIFICATION FORTE", { x: MX, y: 2.25, w: CONTENT_W, h: 0.3, fontFace: FONT, fontSize: 10.5, bold: true, color: PRIMARY, margin: 0 });
  const rows = [
    ["R-01", "Résistance au changement chez les utilisateurs les moins à l'aise avec le numérique", "Organisationnel", "4", "3", "12", "Communication anticipée et relais de proximité sur chaque site"],
    ["R-02", "Perte du moyen d'authentification, accès bloqué", "Humain", "3", "4", "12", "Codes de secours et procédure de récupération encadrée par le support"],
    ["R-03", "Dépendance au prestataire pour l'intégration technique", "Fournisseur", "2", "4", "8", "Clause de réversibilité et documentation technique exigées au contrat"],
    ["R-04", "Applications tierces incompatibles avec le protocole retenu", "Technique", "3", "3", "9", "Audit de compatibilité dès le cadrage, plan de contournement si besoin"],
    ["R-05", "Interruption d'accès pendant la bascule d'un site", "Technique", "2", "5", "10", "Bascule progressive, fenêtre annoncée, support renforcé le jour J"],
  ];
  dataTable(s, MX, 2.58, CONTENT_W, ["ID", "Risque", "Catégorie", "P", "I", "Crit.", "Plan d'action"], rows, {
    colW: [0.6, CONTENT_W * 0.28, 1.15, 0.5, 0.5, 0.6, CONTENT_W - 0.6 - CONTENT_W * 0.28 - 1.15 - 0.5 - 0.5 - 0.6],
    rowH: 0.72, bodyFS: 10.5,
    align: ["center", "left", "left", "center", "center", "center", "left"],
  });
  bodyText(s, "R-01 et R-02 sont les plus critiques (score 12) : ils touchent directement l'expérience des utilisateurs, cible principale du plan de communication.", MX, 6.6, CONTENT_W, 0.5, { fontSize: 11.5 });
}

// =========================================================================
// SLIDE 15 — Plan de communication
// =========================================================================
{
  const s = newSlide();
  header(s, "Partie 2 · Plan de management", "Communication");
  title(s, "Plan de communication du projet", { fontSize: 25, h: 0.55 });
  bodyText(s, "L'intensité de la communication augmente à l'approche de chaque bascule de site, pour limiter le risque R-01 (résistance au changement).", MX, 1.78, CONTENT_W, 0.4, { fontSize: 11.5 });
  s.addText("TABLEAU 8 — PLAN DE COMMUNICATION DU PROJET", { x: MX, y: 2.25, w: CONTENT_W, h: 0.3, fontFace: FONT, fontSize: 10.5, bold: true, color: PRIMARY, margin: 0 });
  const rows = [
    ["Direction / RSSI", "Rendre compte de l'avancement et des risques", "Avancement, budget, arbitrages nécessaires", "Comité de pilotage", "Mensuel"],
    ["Managers de site", "Préparer et relayer le déploiement", "Calendrier de bascule, actions attendues", "Réunion + email", "Toutes les 2 semaines"],
    ["Ensemble des collaborateurs", "Informer, rassurer, accompagner", "Pourquoi ce projet, comment s'inscrire, où trouver de l'aide", "Intranet, affichage, mailing", "Hebdo pendant le déploiement"],
    ["Site pilote (Rennes)", "Tester et remonter les difficultés", "Consignes de test, canal de remontée", "Canal dédié", "Quotidien pendant le pilote"],
  ];
  dataTable(s, MX, 2.58, CONTENT_W, ["Cible", "Objectif", "Message clé", "Canal", "Fréquence"], rows, {
    colW: [1.9, 2.1, 3.3, 1.9, CONTENT_W - 1.9 - 2.1 - 3.3 - 1.9],
    rowH: 0.85, bodyFS: 10.5,
  });
  bodyText(s, "Le canal compte parfois plus que le message : les équipes de production réagissent mieux à un relais de proximité qu'à un simple email.", MX, 6.35, CONTENT_W, 0.5, { fontSize: 11.5 });
}

// =========================================================================
// SLIDE 16 — Tableau de bord de suivi
// =========================================================================
{
  const s = newSlide();
  header(s, "Partie 2 · 2.2", "Suivi");
  title(s, "Tableau de bord de suivi — respect du triangle d'or", { fontSize: 22, h: 0.55 });
  bodyText(s, "Cinq indicateurs, suivis chaque semaine par le chef de projet et présentés en comité de pilotage, couvrent les coûts, les délais et la qualité.", MX, 1.78, CONTENT_W, 0.4, { fontSize: 11 });
  s.addText("TABLEAU 9 — TABLEAU DE BORD DE SUIVI DU PROJET", { x: MX, y: 2.25, w: CONTENT_W, h: 0.3, fontFace: FONT, fontSize: 10.5, bold: true, color: PRIMARY, margin: 0 });
  const rows = [
    ["Avancement planning (délai)", "Jalons atteints à date / jalons prévus à date", "Écart théorique / réel < 10 %", "Hebdomadaire"],
    ["Consommation budgétaire (coût)", "Budget engagé / budget prévisionnel", "Alignée sur l'avancement (± 10 %)", "Hebdomadaire"],
    ["Taux de couverture MFA (qualité)", "Comptes protégés / comptes à protéger", "100 % avant clôture", "Hebdomadaire"],
    ["Taux d'incidents d'accès (qualité)", "Tickets « blocage d'accès » ouverts / semaine", "Décroissant après S2 du déploiement", "Hebdomadaire"],
    ["Complétion des formations (qualité)", "Collaborateurs formés / à former", "100 % avant bascule de chaque site", "Hebdomadaire"],
  ];
  dataTable(s, MX, 2.58, CONTENT_W, ["Indicateur", "Mode de calcul", "Cible", "Fréquence"], rows, {
    colW: [3.1, 3.6, 3.0, CONTENT_W - 3.1 - 3.6 - 3.0],
    rowH: 0.68, bodyFS: 10.5,
  });
  bodyText(s, "Les trois derniers indicateurs traduisent la qualité du déploiement du point de vue de l'utilisateur, plutôt qu'un simple respect du cahier des charges technique.", MX, 6.15, CONTENT_W, 0.6, { fontSize: 11.5 });
}

// =========================================================================
// SLIDE 17 — Divider Partie 3
// =========================================================================
dividerSlide(
  "Partie 3 · 03",
  "Clore le projet",
  "Documents contractuels de clôture et template de procès-verbal de recette, réutilisables pour tout le portefeuille."
);

// =========================================================================
// SLIDE 18 — Documents contractuels de clôture
// =========================================================================
{
  const s = newSlide();
  header(s, "Partie 3 · 3.1", "Clôture");
  title(s, "Documents contractuels de clôture", { fontSize: 25, h: 0.55 });
  bodyText(s, "Il ne s'agit pas de formaliser entièrement chaque document, mais de justifier pourquoi chacun est nécessaire pour clore proprement le projet, en interne comme avec le prestataire.", MX, 1.78, CONTENT_W, 0.55, { fontSize: 12.5 });
  s.addText("TABLEAU 10 — DOCUMENTS CONTRACTUELS DE CLÔTURE", { x: MX, y: 2.5, w: CONTENT_W, h: 0.3, fontFace: FONT, fontSize: 10.5, bold: true, color: PRIMARY, margin: 0 });
  const rows = [
    ["PV de recette", "Interne + prestataire", "Acter que la solution livrée répond au cahier des charges avant la mise en production"],
    ["PV de réception / levée des réserves", "Prestataire (ESN)", "Constater la correction des anomalies relevées en recette et déclencher le solde du paiement"],
    ["Facture soldée", "Prestataire (ESN)", "Justifier la clôture financière du marché auprès de la comptabilité"],
    ["Dossier d'exploitation & documentation technique", "Interne", "Permettre à l'équipe infrastructure de reprendre la solution en exploitation courante"],
    ["Clause de réversibilité / restitution des accès", "Prestataire (ESN)", "Garantir que Time'Eats récupère l'ensemble des accès et paramétrages à la fin du contrat"],
    ["Fiche de clôture de projet", "Interne (PMO)", "Consolider le bilan administratif, budgétaire et technique du projet pour la Direction"],
  ];
  dataTable(s, MX, 2.83, CONTENT_W, ["Document", "Concerne", "Pourquoi il est nécessaire"], rows, {
    colW: [3.4, 1.8, CONTENT_W - 3.4 - 1.8],
    rowH: 0.62, bodyFS: 10.5,
  });
}

// =========================================================================
// SLIDE 19 — Template PV de recette
// =========================================================================
{
  const s = newSlide();
  header(s, "Partie 3 · 3.2", "Clôture");
  title(s, "Template de procès-verbal de recette", { fontSize: 25, h: 0.55 });
  bodyText(s, "Modèle unique, pensé pour être réutilisé par tous les projets du portefeuille DSI, qu'ils soient applicatifs ou d'infrastructure.", MX, 1.78, CONTENT_W, 0.4, { fontSize: 12.5 });
  s.addText("TABLEAU 11 — TEMPLATE DE PV DE RECETTE", { x: MX, y: 2.25, w: CONTENT_W, h: 0.3, fontFace: FONT, fontSize: 10.5, bold: true, color: PRIMARY, margin: 0 });
  const rows = [
    ["Projet", "Nom du projet concerné"],
    ["Date de la recette", "Date de la séance de recette"],
    ["Participants", "Chef de projet, RSSI, référents métier, sponsor"],
    ["Périmètre testé", "Scénarios couverts, référencés au plan de test / cahier des charges"],
    ["Nombre de tests exécutés", "Total exécuté / total prévu"],
    ["Résultats", "Tests conformes / non conformes / avec réserve"],
    ["Anomalies ouvertes à la signature", "Liste, criticité, plan de correction"],
    ["Décision", "Recette prononcée / avec réserves / refusée"],
    ["Signatures", "Chef de projet et sponsor (ou représentant métier mandaté)"],
  ];
  dataTable(s, MX, 2.58, CONTENT_W, ["Champ", "Contenu attendu"], rows, {
    colW: [3.6, CONTENT_W - 3.6], rowH: 0.44, bodyFS: 11,
  });
}

// =========================================================================
// SLIDE 20 — Divider Partie 4
// =========================================================================
dividerSlide(
  "Partie 4 · 04",
  "Capitaliser l'expérience",
  "Quatre outils complémentaires, de la fiche individuelle à la revue de portefeuille trimestrielle."
);

// =========================================================================
// SLIDE 21 — Processus de capitalisation
// =========================================================================
{
  const s = newSlide();
  header(s, "Partie 4 · 4.1", "REX");
  title(s, "Le processus de capitalisation d'expérience", { fontSize: 25, h: 0.6 });
  bodyText(s, "Ces quatre outils se complètent.", MX, 1.85, CONTENT_W, 0.35, { fontSize: 13.5 });
  const steps = [
    ["Fiche de capitalisation (REX)", "Modèle unique, complétée en fin de projet par le chef de projet et challengée par le PMO."],
    ["Rétrospective d'équipe", "Format court « bien fonctionné / à améliorer / actions », animée par le PMO à chaque clôture."],
    ["Base de connaissances centralisée", "Fiches REX, risques clos et documents de clôture archivés, accessibles à tous les chefs de projet."],
    ["Revue de portefeuille trimestrielle", "Le PMO présente à la Direction une synthèse des enseignements et propose une mise à jour du référentiel."],
  ];
  const n = steps.length, rowY = 3.15, d = 0.75, cellW = CONTENT_W / n;
  steps.forEach((st, i) => {
    const cx = MX + cellW * i + cellW / 2;
    stepCircle(s, cx, rowY, d, i + 1, 1 - i * 0.12);
    if (i < n - 1) connector(s, cx + d / 2 + 0.15, rowY, MX + cellW * (i + 1) + cellW / 2 - d / 2 - 0.15);
    s.addText(st[0], { x: MX + cellW * i + 0.15, y: rowY + d / 2 + 0.2, w: cellW - 0.3, h: 0.55, fontFace: FONT, fontSize: 13, bold: true, color: TEXT, align: "center", valign: "top", margin: 0, lineSpacing: 15 });
    s.addText(st[1], { x: MX + cellW * i + 0.15, y: rowY + d / 2 + 0.8, w: cellW - 0.3, h: 1.1, fontFace: FONT, fontSize: 10.5, color: TEXT_MUTED, align: "center", valign: "top", margin: 0, lineSpacing: 13 });
  });
  s.addShape("line", { x: MX, y: 6.35, w: CONTENT_W, h: 0, line: { color: BORDER, width: 0.75, dashType: "dash" } });
  s.addText([
    { text: "↺  ", options: { color: PRIMARY, bold: true, fontSize: 15 } },
    { text: "Met à jour le référentiel documentaire et la grille de priorisation ", options: { color: TEXT_MUTED, fontSize: 12.5 } },
    { text: "(Partie 1)", options: { color: PRIMARY, bold: true, fontSize: 12.5 } },
  ], { x: MX, y: 6.5, w: CONTENT_W, h: 0.4, fontFace: FONT, align: "center", valign: "top", margin: 0 });
}

// =========================================================================
// SLIDE 22 — Fiche de capitalisation
// =========================================================================
{
  const s = newSlide();
  header(s, "Partie 4 · 4.2", "REX");
  title(s, "Fiche de capitalisation — modèle générique", { fontSize: 25, h: 0.6 });
  s.addText("TABLEAU 12 — FICHE DE CAPITALISATION — MODÈLE GÉNÉRIQUE", { x: MX, y: 1.95, w: CONTENT_W, h: 0.3, fontFace: FONT, fontSize: 10.5, bold: true, color: PRIMARY, margin: 0 });
  const rows = [
    ["Projet / Chef de projet", "Identification du projet clos"],
    ["Ce qui a bien fonctionné", "Pratiques, outils ou décisions à reproduire"],
    ["Ce qui peut être amélioré", "Difficultés rencontrées, causes identifiées"],
    ["Enseignement généralisable", "Ce que ce projet apprend aux autres projets du portefeuille"],
    ["Action sur le référentiel / la méthode", "Mise à jour concrète proposée (modèle, processus, critère de priorisation)"],
  ];
  dataTable(s, MX, 2.28, CONTENT_W, ["Champ", "Contenu attendu"], rows, {
    colW: [3.9, CONTENT_W - 3.9], rowH: 0.62, bodyFS: 12,
  });
  bodyText(s, "Cette fiche sera complétée à la clôture réelle du projet Authentification forte, prévue fin octobre N.", MX, 5.7, CONTENT_W, 0.4, { fontSize: 12 });
}

// =========================================================================
// SLIDE 23 — Ce que la Direction retient
// =========================================================================
{
  const s = newSlide();
  header(s, "Conclusion", "Synthèse");
  title(s, "Ce que la Direction retient", { fontSize: 27, h: 0.6 });
  bodyText(s,
    "Ce dossier met en évidence une distinction utile : ce qui a le plus de valeur pour Time'Eats n'est pas toujours ce qui doit être fait en premier. L'authentification forte en est un bon exemple, engagée moins pour sa rentabilité directe que parce qu'elle sécurise la base sur laquelle le CRM et les applications mobiles vont s'appuyer.",
    MX, 1.9, CONTENT_W, 1.0, { fontSize: 13.5 }
  );
  const leftW = CONTENT_W * 0.55, rightX = MX + leftW + 0.4, rightW = CONTENT_W - leftW - 0.4;
  numberedList(s, [
    "Un référentiel documentaire commun et un outil de priorisation objectif pour piloter les 11 projets du portefeuille",
    "Une méthodologie de conduite de projet démontrée sur l'authentification forte, réutilisable pour les projets suivants",
    "Des outils de clôture et de capitalisation qui garantissent que les enseignements d'un projet profitent aux suivants",
  ], MX, 3.15, leftW, 3.5, { fontSize: 13, gap: 22, rowH: 0.75 });
  callout(s, rightX, 3.15, rightW, 1.55, [
    { text: "Demande au COPIL — ", options: { bold: true, color: PRIMARY, fontFace: FONT, fontSize: 13 } },
    { text: "valider l'usage systématique de ce référentiel pour les prochains projets lancés par la DSI.", options: { color: TEXT, fontFace: FONT, fontSize: 13 } },
  ]);
  s.addText(
    "Time'Eats vise un million de nouveaux clients et dix mille partenaires en deux ans : un objectif qui n'est pas tenable si chaque chef de projet continue de gérer son projet à sa façon.",
    { x: rightX, y: 4.95, w: rightW, h: 1.4, fontFace: FONT, fontSize: 12, italic: true, color: TEXT_MUTED, valign: "top", margin: 0, lineSpacing: 16 }
  );
}

// =========================================================================
// SLIDE 24 — Organisation du groupe et bilan
// =========================================================================
{
  const s = newSlide();
  header(s, "Conclusion", "Organisation & bilan");
  title(s, "Organisation du groupe et bilan", { fontSize: 24, h: 0.55 });
  s.addText("ORGANISATION RETENUE SUR LES 4 JOURS DU PROJET COLLABORATIF", { x: MX, y: 1.85, w: CONTENT_W, h: 0.3, fontFace: FONT, fontSize: 11, bold: true, color: PRIMARY, margin: 0 });
  const days = [
    ["J1", "Cadrage du sujet, répartition des rôles, démarrage du référentiel et du tableau de bord de portefeuille"],
    ["J2", "Finalisation de la Partie 1, construction du plan de management du projet (Partie 2)"],
    ["J3", "Tableau de bord projet, documents de clôture, retour d'expérience (Parties 2 à 4)"],
    ["J4", "Préparation et répétition de la soutenance"],
  ];
  const dGap = 0.25, dW = (CONTENT_W - dGap * 3) / 4, dY = 2.25, dH = 1.5;
  days.forEach((d, i) => {
    const x = MX + i * (dW + dGap);
    s.addShape("roundRect", { x, y: dY, w: dW, h: dH, rectRadius: 0.08, fill: { color: CARD_BG }, line: { color: BORDER, width: 1 } });
    s.addText(d[0], { x: x + 0.16, y: dY + 0.13, w: dW - 0.32, h: 0.3, fontFace: FONT, fontSize: 13, bold: true, color: PRIMARY, margin: 0 });
    s.addText(d[1], { x: x + 0.16, y: dY + 0.46, w: dW - 0.32, h: dH - 0.6, fontFace: FONT, fontSize: 10, color: TEXT_MUTED, valign: "top", margin: 0, lineSpacing: 12.5 });
  });
  const gap2 = 0.4, w2 = (CONTENT_W - gap2) / 2, y2 = 4.05, h2 = 1.75;
  detailBlock(s, MX, y2, w2, h2, "Points forts (à personnaliser par le groupe)", [
    "Un référentiel et une méthode de priorisation qui s'appliquent à tout le portefeuille, pas seulement au projet choisi",
    "Une répartition du travail selon les compétences de chacun, avec des points de synchronisation réguliers",
  ], { fontSize: 11.5, titleSize: 13.5 });
  detailBlock(s, MX + w2 + gap2, y2, w2, h2, "Axes d'amélioration (à personnaliser par le groupe)", [
    "Documents contractuels volontairement listés sans être formalisés, comme demandé par les consignes",
    "Tester le tableau de bord de suivi sur un deuxième projet du portefeuille pour vérifier sa robustesse",
  ], { fontSize: 11.5, titleSize: 13.5 });
  s.addText("Cellule PMO — DSI Time'Eats · [Prénom NOM] · [Prénom NOM] · [Prénom NOM] · [Prénom NOM] · [Prénom NOM]", {
    x: MX, y: 6.05, w: CONTENT_W, h: 0.3, fontFace: FONT, fontSize: 11.5, color: TEXT, margin: 0,
  });
  s.addText("⚠ Diapositive à personnaliser impérativement par le groupe : noms des membres, répartition réelle du travail, et bilan sincère de ce qui s'est passé pendant les 4 jours.", {
    x: MX, y: 6.4, w: CONTENT_W, h: 0.5, fontFace: FONT, fontSize: 11, italic: true, color: PRIMARY, margin: 0, lineSpacing: 14,
  });
}

// =========================================================================
// SLIDE 25 — Merci
// =========================================================================
{
  const s = newSlide();
  closingCircles(s);
  s.addShape("rect", { x: PW / 2 - 0.4, y: 2.75, w: 0.8, h: 0.05, fill: { color: PRIMARY }, line: { type: "none" } });
  s.addText("Merci de votre attention", { x: 0, y: 3.0, w: PW, h: 0.85, fontFace: FONT, fontSize: 38, bold: true, color: TEXT, align: "center", margin: 0 });
  s.addText("Place aux questions.", { x: 0, y: 3.9, w: PW, h: 0.5, fontFace: FONT, fontSize: 16, color: TEXT_MUTED, align: "center", margin: 0 });
  s.addText("Cellule PMO — DSI Time'Eats  ·  15 minutes de questions", { x: 0, y: 4.55, w: PW, h: 0.4, fontFace: FONT, fontSize: 11.5, color: TEXT_LIGHT, align: "center", margin: 0 });
}

pres.writeFile({ fileName: "/home/user/pptx/TimeEats_Portefeuille_DSI.pptx" }).then(() => {
  console.log("Done");
});
