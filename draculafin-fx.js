/* ==========================================================================
   DraculaFin FX – Mystic Premium Edition
   Einfügen über: Dashboard → Plugins → JavaScript Injector → neues Script

   Was es macht:
   1. POSTERFARBEN: Liest die Farben jedes Posters aus → der Glow hinter
      jeder Karte hat die echten Farben des Films (--posterTop/--posterBottom).
   2. DETAILSEITE: Farben aus Poster/Backdrop auf --detailA/--detailB.
   3. SPOTLIGHT: Lichtfleck auf jeder Karte folgt der Maus (--mx/--my).
   4. STAGGER: Karten erscheinen nacheinander gestaffelt (--stagger).
   5. THREE.JS-HINTERGRUND: funkelnde Partikel, Sternenfeld, Nebelwolken
      und ein langsam strömender Geister-Fluss – ruhig, ohne Rotation.
   6. VIGNETTE: dunkelt die Bildränder kinoreif ab (#draculaVignette).

   Farb-Regel: Es werden ausschließlich offizielle Dracula-Farben benutzt.
   Player-Regel: Am Videoplayer wird nichts verändert. Sobald ein Video
   läuft, pausieren alle Effekte vollständig.
   ========================================================================== */

// IIFE: hält alle Variablen privat, damit nichts mit Jellyfin kollidiert.
(() => {
    'use strict';

    // Schutz gegen doppeltes Laden
    if (window.__draculaFinLoaded) return;
    window.__draculaFinLoaded = true;


    /* ----------------------------------------------------------------------
       KONFIGURATION – hier alles an- und ausschalten
       ---------------------------------------------------------------------- */
    const CONFIG = {
        enablePosterColors: true,
        enableSpotlight: true,
        enableStagger: true,        // gestaffeltes Erscheinen der Karten
        enableVignette: true,       // abgedunkelte Bildränder
        enableThreeBackground: true,
        threeVersion: '0.170.0',
        // Ternärer Operator: kleine Bildschirme bekommen weniger Partikel
        particleCount: window.innerWidth < 800 ? 350 : 800,
        starCount: window.innerWidth < 800 ? 200 : 500,
        maxPixelRatio: 1.5,         // spart GPU auf Retina/4K
        debug: true,                // Konsolen-Meldungen; später auf false
    };

    // && (Kurzschluss): rechte Seite läuft nur, wenn links wahr ist.
    const log = (...messages) => CONFIG.debug && console.info('[DraculaFin]', ...messages);
    const warn = (...messages) => CONFIG.debug && console.warn('[DraculaFin]', ...messages);

    // Offizielle Dracula-Palette (draculatheme.com) – einmal zentral (DRY).
    // hex für Three.js-Materialien, rgb 0–255 für CSS/Analyse, gl 0–1 für Shader.
    const DRACULA = {
        bg:       { hex: '#282a36', rgb: [40, 42, 54],  gl: [40 / 255, 42 / 255, 54 / 255] },
        bgDarker: { hex: '#191a21', rgb: [25, 26, 33],  gl: [25 / 255, 26 / 255, 33 / 255] },
        fg:       { hex: '#f8f8f2', rgb: [248, 248, 242], gl: [248 / 255, 248 / 255, 242 / 255] },
        comment:  { hex: '#6272a4', rgb: [98, 114, 164], gl: [98 / 255, 114 / 255, 164 / 255] },
        cyan:     { hex: '#8be9fd', rgb: [139, 233, 253], gl: [139 / 255, 233 / 255, 253 / 255] },
        green:    { hex: '#50fa7b', rgb: [80, 250, 123], gl: [80 / 255, 250 / 255, 123 / 255] },
        orange:   { hex: '#ffb86c', rgb: [255, 184, 108], gl: [255 / 255, 184 / 255, 108 / 255] },
        pink:     { hex: '#ff79c6', rgb: [255, 121, 198], gl: [255 / 255, 121 / 255, 198 / 255] },
        purple:   { hex: '#bd93f9', rgb: [189, 147, 249], gl: [189 / 255, 147 / 255, 249 / 255] },
        red:      { hex: '#ff5555', rgb: [255, 85, 85],  gl: [255 / 255, 85 / 255, 85 / 255] },
        yellow:   { hex: '#f1fa8c', rgb: [241, 250, 140], gl: [241 / 255, 250 / 255, 140 / 255] },
    };

    // matchMedia prüft eine CSS-Media-Query aus JS heraus
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Zentrale Prüfung: Läuft gerade ein Video? Dann pausiert alles.
    const isPlaybackActive = () => Boolean(document.querySelector('.videoPlayerContainer'));


    /* ======================================================================
       TEIL 1: POSTERFARBEN AUSLESEN
       ====================================================================== */

    // Kleine Leinwand zum Auslesen: 24×36 Pixel reichen für Farbtendenzen
    const SAMPLE_WIDTH = 24;
    const SAMPLE_HEIGHT = 36;
    const sampleCanvas = document.createElement('canvas');
    sampleCanvas.width = SAMPLE_WIDTH;
    sampleCanvas.height = SAMPLE_HEIGHT;
    const sampleContext = sampleCanvas.getContext('2d', { willReadFrequently: true });

    // Map: Bild-URL → Promise mit Farben (gleichzeitige Anfragen rechnen nur einmal)
    const colorCache = new Map();

    // [r, g, b] → "r g b" (passt zur CSS-Syntax rgb(var(--x)))
    const toCssTriplet = ([red, green, blue]) => `${red} ${green} ${blue}`;

    const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

    /**
     * Bild-URL aus einem Element holen: zuerst <img>, sonst background-image.
     */
    function getImageUrl(element) {
        const image = element.querySelector('img');
        const imageSource = image?.currentSrc || image?.src;
        if (imageSource) return imageSource;

        const candidates = [element, ...element.querySelectorAll('.cardImageContainer')];
        for (const candidate of candidates) {
            const background = candidate.style?.backgroundImage ?? '';
            const match = background.match(/url\(["']?(.+?)["']?\)/);
            if (match) return match[1];
        }
        return null;
    }

    function loadImage(url) {
        return new Promise((resolve, reject) => {
            const image = new Image();
            image.crossOrigin = 'anonymous';   // nötig für getImageData
            image.decoding = 'async';
            image.onload = () => resolve(image);
            image.onerror = reject;
            image.src = url;
        });
    }

    /**
     * Macht eine Farbe kräftiger und hell genug, damit sie "leuchtet".
     */
    function intensifyColor([red, green, blue]) {
        const average = (red + green + blue) / 3;
        const SATURATION_BOOST = 1.35;
        let boosted = [red, green, blue].map(channel => average + (channel - average) * SATURATION_BOOST);

        const MIN_BRIGHTNESS = 170;
        const brightest = Math.max(...boosted);
        if (brightest < MIN_BRIGHTNESS && brightest > 0) {
            const factor = MIN_BRIGHTNESS / brightest;
            boosted = boosted.map(channel => channel * factor);
        }
        return boosted.map(channel => Math.round(clamp(channel, 0, 255)));
    }

    /**
     * Findet die "leuchtendste" Farbe in einem Bildbereich.
     * Pixel werden nach Sättigung² gewichtet → kräftige Farben gewinnen.
     */
    function findVividColor(pixelData, startRow, endRow) {
        let redSum = 0, greenSum = 0, blueSum = 0, weightSum = 0;

        for (let row = startRow; row < endRow; row++) {
            for (let column = 0; column < SAMPLE_WIDTH; column++) {
                const index = (row * SAMPLE_WIDTH + column) * 4;
                const red = pixelData[index];
                const green = pixelData[index + 1];
                const blue = pixelData[index + 2];

                const max = Math.max(red, green, blue);
                const min = Math.min(red, green, blue);
                const brightness = max / 255;
                const saturation = max === 0 ? 0 : (max - min) / max;

                if (brightness < 0.15 || brightness > 0.97) continue;

                const weight = saturation * saturation * brightness + 0.02;
                redSum += red * weight;
                greenSum += green * weight;
                blueSum += blue * weight;
                weightSum += weight;
            }
        }

        if (weightSum === 0) return null;
        const averageColor = [redSum / weightSum, greenSum / weightSum, blueSum / weightSum];

        // Fast graues Ergebnis → Dracula-Farbe einspringen lassen
        const MIN_SATURATION = 0.12;
        const maxChannel = Math.max(...averageColor);
        const minChannel = Math.min(...averageColor);
        const resultSaturation = maxChannel === 0 ? 0 : (maxChannel - minChannel) / maxChannel;
        if (resultSaturation < MIN_SATURATION) return null;

        return intensifyColor(averageColor);
    }

    function getPosterColors(url) {
        if (colorCache.has(url)) return colorCache.get(url);

        const colorPromise = loadImage(url)
            .then(image => {
                sampleContext.drawImage(image, 0, 0, SAMPLE_WIDTH, SAMPLE_HEIGHT);
                const { data } = sampleContext.getImageData(0, 0, SAMPLE_WIDTH, SAMPLE_HEIGHT);
                const middleRow = SAMPLE_HEIGHT / 2;

                const topColor = findVividColor(data, 0, middleRow) ?? DRACULA.purple.rgb;
                const bottomColor = findVividColor(data, middleRow, SAMPLE_HEIGHT) ?? topColor;
                return { top: toCssTriplet(topColor), bottom: toCssTriplet(bottomColor) };
            })
            .catch(error => {
                warn('Farben nicht lesbar für', url, error);
                return null;
            });

        colorCache.set(url, colorPromise);
        return colorPromise;
    }

    async function colorizeCard(cardScalable) {
        const url = getImageUrl(cardScalable);
        if (!url || cardScalable.dataset.draculaSrc === url) return;
        cardScalable.dataset.draculaSrc = url;

        const colors = await getPosterColors(url);

        // Jellyfin recycelt Karten beim Scrollen → nur setzen, wenn Bild noch passt
        if (!colors || cardScalable.dataset.draculaSrc !== url) return;
        cardScalable.style.setProperty('--posterTop', colors.top);
        cardScalable.style.setProperty('--posterBottom', colors.bottom);

        coloredCardCount++;
        if (coloredCardCount === 1) log('Erste Karte eingefärbt ✔', colors);
    }

    let coloredCardCount = 0;
    let currentDetailUrl = null;

    async function colorizeDetailPage() {
        const rootStyle = document.documentElement.style;
        const activePage = document.querySelector('#itemDetailPage:not(.hide), .itemDetailPage:not(.hide)');

        if (!activePage) {
            if (currentDetailUrl) {
                rootStyle.removeProperty('--detailA');
                rootStyle.removeProperty('--detailB');
                currentDetailUrl = null;
            }
            return;
        }

        const sourceCandidates = [
            activePage.querySelector('.detailImageContainer'),
            activePage.querySelector('.itemBackdrop'),
            document.querySelector('.itemBackdrop'),
        ].filter(Boolean);
        const source = sourceCandidates.find(candidate => getImageUrl(candidate));
        const url = source ? getImageUrl(source) : null;
        if (!url || url === currentDetailUrl) return;
        currentDetailUrl = url;

        const colors = await getPosterColors(url);
        if (!colors || currentDetailUrl !== url) return;
        rootStyle.setProperty('--detailA', colors.top);
        rootStyle.setProperty('--detailB', colors.bottom);
        log('Detailseite eingefärbt ✔', colors);
    }

    /**
     * Vergibt gestaffelte Verzögerungen (--stagger) pro Zeile, damit Karten
     * nacheinander "materialisieren" statt alle gleichzeitig.
     */
    function staggerCards() {
        const containers = document.querySelectorAll('.itemsContainer, .vertical-list, .scrollSlider');
        containers.forEach(container => {
            const cards = container.querySelectorAll('.card .cardScalable');
            cards.forEach((card, index) => {
                if (card.dataset.staggered === 'true') return;
                card.dataset.staggered = 'true';
                card.style.setProperty('--stagger', index % 12); // pro Dutzend neu
            });
        });
    }

    /* Jellyfin ist eine Single-Page-App: Inhalte werden ständig nachgeladen.
       Der MutationObserver meldet DOM-Änderungen; wir bündeln sie pro Frame. */
    let scanScheduled = false;

    function scheduleScan() {
        if (scanScheduled) return;
        scanScheduled = true;
        requestAnimationFrame(() => {
            scanScheduled = false;
            document.querySelectorAll('.cardScalable').forEach(colorizeCard);
            colorizeDetailPage();
            if (CONFIG.enableStagger && !prefersReducedMotion) staggerCards();
        });
    }

    function startPosterColors() {
        const observer = new MutationObserver(mutations => {
            const isRelevant = mutations.some(mutation =>
                !(mutation.attributeName === 'style' && mutation.target.classList?.contains('cardScalable'))
            );
            if (isRelevant) scheduleScan();
        });

        observer.observe(document.body, {
            subtree: true,
            childList: true,
            attributes: true,
            attributeFilter: ['style', 'src', 'class'],
        });

        window.addEventListener('hashchange', scheduleScan);
        scheduleScan();
    }


    /* ======================================================================
       TEIL 2: SPOTLIGHT – Lichtfleck folgt der Maus (ruhig, ohne Rotation)
       ====================================================================== */
    function startSpotlight() {
        let latestEvent = null;
        let frameRequested = false;

        // Event Delegation: EIN Listener auf document statt einer pro Karte
        document.addEventListener('pointermove', event => {
            latestEvent = event;
            if (frameRequested) return;     // Throttle: max. ein Update pro Frame
            frameRequested = true;

            requestAnimationFrame(() => {
                frameRequested = false;
                const card = latestEvent.target.closest?.('.cardScalable');
                if (!card) return;

                const rect = card.getBoundingClientRect();
                const percentX = ((latestEvent.clientX - rect.left) / rect.width) * 100;
                const percentY = ((latestEvent.clientY - rect.top) / rect.height) * 100;
                card.style.setProperty('--mx', `${percentX.toFixed(1)}%`);
                card.style.setProperty('--my', `${percentY.toFixed(1)}%`);
            });
        }, { passive: true });
    }


    /* ======================================================================
       TEIL 3: VIGNETTE – abgedunkelte Bildränder (Kino-Gefühl)
       ====================================================================== */
    function startVignette() {
        if (document.getElementById('draculaVignette')) return;
        const vignette = document.createElement('div');
        vignette.id = 'draculaVignette';   // Aussehen kommt aus dem CSS
        document.body.appendChild(vignette);
    }


    /* ======================================================================
       TEIL 4: THREE.JS – Partikel, Sterne, Nebel und Geister-Fluss
       Alle Farben kommen ausschließlich aus der Dracula-Palette.
       ====================================================================== */

    /* --- GLSL-Shader ------------------------------------------------------
       Shader = kleine Programme, die direkt auf der Grafikkarte laufen.
       Vertex-Shader: Position/Größe pro Punkt.
       Fragment-Shader: Farbe pro Pixel eines Punkts.
       ---------------------------------------------------------------------- */

    // Hauptpartikel: schweben und funkeln in Dracula-Farben
    const PARTICLE_VERTEX_SHADER = /* glsl */ `
        uniform float uTime;
        uniform float uPixelRatio;
        attribute vec3 aColor;
        attribute float aSize;
        attribute float aPhase;
        varying vec3 vColor;
        varying float vAlpha;

        void main() {
            vec3 drifted = position;
            drifted.y += sin(uTime * 0.15 + aPhase) * 0.6;         // langsames Schweben
            drifted.x += cos(uTime * 0.10 + aPhase * 1.3) * 0.4;

            vec4 viewPosition = modelViewMatrix * vec4(drifted, 1.0);
            gl_Position = projectionMatrix * viewPosition;

            gl_PointSize = aSize * uPixelRatio * (60.0 / -viewPosition.z);

            vColor = aColor;
            vAlpha = 0.55 + 0.45 * sin(uTime * 1.2 + aPhase * 5.0); // Funkeln
        }
    `;

    const PARTICLE_FRAGMENT_SHADER = /* glsl */ `
        varying vec3 vColor;
        varying float vAlpha;

        void main() {
            float distanceToCenter = length(gl_PointCoord - 0.5);
            float glow = pow(1.0 - smoothstep(0.0, 0.5, distanceToCenter), 2.0);
            if (glow < 0.01) discard;
            gl_FragColor = vec4(vColor, glow * vAlpha);
        }
    `;

    // Sterne: winzige Funkel-Punkte in Vordergrundfarbe (Funkeln im Shader)
    const STAR_VERTEX_SHADER = /* glsl */ `
        uniform float uTime;
        uniform float uPixelRatio;
        attribute float aSize;
        attribute float aPhase;
        attribute vec3 aColor;
        varying vec3 vColor;
        varying float vAlpha;

        void main() {
            vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
            gl_Position = projectionMatrix * viewPosition;
            gl_PointSize = aSize * uPixelRatio * (60.0 / -viewPosition.z);

            // Zweifaches Funkeln: schnelles Zwinkern + langsames Atmen
            float twinkle = 0.5 + 0.5 * sin(uTime * 2.5 + aPhase * 8.0);
            float breathe = 0.6 + 0.4 * sin(uTime * 0.4 + aPhase * 2.0);
            vAlpha = twinkle * breathe;
            vColor = aColor;
        }
    `;

    const STAR_FRAGMENT_SHADER = /* glsl */ `
        varying vec3 vColor;
        varying float vAlpha;

        void main() {
            float distanceToCenter = length(gl_PointCoord - 0.5);
            // Harter Kern + weicher Hof → sieht aus wie ein echter Stern
            float core = 1.0 - smoothstep(0.0, 0.18, distanceToCenter);
            float halo = pow(1.0 - smoothstep(0.0, 0.5, distanceToCenter), 3.0) * 0.5;
            float brightness = core + halo;
            if (brightness < 0.01) discard;
            gl_FragColor = vec4(vColor, brightness * vAlpha * 0.85);
        }
    `;

    // Geister-Fluss: langsam strömende Runen/Punkte von rechts nach links
    const DRIFT_VERTEX_SHADER = /* glsl */ `
        uniform float uTime;
        uniform float uPixelRatio;
        attribute vec3 aColor;
        attribute float aSize;
        attribute float aPhase;
        varying vec3 vColor;
        varying float vAlpha;

        void main() {
            vec3 flowed = position;
            // Strömung nach links; mod lässt Partikel rechts wieder eintauchen
            flowed.x = mod(position.x - uTime * (0.35 + aPhase * 0.15) + 22.0, 44.0) - 22.0;
            flowed.y += sin(uTime * 0.5 + aPhase * 6.0) * 0.35;

            vec4 viewPosition = modelViewMatrix * vec4(flowed, 1.0);
            gl_Position = projectionMatrix * viewPosition;
            gl_PointSize = aSize * uPixelRatio * (60.0 / -viewPosition.z);

            // An den Rändern ein-/ausblenden, damit nichts "ploppt"
            float edgeFade = 1.0 - smoothstep(16.0, 22.0, abs(flowed.x));
            vAlpha = edgeFade * (0.35 + 0.30 * sin(uTime * 0.8 + aPhase * 9.0));
            vColor = aColor;
        }
    `;

    const DRIFT_FRAGMENT_SHADER = /* glsl */ `
        varying vec3 vColor;
        varying float vAlpha;

        void main() {
            float distanceToCenter = length(gl_PointCoord - 0.5);
            float glow = pow(1.0 - smoothstep(0.0, 0.5, distanceToCenter), 3.0);
            if (glow < 0.01) discard;
            gl_FragColor = vec4(vColor, glow * vAlpha);
        }
    `;

    /** Weiche, runde Leuchttextur für die Nebelwolken (per 2D-Canvas gemalt) */
    function createGlowTexture(THREE) {
        const size = 256;
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = size;
        const context = canvas.getContext('2d');
        const center = size / 2;
        const gradient = context.createRadialGradient(center, center, 0, center, center, center);
        gradient.addColorStop(0, 'rgba(255,255,255,1)');
        gradient.addColorStop(0.4, 'rgba(255,255,255,0.35)');
        gradient.addColorStop(1, 'rgba(255,255,255,0)');
        context.fillStyle = gradient;
        context.fillRect(0, 0, size, size);
        return new THREE.CanvasTexture(canvas);
    }

    /** Dracula-Farbe nach Gewichtung: Lila häufig, Orange selten */
    function pickParticleColor() {
        const roll = Math.random();
        if (roll < 0.45) return DRACULA.purple.rgb;
        if (roll < 0.75) return DRACULA.pink.rgb;
        if (roll < 0.93) return DRACULA.cyan.rgb;
        return DRACULA.orange.rgb;
    }

    /** Sterne funkeln in Vordergrund-, Zyan- und Gelbtönen (echte Dracula-Farben) */
    function pickStarColor() {
        const roll = Math.random();
        if (roll < 0.55) return DRACULA.fg.rgb;
        if (roll < 0.85) return DRACULA.cyan.rgb;
        return DRACULA.yellow.rgb;
    }

    function createParticles(THREE, pixelRatio) {
        const count = CONFIG.particleCount;
        const positions = new Float32Array(count * 3);
        const colors = new Float32Array(count * 3);
        const sizes = new Float32Array(count);
        const phases = new Float32Array(count);

        for (let i = 0; i < count; i++) {
            const offset = i * 3;
            positions[offset]     = (Math.random() - 0.5) * 40;
            positions[offset + 1] = (Math.random() - 0.5) * 24;
            positions[offset + 2] = Math.random() * -20 + 5;

            const [red, green, blue] = pickParticleColor();
            colors[offset]     = red / 255;
            colors[offset + 1] = green / 255;
            colors[offset + 2] = blue / 255;

            sizes[i] = 0.6 + Math.random() ** 2 * 2.4;
            phases[i] = Math.random() * Math.PI * 2;
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
        geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
        geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));

        const material = new THREE.ShaderMaterial({
            uniforms: {
                uTime: { value: 0 },
                uPixelRatio: { value: pixelRatio },
            },
            vertexShader: PARTICLE_VERTEX_SHADER,
            fragmentShader: PARTICLE_FRAGMENT_SHADER,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,   // Farben addieren sich → Leuchten
        });

        return new THREE.Points(geometry, material);
    }

    function createStars(THREE, pixelRatio) {
        const count = CONFIG.starCount;
        const positions = new Float32Array(count * 3);
        const colors = new Float32Array(count * 3);
        const sizes = new Float32Array(count);
        const phases = new Float32Array(count);

        for (let i = 0; i < count; i++) {
            const offset = i * 3;
            positions[offset]     = (Math.random() - 0.5) * 70;   // breiter gestreut
            positions[offset + 1] = (Math.random() - 0.5) * 40;
            positions[offset + 2] = Math.random() * -25 - 3;      // hinter den Partikeln

            const [red, green, blue] = pickStarColor();
            colors[offset]     = red / 255;
            colors[offset + 1] = green / 255;
            colors[offset + 2] = blue / 255;

            sizes[i] = 0.25 + Math.random() ** 3 * 1.2;           // meist winzig
            phases[i] = Math.random() * Math.PI * 2;
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
        geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
        geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));

        const material = new THREE.ShaderMaterial({
            uniforms: {
                uTime: { value: 0 },
                uPixelRatio: { value: pixelRatio },
            },
            vertexShader: STAR_VERTEX_SHADER,
            fragmentShader: STAR_FRAGMENT_SHADER,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
        });

        return new THREE.Points(geometry, material);
    }

    function createDriftStream(THREE, pixelRatio) {
        const count = Math.round(CONFIG.particleCount * 0.35);
        const positions = new Float32Array(count * 3);
        const colors = new Float32Array(count * 3);
        const sizes = new Float32Array(count);
        const phases = new Float32Array(count);

        for (let i = 0; i < count; i++) {
            const offset = i * 3;
            positions[offset]     = (Math.random() - 0.5) * 44;
            positions[offset + 1] = (Math.random() - 0.5) * 26;
            positions[offset + 2] = Math.random() * -12 - 2;

            // Fluss nur in den "Mystik-Farben" Lila/Pink – dezent
            const [red, green, blue] = Math.random() < 0.6 ? DRACULA.purple.rgb : DRACULA.pink.rgb;
            colors[offset]     = red / 255;
            colors[offset + 1] = green / 255;
            colors[offset + 2] = blue / 255;

            sizes[i] = 0.5 + Math.random() ** 2 * 1.6;
            phases[i] = Math.random();
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
        geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
        geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));

        const material = new THREE.ShaderMaterial({
            uniforms: {
                uTime: { value: 0 },
                uPixelRatio: { value: pixelRatio },
            },
            vertexShader: DRIFT_VERTEX_SHADER,
            fragmentShader: DRIFT_FRAGMENT_SHADER,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
        });

        return new THREE.Points(geometry, material);
    }

    function createNebulae(THREE) {
        const texture = createGlowTexture(THREE);
        // Nur Dracula-Farben, sehr dezent eingesetzt
        const nebulaSettings = [
            { color: DRACULA.purple.hex, position: [-8, 4, -10],  scale: 22, opacity: 0.08 },
            { color: DRACULA.pink.hex,   position: [9, -3, -12],  scale: 26, opacity: 0.07 },
            { color: DRACULA.cyan.hex,   position: [2, 7, -14],   scale: 18, opacity: 0.05 },
            { color: DRACULA.comment.hex, position: [-4, -7, -16], scale: 30, opacity: 0.04 },
        ];

        return nebulaSettings.map(({ color, position, scale, opacity }) => {
            const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
                map: texture,
                color,
                opacity,
                transparent: true,
                depthWrite: false,
                blending: THREE.AdditiveBlending,
            }));
            sprite.position.set(...position);
            sprite.scale.set(scale, scale, 1);
            sprite.userData.baseX = position[0];
            return sprite;
        });
    }

    async function startThreeBackground() {
        let THREE;
        try {
            // Dynamischer import(): lädt Three.js erst bei Bedarf vom CDN
            THREE = await import(`https://cdn.jsdelivr.net/npm/three@${CONFIG.threeVersion}/build/three.module.js`);
        } catch (error) {
            console.warn('[DraculaFin] Three.js konnte nicht geladen werden:', error);
            return;
        }

        const canvas = document.createElement('canvas');
        canvas.id = 'draculaFxCanvas';   // Position/Optik kommen aus dem CSS
        document.body.appendChild(canvas);

        const pixelRatio = Math.min(window.devicePixelRatio, CONFIG.maxPixelRatio);
        const renderer = new THREE.WebGLRenderer({
            canvas,
            alpha: true,                    // CSS-Verlauf scheint durch
            antialias: false,
            powerPreference: 'low-power',
        });
        renderer.setPixelRatio(pixelRatio);
        renderer.setSize(window.innerWidth, window.innerHeight, false);

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
        camera.position.z = 12;

        // Alle vier Ebenen: Sterne (hinten) → Nebel → Partikel → Geister-Fluss
        const stars = createStars(THREE, pixelRatio);
        const nebulae = createNebulae(THREE);
        const particles = createParticles(THREE, pixelRatio);
        const driftStream = createDriftStream(THREE, pixelRatio);
        scene.add(stars, ...nebulae, particles, driftStream);

        // Maus-Parallaxe: Zielposition merken, Kamera gleitet hinterher
        const pointerTarget = { x: 0, y: 0 };
        window.addEventListener('pointermove', event => {
            pointerTarget.x = (event.clientX / window.innerWidth - 0.5) * 2;   // -1 … 1
            pointerTarget.y = (event.clientY / window.innerHeight - 0.5) * 2;
        }, { passive: true });

        const clock = new THREE.Clock();

        function renderFrame() {
            const elapsed = clock.getElapsedTime();

            particles.material.uniforms.uTime.value = elapsed;
            stars.material.uniforms.uTime.value = elapsed;
            driftStream.material.uniforms.uTime.value = elapsed;

            // Sanftes Nachziehen der Kamera (Lerp) – einzige Bewegung der Szene
            const LERP_FACTOR = 0.03;
            camera.position.x += (pointerTarget.x * 1.0 - camera.position.x) * LERP_FACTOR;
            camera.position.y += (-pointerTarget.y * 0.6 - camera.position.y) * LERP_FACTOR;
            camera.lookAt(0, 0, 0);

            // Nebel schweben nur noch sanft hin und her – KEINE Dauer-Rotation mehr
            nebulae.forEach((sprite, index) => {
                sprite.position.x = sprite.userData.baseX + Math.sin(elapsed * 0.05 + index * 2) * 1.5;
            });

            renderer.render(scene, camera);
        }

        window.addEventListener('resize', () => {
            renderer.setSize(window.innerWidth, window.innerHeight, false);
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            if (prefersReducedMotion) renderFrame();
        });

        // Bewegung reduziert → ein einziges Standbild
        if (prefersReducedMotion) {
            renderFrame();
            return;
        }

        // Pausieren, wenn Tab unsichtbar ist ODER ein Video läuft → GPU/Akku
        let isPaused = false;
        let animationFrameId = null;

        function animationLoop() {
            if (isPaused) {
                animationFrameId = null;
                return;
            }
            renderFrame();
            animationFrameId = requestAnimationFrame(animationLoop);
        }

        // Alle 500 ms prüfen statt jeden Frame (querySelector kostet Leistung)
        setInterval(() => {
            isPaused = document.hidden || isPlaybackActive();
            if (!isPaused && animationFrameId === null) animationLoop();
        }, 500);

        animationLoop();
    }


    /* ======================================================================
       START
       ====================================================================== */
    function init() {
        log('Script geladen ✔', { origin: location.origin, config: CONFIG });
        if (CONFIG.enablePosterColors) startPosterColors();
        if (CONFIG.enableSpotlight) startSpotlight();
        if (CONFIG.enableVignette) startVignette();
        if (CONFIG.enableThreeBackground) startThreeBackground();
    }

    // Falls das Script vor dem fertigen HTML läuft: auf DOMContentLoaded warten
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
