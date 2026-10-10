# Générateur de TikTok documentaires

Ce projet génère automatiquement une vidéo verticale (1080×1920, 30 i/s, H.264 + AAC) à partir d'images et d'un script, avec une voix off, des sous-titres animés, de la musique et des effets sonores.

Premier projet livré : **« L'homme qui a survécu aux deux bombes atomiques »** (Tsutomu Yamaguchi).

## Lancement rapide (Windows)

1. Installez **Python 3.10 ou plus récent** (python.org, cochez « Add to PATH »).
2. Installez **FFmpeg** : `winget install Gyan.FFmpeg`. Sans FFmpeg, le script utilise celui d'`imageio-ffmpeg`, sans ffprobe donc avec un contrôle qualité réduit.
3. Double-cliquez sur **`lancer_generation.bat`**. Il crée un environnement virtuel, installe les dépendances et lance la génération.

En ligne de commande :

```bat
python -m pip install -r requirements.txt
python generate.py                 :: production complète
python generate.py --preview       :: images de contrôle seulement (quelques secondes)
python generate.py --fast          :: encodage brouillon rapide
```

## Fichiers produits

| Fichier | Contenu |
|---|---|
| `output/video_finale_tiktok.mp4` | la vidéo finale |
| `output/sous_titres.srt` | les sous-titres (copie dans `subtitles/`) |
| `output/narration.mp3` | la voix off seule, normalisée à −16 LUFS |
| `output/description_tiktok.txt` | la description et les hashtags |
| `output/controle_qualite/` | le rapport ffprobe, la détection d'écrans noirs, les captures et une planche contact |

## Organisation

```
generate.py            orchestration et contrôle qualité
config.json            tout le contenu : textes, images, recadrages, mouvements, sons
engine/tts.py          voix : edge-tts → Piper (sherpa-onnx, hors ligne) → SAPI Windows
engine/timeline.py     durées des scènes calculées sur l'audio réel, alignement des mots
engine/imaging.py      rognage, super-résolution EDSR ×4, harmonisation des couleurs
engine/render.py       caméra virtuelle, parallaxe 2.5D, transitions, flash, sous-titres
engine/sound.py        musique et effets sonores générés par le code, mixage avec ducking
engine/subs.py         groupes de 2 à 4 mots, SRT, rendu des sous-titres
assets/tiktok_scenes/  les images
assets/fonts/          police Inter (licence OFL)
assets/music/          déposez ici une musique dont vous détenez les droits
models/, cache/        téléchargés ou générés automatiquement (ignorés par git)
```

## Créer une nouvelle vidéo sans toucher au code

1. Mettez vos images dans un dossier (elles sont prises dans l'ordre alphabétique).
2. Écrivez le script dans `script.txt` : **un paragraphe par image** (séparés par une ligne vide), une phrase par ligne.
3. Lancez `python generate.py --new script.txt chemin\vers\images --out-config mon_projet.json`.
4. Ajustez `mon_projet.json` si besoin, puis lancez `python generate.py --config mon_projet.json`.

### Champs d'une scène (`config.json → scenes[]`)

- `image` : le fichier image.
- `crop` : les pixels à retirer en haut, en bas, à gauche et à droite (bordures, étiquettes).
- `motion.from` / `motion.to` : `[zoom, x, y]`, avec x et y entre 0 et 1 (centre du cadre). L'interpolation est adoucie au départ et à l'arrivée.
- `parallax` : `{"mode": "ground"}` pour les paysages (le premier plan bouge plus) ou `{"mode": "subject", "focus": [x, y]}` pour un personnage.
- `lines` : `[{"text": …, "pause": secondes}]`. La durée de la scène suit exactement l'audio.
- `lead_in` : un silence avant la première phrase (utile après un flash).
- `flash: true` et `transition_in: "cut"` : coupe franche avec flash et léger tremblement, pour les explosions. `transition_in: "dip"` : fondu par le sombre.
- `mood` : l'ambiance musicale (`calm`, `tension`, `impact`, `silence`, `somber`, `hope`).
- `sfx` : les effets sonores (`city`, `bell`, `explosion`, `rumble`, `boom`, `wind`, `train`, `ring`, `heartbeat`, `riser`), avec `gain_db`, `at` ou `at_end`.
- `burn_subtitles: false` : pas de sous-titres incrustés quand le texte est déjà dans l'image (ils restent dans le SRT).
- `layout: "landscape"` : image horizontale sur fond flouté, sans bandes noires (`fg_scale`, `fg_center_x`).

`pronunciations` corrige la lecture de certains mots (« Tsutomu » est prononcé « Tsoutomou »). Le texte affiché à l'écran reste l'original.

## Voix

Avec `"engine": "auto"`, le script essaie dans l'ordre :

1. **edge-tts** (`fr-FR-HenriNeural`). C'est la meilleure qualité. Il est gratuit, sans clé, mais nécessite Internet.
2. **Piper** `fr_FR-tom-medium` via sherpa-onnx. C'est une voix neuronale hors ligne, téléchargée automatiquement (≈ 65 Mo) depuis GitHub.
3. **SAPI Windows** (pyttsx3), en dernier recours.

Avec edge-tts, la durée change un peu. Vérifiez la ligne « Durée totale calculée » et ajustez au besoin `pause_scale` ou `piper_speed`.

## Musique

Par défaut (`music.mode = "procedural"`), la musique est composée par le code : nappes de cordes, drone et notes de piano en conclusion. Aucun enregistrement tiers n'est utilisé, donc il n'y a aucun problème de droits. Pour utiliser une piste que vous avez le droit d'utiliser, placez-la dans `assets/music/` et indiquez dans la config `"mode": "file", "file": "assets/music/ma_piste.mp3"`.

## Notes sur le contenu historique

- Tsutomu Yamaguchi (1916-2010), ingénieur chez Mitsubishi, était en déplacement à Hiroshima le 6 août 1945, à environ 3 km du point d'explosion. Brûlé, il rentre à Nagasaki et se trouve à son bureau, à environ 3 km du point d'explosion, le 9 août.
- Le gouvernement japonais l'a officiellement reconnu en 2009 comme *nijū hibakusha* (survivant des deux bombardements). Il est le seul à avoir obtenu cette reconnaissance officielle, même si d'autres personnes ont vécu les deux bombardements.
- Il est mort le 4 janvier 2010, à 93 ans.
- Les images sont des **reconstitutions générées par IA**. La vidéo l'indique en surimpression pendant les premières secondes, et la description le précise.
