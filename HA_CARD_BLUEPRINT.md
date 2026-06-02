# Home Assistant Custom Card — Blueprint & Lessons Learned

Erarbeitet während der Entwicklung der Fensterkarte. Alle kritischen Fallen und deren Lösungen.

---

## 1. Pflichtstruktur eines Custom Cards

```js
window.customCards = window.customCards || [];
window.customCards.push({
  type: 'my-card',
  name: 'My Card',
  description: '...',
  preview: true,
});

class MyCard extends HTMLElement {
  static getConfigElement() {
    return document.createElement('my-card-editor');
  }

  static getStubConfig() {
    // Alle Felder mit sinnvollen Defaults — wird für neue Karten verwendet
    return { entity: '', show_icon: true, ... };
  }

  setConfig(config) {
    // Immer mit getStubConfig() mergen damit alle Felder vorhanden sind
    this._config = { ...MyCard.getStubConfig(), ...config };
    if (this._hass) this.render();
  }

  set hass(hass) {
    this._hass = hass;
    this.render();
  }

  getCardSize() {
    return Number(this._config.grid_options?.rows) || 1;
  }
}
customElements.define('my-card', MyCard);
```

---

## 2. Editor — Die kritischsten Fallen

### 2.1 ⚠️ WICHTIGSTE REGEL: `setConfig()` Methode ist PFLICHT

**Problem:** HA prüft intern `"setConfig" in element`. Wenn die Methode fehlt, überspring HA den Config-Aufruf komplett — der Editor bekommt die gespeicherten Werte NIE.

**Symptom:** Editor zeigt immer leere/Standard-Werte, obwohl die Karte korrekt konfiguriert ist.

```js
class MyCardEditor extends HTMLElement {
  // PFLICHT: HA ruft diese Methode auf, nicht den property setter!
  setConfig(config) {
    if (!config) return;
    this._config = { ...MyCard.getStubConfig(), ...config };
    this._configReceived = true;
    if (!this._hass) return;
    this._render();
  }

  // Zusätzlich: property setter für interne Aufrufe (z.B. Echo-Unterdrückung)
  set config(config) {
    if (!config) return;
    this._config = { ...MyCard.getStubConfig(), ...config };
    this._configReceived = true;
    if (this._suppressConfigUpdate) return; // Echo-Schutz
    if (!this._hass) return;
    this._render();
  }
}
```

### 2.2 Async-Initialisierung von HA

**Problem:** HA setzt `hass` und ruft `setConfig()` asynchron auf — mit `await` dazwischen. Der Render darf deshalb NICHT aus `set hass` heraus ausgelöst werden.

**Falsch:**
```js
set hass(hass) {
  this._hass = hass;
  if (this._forms.length === 0) this._render(); // ❌ Config noch nicht da!
  // Auch Promise.resolve().then() ist zu früh!
}
```

**Richtig:**
```js
constructor() {
  this._configReceived = false; // Flag ob setConfig() schon aufgerufen wurde
}

set hass(hass) {
  const firstHass = !this._hass;
  this._hass = hass;
  // Entity-Picker in existierenden Forms aktuell halten
  for (const { form } of this._forms) form.hass = this._hass;
  // Nur rendern wenn Config schon da (covers config-before-hass Reihenfolge)
  if (firstHass && this._configReceived && this._forms.length === 0) {
    this._render(new Set(['Darstellung']));
  }
}
```

### 2.3 Fokus-Verlust bei Texteingabe verhindern

**Problem:** Jede Änderung dispatcht `config-changed`. HA schickt die Config zurück als Echo. Das setzt `form.data` zurück → Fokus verloren.

**Lösung: Echo unterdrücken mit Flag:**
```js
_applyChange(value, sourceForm = null) {
  // ... config berechnen ...
  this._config = { ...newConfig };

  // Formulare aktualisieren (NICHT das aktive Formular!)
  const data = this._getFormData();
  for (const { form } of this._forms) {
    if (form !== sourceForm) form.data = data;
  }

  // Echo unterdrücken: HA schickt set config() zurück, das ignorieren
  this._suppressConfigUpdate = true;
  this.dispatchEvent(new CustomEvent('config-changed', {
    detail: { config: newConfig }, bubbles: true, composed: true,
  }));
  Promise.resolve().then(() => { this._suppressConfigUpdate = false; });
}
```

### 2.4 Re-Render nur bei echter Änderung (Trigger-Felder)

