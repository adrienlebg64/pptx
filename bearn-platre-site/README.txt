BÉARN PLÂTRE — SITE VITRINE (version refaite)
=============================================

Téléphone : 06 30 39 21 57
Formulaire (test) : mondeilhadrien@gmail.com

Ouvrir index.html dans le navigateur.


CE QUI A CHANGÉ
---------------
- Direction artistique « planche technique » : au lieu de cadres « photo à venir »,
  le site est illustré par de vrais dessins de plaquiste (vue éclatée d'un doublage
  isolé, coupes de cloison, de plafond et de rampant), dessinés pour le site.
- Logo : monogramme avec la silhouette du Pic du Midi d'Ossau et un trait rouge.
  À remplacer par le vrai logo s'il existe.
- Typographie : police Archivo, hébergée sur le site (pas de Google Fonts, donc
  aucune donnée envoyée à un tiers).
- Plan de situation de la Vallée d'Ossau (Arudy → Laruns, Pic du Midi d'Ossau),
  avec courbes de niveau.
- Pied de page avec la ligne de crête des Pyrénées.
- Section « Comment se passe votre chantier » (4 étapes).
- Fiche entreprise (activité, création, adresse, SIRET) : du concret, pas de
  chiffres inventés.
- Formulaire refait : choix du type de travaux et neuf/rénovation en un clic,
  envoi sans quitter la page, message de confirmation, anti-spam (champ piège),
  bouton « répondre » direct à l'e-mail du client.
- Mobile : menu plein écran et barre fixe « Appeler / Demander un devis ».
- Référencement : balises de partage (image assets/partage.png), données
  structurées « entreprise locale » pour Google, favicon, icône iPhone.
- Mentions légales remises en page ; les champs à remplir sont surlignés en jaune.

Contraintes d'origine respectées : bleu / rouge / blanc, pas de fausse photo,
pas de chiffre ni d'argument inventé, responsive téléphone et ordinateur.


TEXTES À FAIRE VALIDER PAR BÉARN PLÂTRE
---------------------------------------
J'ai rendu les textes plus concrets. Ces points sont à confirmer :
- Prestations : « bandes et joints », « habillages », « plafonds suspendus /
  faux-plafonds », « combles & rampants », « planchers ».
- Étapes du chantier : visite sur place si besoin, devis détaillé, point de fin
  de chantier.
- Zone : Asté-Béon, Laruns, Bielle, Louvie-Juzon, Arudy (de Laruns à Arudy).
- Mentions légales : la phrase « ni vendues ni cédées à des tiers ».


AVANT LA MISE EN LIGNE
----------------------
1. Mentions légales : compléter forme juridique, directeur de publication,
   hébergeur, responsable du traitement et durée de conservation
   (tout ce qui est surligné en jaune).
2. E-mail du formulaire : dans index.html, remplacer
   mondeilhadrien@gmail.com (attribut action du <form>) par l'adresse définitive.
   Au premier envoi, FormSubmit envoie un e-mail d'activation à cette adresse :
   il faut cliquer le lien une fois.
   Le formulaire ne marche qu'une fois le site en ligne, pas en ouvrant le fichier
   en local.
3. Image de partage : dans index.html, remplacer content="assets/partage.png" par
   l'adresse complète (ex. https://www.votre-domaine.fr/assets/partage.png),
   sinon Facebook/WhatsApp n'afficheront pas l'aperçu.
4. Photos de chantier : voir ci-dessous.


AJOUTER LES PHOTOS DE CHANTIER
------------------------------
La section « Réalisations » est déjà prête dans index.html, mais masquée.
1. Créer le dossier assets/photos/ et y mettre les photos
   (format paysage 4:3, environ 1600 px de large, en .jpg).
2. Dans index.html, chercher id="realisations", adapter les noms de fichiers,
   les textes alt et les légendes.
3. Supprimer le mot « hidden » sur la balise <section id="realisations" ...>.
4. Optionnel : ajouter <a href="#realisations">Réalisations</a> dans le menu.


FICHIERS
--------
index.html              page d'accueil
mentions-legales.html   mentions légales
assets/style.css        mise en page (couleurs en haut du fichier)
assets/script.js        menu mobile, formulaire
assets/fonts/           police Archivo (licence libre OFL, fichier joint)
assets/favicon.svg      icône d'onglet
assets/apple-touch-icon.png
assets/partage.png      image d'aperçu pour les réseaux sociaux (1200 x 630)
