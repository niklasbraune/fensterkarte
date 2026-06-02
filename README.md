# Fensterkarte

Eine Home Assistant Lovelace Custom Card für die Anzeige des Fensterstatus mit konfigurierbaren Icons, Namen, Position, Größe und farbigen Rahmen für Dauer- und Feuchtigkeitswarnungen.

## Installation

### Manuelle Installation

1. Kopiere `fensterkarte.js`, `fensterkarte-editor.js` und `manifest.json` in dein `www`-Verzeichnis.
2. Füge die Resource in Home Assistant hinzu:
   ```yaml
   resources:
     - url: /local/fensterkarte.js
       type: module
   ```
3. Füge die Karte zu einer Lovelace-Ansicht hinzu:
   ```yaml
   type: custom:fensterkarte-card
   entity: sensor.fensterkontakt
   name: Fenster Wohnzimmer
   show_icon: true
   icon_position: left
   icon_size: 56
   show_name: true
   name_position: right
   name_size: 18
   show_state: true
   open_icon: mdi:window-open
   closed_icon: mdi:window-closed
   border_color: green
   border_opacity: 0.8
   duration_enabled: true
   duration_threshold: 600
   duration_border_color: orange
   duration_border_opacity: 0.8
   temperature_warning_enabled: true
   temperature_entity: sensor.raumtemperatur
   temperature_threshold: 18
   temperature_threshold_mode: below
   humidity_warning_enabled: true
   humidity_entity: sensor.luftfeuchtigkeit
   humidity_warning_threshold: 65
   humidity_border_color: red
   humidity_border_opacity: 0.8
   ```

### HACS-Installation

1. Lege das Verzeichnis `fensterkarte` in dein Home Assistant Custom Repository oder ein eigenes GitHub-Repo.
2. Füge das Repo als benutzerdefiniertes Repository in HACS hinzu: `Frontend` → `Repositories` → `+` → `Custom repository`.
3. Wähle als Kategorie `Lovelace` und gib die URL zu deinem Repo an.
4. Installiere `Fensterkarte` in HACS.
5. Füge die Karte zu einer Lovelace-Ansicht hinzu wie oben.

### HACS Release vorbereiten

- Verwende `manifest.json` mit einer eindeutigen `version`.
- Lege ein GitHub-Release an, damit HACS die neue Version erkennt.
- Füge ggf. ein `release`-Tag im Repository hinzu, z. B. `v0.1.0`.
- Achte darauf, dass `fensterkarte.js`, `fensterkarte-editor.js` und `manifest.json` im Release enthalten sind.

## Features

- Wechselnde Icons für geöffnet/geschlossen
- Konfigurierbare Icon- und Namensanzeige
- Konfigurierbare Randfarbe mit Transparenz
- Dauerwarnung bei dauerhaft geöffnetem Fenster
- Temperaturabhängige Aktivierung der Dauerwarnung
- Feuchtigkeitswarnung über eigene Entität
- GUI-Editor für einfache Konfiguration