**Problem:** Trigger-Felder (Booleans die bedingte Felder steuern) müssen den Editor neu rendern. Aber der Vergleich muss gegen den ALTEN Wert gemacht werden — NICHT gegen `this._config` das schon upgedated wurde.

```js
_applyChange(value, sourceForm = null) {
  const { type, ...stored } = this._config; // stored = ALTE config
  const newConfig = { type, ...getStubConfig(), ...stored, ...value };
  this._config = { ...newConfig }; // config updaten

  const triggers = ['duration_enabled', 'pulse_enabled', ...];
  // stored[k] = alter Wert, value[k] = neuer Wert
  const triggerChanged = triggers.some(k => k in value && value[k] !== stored[k]);
  if (triggerChanged) {
    const openPanels = this._getExpandedPanels();
    this._render(openPanels); // Neu rendern mit Panel-Zustand
  } else {
    // Nur form.data aktualisieren (kein Re-Render = kein Fokus-Verlust)
    const data = this._getFormData();
    for (const { form } of this._forms) {
      if (form !== sourceForm) form.data = data;
    }
  }
}
```

### 2.5 Panel-Zustand (Expanded/Collapsed) über Re-Renders erhalten

```js
_getExpandedPanels() {
  const expanded = new Set();
  this.shadowRoot.querySelectorAll('ha-expansion-panel').forEach(p => {
    if (p.expanded) expanded.add(p.header);
  });
  return expanded;
}

_render(expandedPanels = null) {
  const open = expandedPanels ?? this._getExpandedPanels();
  if (open.size === 0) open.add('Darstellung'); // Default: erste Section offen
  
  this._forms = [];
  this.shadowRoot.innerHTML = `<style>...</style>`; // Reset

  // Sections erstellen, panel.expanded = open.has(title) setzen
}
```

### 2.6 ha-form Labels anzeigen

**Problem:** ha-form ignoriert `schema.label` standardmäßig.

```js
form.computeLabel = (schema) => schema.label || schema.name;
```

### 2.7 Config immer mit Defaults mergen

```js
// Im Editor set config / setConfig:
this._config = { ...MyCard.getStubConfig(), ...config };

// In _applyChange:
const newConfig = {
  type: cardType,
  ...MyCard.getStubConfig(), // Defaults zuerst
  ...stored,                  // Aktuelle Config überschreibt Defaults
  ...value,                   // Neue Änderung überschreibt alles
};
```

---

## 3. CSS-Fallen

### 3.1 Klassen-Namen: JS ↔ CSS müssen exakt übereinstimmen

```js
// JS setzt Klasse:
element.classList.add(`my-class-${someValue}`);
// someValue = 'glow_out' → Klasse = 'my-class-glow_out'
```

```css
/* CSS muss exakt gleich sein — Unterstriche NICHT durch Bindestriche ersetzen! */
.my-class-glow_out { animation: ... } /* ✓ */
.my-class-glow-out { animation: ... } /* ❌ matcht nicht! */
```

### 3.2 CSS Custom Properties für animierte Werte

```js
element.style.setProperty('--my-color', primaryColor);
element.style.setProperty('--my-duration', `${duration}s`);
element.classList.add('my-animation-class');
```

```css
.my-animation-class {
  animation: my-keyframe var(--my-duration, 1.5s) ease-in-out infinite;
}
@keyframes my-keyframe {
  0%, 100% { box-shadow: 0 0 10px var(--my-color); }
  50%       { box-shadow: none; }
}
```

---

## 4. ha-form Schema-Referenz

```js
const schema = [
  // Entität
  { name: 'entity', label: 'Entität', required: true, selector: { entity: {} } },
  // Text
  { name: 'name', label: 'Name', selector: { text: {} } },
  // Boolean Toggle
  { name: 'show_icon', label: 'Icon anzeigen', selector: { boolean: {} } },
  // Zahl als Slider
  { name: 'size', label: 'Größe', selector: { number: { min: 16, max: 128, step: 2, mode: 'slider' } } },
  // Zahl als Eingabefeld
  { name: 'threshold', label: 'Schwelle', selector: { number: { min: -50, max: 50, step: 0.5, mode: 'box' } } },
  // Dropdown
  { name: 'position', label: 'Position', selector: { select: { options: [
    { value: 'left', label: 'Links' },
    { value: 'right', label: 'Rechts' },
  ] } } },
  // Farbe (RGB Array [r, g, b])
  { name: 'color', label: 'Farbe', selector: { color_rgb: {} } },
  // Icon-Picker
  { name: 'icon', label: 'Icon', selector: { icon: {} } },
  // Aktion
  { name: 'tap_action', label: 'Aktion', selector: { action: {} } },
];
```

