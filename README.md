# DraculaFin – Mystic Edition

Ein mystisches, premium-inszeniertes [**Dracula-Theme**](https://draculatheme.com) für **Jellyfin 10.11+**, bestehend aus zwei Teilen:

| Datei | Zweck |
|---|---|
| `draculafin.css` | Das komplette Theme (Farben, Layout, Glass-Effekte, Karten-Glow, Animationen) |
| `draculafin-fx.js` | Optionale Effekt-Ebene (posteradaptive Glow-Farben, 3D-Tilt, Spotlight, Three.js-Hintergrund mit Partikeln, Sternen und Nebeln, Vignette) |

> **Das CSS allein reicht bereits** für das vollständige Theme mit festen Dracula-Farben. Das JS legt die „Mystic Premium“-Ebene darüber.

---

## Features

- 🧛 **100 % offizielle Dracula-Palette** – keine Fremdfarben, alles aus [draculatheme.com](https://draculatheme.com)
- 🌌 **Three.js-Hintergrund** – funkelnde Partikel, Sternenfeld, strömender Geister-Fluss und Nebelwolken in Dracula-Farben mit Maus-Parallaxe
- 🎴 **Posteradaptiver Glow** – das JS liest die dominanten Farben jedes Posters aus und lässt die Karten in den echten Filmfarben leuchten
- 🖱️ **3D-Tilt + Spotlight** – Karten neigen sich räumlich zur Maus, ein Lichtfleck folgt dem Zeiger
- ✨ **Stagger-Animation** – Karten materialisieren sich gestaffelt beim Laden
- 🎬 **Kino-Atmosphäre** – Film-Korn (SVG-Noise), abgedunkelte Ränder (Vignette), atmende Neon-Titel
- 🥂 **Premium-Glassmorphismus** – starke Blur-Effekte, tiefe Schatten, haptisches Button-Feedback
- 📺 **Player bleibt unberührt** – am Videoplayer wird bewusst nichts verändert; alle Effekte pausieren automatisch beim Abspielen
- ♿ **Barrierefreiheit** – respektiert `prefers-reduced-motion`, sichtbare Tastatur-Fokus-Ringe

---

## Setup

### 1. CSS einfügen (Pflicht)

Den Inhalt von **`draculafin.css` komplett** hier einfügen:

```
Dashboard → Allgemein → Eigenes CSS
```

Speichern – das reicht schon für das Theme mit festen Dracula-Farben.

### 2. Plugin-Repository von n00bcodr hinzufügen

Damit das JavaScript geladen werden kann, brauchst du den **JavaScript Injector**:

1. Öffne **Dashboard → Plugins → Repositories**
2. Füge folgende Repository-URL hinzu:

   - **Für Jellyfin 10.11:**
     ```
     https://raw.githubusercontent.com/n00bcodr/jellyfin-plugins/main/10.11/manifest.json
     ```
   - **Für Jellyfin 12:** ersetzt du `10.11` durch `12`:
     ```
     https://raw.githubusercontent.com/n00bcodr/jellyfin-plugins/main/12/manifest.json
     ```

   (Das Repo stammt von [n00bcodr auf GitHub](https://github.com/n00bcodr/jellyfin-plugins).)

### 3. Plugins installieren

1. In **Dashboard → Plugins → Katalog** diese beiden Plugins installieren:
   - **JavaScript Injector**
   - **File Transformation**
2. **Jellyfin neu starten** (Pflicht, sonst tauchen die Plugins nicht auf).

### 4. JavaScript einfügen

1. Öffne **Dashboard → Plugins → JavaScript Injector**
2. Lege ein **neues Script** an
3. Füge den Inhalt von **`draculafin-fx.js`** ein
4. **Speichern**
5. Seite mit **`Strg` + `F5`** (harter Reload, Cache leeren) neu laden

Fertig – die Partikel, Sterne und der posteradaptive Glow sind aktiv. 🦇

---

## Konfiguration (optional)

Am Anfang von `draculafin-fx.js` lässt sich alles einzeln an- und ausschalten:

```js
const CONFIG = {
    enablePosterColors: true,     // Glow in echten Posterfarben
    enableSpotlight: true,        // Lichtfleck folgt der Maus
    enableTilt: true,             // 3D-Neigung der Karten
    enableStagger: true,          // gestaffeltes Erscheinen
    enableVignette: true,         // abgedunkelte Bildränder
    enableThreeBackground: true,  // Three.js-Partikel/Sterne/Nebel
    particleCount: …,             // Anzahl Haupt-Partikel
    starCount: …,                 // Anzahl Sterne
    tiltMaxDeg: 5,                // maximale 3D-Neigung in Grad
    debug: true,                  // Konsolen-Meldungen (live: false)
};
```

Ebenso im CSS zentral steuerbar (Design-Tokens ganz oben in `draculafin.css`):

```css
--ambientIdle: .35;     /* Glow-Stärke im Ruhezustand */
--ambientHover: .95;    /* Glow-Stärke beim Hover */
--ambientBlur: 26px;    /* Glow-Weichzeichnung */
```

---

## Hinweise

- **CORS:** Das Posterfarben-Auslesen funktioniert nur, wenn die Bilder von derselben Adresse kommen wie die Oberfläche (beim normalen Setup gegeben). Klappt es nicht, fallen die Karten automatisch auf die Standard-Dracula-Farben zurück – dann steht ein Hinweis in der Browser-Konsole (`debug: true`).
- **Performance:** Auf Mobilgeräten werden automatisch weniger Partikel erzeugt; `devicePixelRatio` wird auf 1.5 begrenzt. Während der Videowiedergabe oder im Hintergrund-Tab wird das Three.js-Rendering pausiert.
- **Reduzierte Bewegung:** Wer im System „Bewegung reduzieren“ aktiviert hat, bekommt ein statisches Standbild statt Animationen.

---

## Credits

- Farbpalette: [Dracula Theme](https://draculatheme.com) by Zeno Rocha
- Icons: [Jellyfin-Icons](https://github.com/prayag17/Jellyfin-Icons) by prayag17
- Plugins: [jellyfin-plugins](https://github.com/n00bcodr/jellyfin-plugins) by n00bcodr (JavaScript Injector / File Transformation)
- 3D-Engine: [Three.js](https://threejs.org)

## Lizenz

MIT