**Bedingte Felder** — Schema bei jedem Render neu berechnen:
```js
const schema = [
  { name: 'feature_enabled', label: 'Feature aktiviert', selector: { boolean: {} } },
];
if (config.feature_enabled) {
  schema.push(
    { name: 'feature_threshold', label: 'Schwelle', selector: { number: { ... } } }
  );
}
```

---

## 5. HACS-Setup

### manifest.json
```json
{
  "name": "My Card",
  "version": "1.0.0",
  "slug": "my-card",
  "description": "...",
  "documentation": "https://github.com/user/my-card",
  "requirements": [],
  "dependencies": [],
  "codeowners": [],
  "zip_release": true,
  "hacs": { "type": "plugin" }
}
```

### hacs.json
```json
{
  "name": "My Card",
  "render_readme": true,
  "filename": "my-card.js",
  "content_in_root": true
}
```

### GitHub Actions Release (.github/workflows/release.yml)
```yaml
name: Create Release Assets
on:
  push:
    tags: ['v*']
jobs:
  build:
    if: startsWith(github.ref, 'refs/tags/')
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v4
      - name: Upload release asset
        uses: softprops/action-gh-release@v1
        with:
          tag_name: ${{ github.ref_name }}
          files: my-card.js
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### Release erstellen
```bash
git add .
git commit -m "feat: neue Version"
git push origin main
git tag v1.0.0
git push origin v1.0.0
# GitHub Actions erstellt den Release automatisch
```

---

## 6. Grid-Optionen statt card_height

```js
// In der Card-Klasse:
static getCardSize() {
  return Number(this._config.grid_options?.rows) || 1;
}
getCardSize() {
  return Number(this._config.grid_options?.rows) || 1;
}

// CSS — wrapper muss height: 100% nutzen:
wrapper.style.height = '100%';
wrapper.style.boxSizing = 'border-box';
```

Der Nutzer konfiguriert die Höhe über HA's "Layout" Tab → Grid-Optionen. Kein `card_height`-Feld nötig.

---

## 7. Debugging-Strategie

### Browser DevTools Console (F12)
Temporäre Logs einbauen:
```js
console.log('[MyCard editor] setConfig called:', config.entity);
console.log('[MyCard editor] _render called, show_icon:', this._config.show_icon);
```

**Wichtige Diagnosen:**
- Kein Log aus `setConfig` → Methode existiert nicht → HA überspringt Config
- `entity: undefined` in `_render` → Render läuft bevor Config ankam
- `_suppressConfigUpdate: true` → Echo wird unterdrückt (OK)

### Call Stack lesen
HA's Call Stack zeigt `hui-element-editor.ts` → dort sieht man ob `setConfig` oder `hass` zuerst aufgerufen wird.

---

## 8. Checkliste für neue HA Custom Cards

- [ ] `window.customCards.push(...)` am Anfang
- [ ] `static getConfigElement()` auf der Card-Klasse
- [ ] `static getStubConfig()` mit ALLEN Feldern und sinnvollen Defaults
- [ ] `setConfig(config)` auf der Card-Klasse (mit defaults merge)
- [ ] **`setConfig(config)` auf dem Editor** (PFLICHT — HA ruft Methode auf!)
- [ ] **`set config` property setter** zusätzlich (für Echo-Unterdrückung)
- [ ] `_configReceived` Flag im Editor-Constructor initialisieren
- [ ] `set hass` in Editor: nur `form.hass` updaten + einmalig rendern wenn Config schon da
- [ ] `form.computeLabel = (s) => s.label || s.name` auf jeder ha-form-Instanz
- [ ] Echo-Unterdrückung mit `_suppressConfigUpdate` Flag
- [ ] Trigger-Vergleich gegen OLD config (`stored[k]`) nicht gegen new config
- [ ] Panel-Zustand über `_getExpandedPanels()` erhalten
- [ ] CSS-Klassennamen exakt identisch mit JS-generierten Klassennamen
- [ ] `manifest.json` Version vor jedem Tag bumpen
- [ ] `zip_release: true` in manifest.json für HACS
