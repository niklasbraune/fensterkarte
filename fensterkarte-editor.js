class FensterkarteCardEditor extends HTMLElement {
  constructor() {
    super();
    this._config = {};
    this._hass = null;
    this.attachShadow({ mode: 'open' });
  }

  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  set config(config) {
    this._config = config || {};
    this._render();
  }

  get config() {
    return this._config;
  }

  _render() {
    if (!this.shadowRoot || !this._hass) return;
    this.shadowRoot.innerHTML = '';

    const wrapper = document.createElement('div');
    wrapper.style.padding = '16px';
    wrapper.style.display = 'grid';
    wrapper.style.gap = '16px';
    wrapper.style.maxWidth = '700px';

    const form = document.createElement('ha-form');
    form.data = this._config;
    form.hass = this._hass;
    form.schema = this._getSchema();
    form.computeLabel = schema => schema.name || schema.type;
    form.addEventListener('value-changed', event => this._valueChanged(event));

    wrapper.appendChild(form);
    this.shadowRoot.appendChild(wrapper);
  }

  _valueChanged(event) {
    this._config = event.detail.value;
    this.dispatchEvent(new CustomEvent('config-changed', {
      detail: { config: this._config },
      bubbles: true,
      composed: true
    }));
  }

  _getSchema() {
    const colorOptions = [
      { value: 'transparent', label: 'Transparent' },
      { value: 'green', label: 'Grün' },
      { value: 'yellow', label: 'Gelb' },
      { value: 'orange', label: 'Orange' },
      { value: 'red', label: 'Rot' },
      { value: 'blue', label: 'Blau' },
      { value: 'purple', label: 'Lila' },
      { value: 'brown', label: 'Braun' },
      { value: 'black', label: 'Schwarz' },
      { value: 'white', label: 'Weiß' }
    ];

    return [
      { name: 'entity', required: true, selector: { entity: {} }, description: 'Fenstersensor' },
      { name: 'name', selector: { text: {} }, description: 'Anzeigename (optional)' },
      { name: 'show_icon', selector: { boolean: {} }, description: 'Icon anzeigen' },
      { name: 'icon_position', selector: { select: { options: [
        { value: 'left', label: 'Links' },
        { value: 'right', label: 'Rechts' },
        { value: 'top', label: 'Oben' },
        { value: 'bottom', label: 'Unten' }
      ] } }, description: 'Position des Icons' },
      { name: 'icon_size', selector: { number: { min: 16, max: 120, step: 1 } }, description: 'Icon-Größe in Pixel' },
      { name: 'show_name', selector: { boolean: {} }, description: 'Name anzeigen' },
      { name: 'name_position', selector: { select: { options: [
        { value: 'left', label: 'Links' },
        { value: 'right', label: 'Rechts' },
        { value: 'top', label: 'Oben' },
        { value: 'bottom', label: 'Unten' }
      ] } }, description: 'Position des Namens' },
      { name: 'name_size', selector: { number: { min: 10, max: 48, step: 1 } }, description: 'Name Schriftgröße in Pixel' },
      { name: 'show_state', selector: { boolean: {} }, description: 'Fensterzustand anzeigen' },
      { name: 'open_icon', selector: { icon: {} }, description: 'Icon für offenen Zustand' },
      { name: 'closed_icon', selector: { icon: {} }, description: 'Icon für geschlossenen Zustand' },
      { name: 'border_color', selector: { select: { options: colorOptions } }, description: 'Standardrahmenfarbe' },
      { name: 'border_opacity', selector: { number: { min: 0, max: 1, step: 0.05 } }, description: 'Transparenz des Rahmens' },
      { name: 'border_color_entity', selector: { entity: {} }, description: 'Entität zur Rahmenfarbe' },
      { name: 'duration_enabled', selector: { boolean: {} }, description: 'Dauerwarnung aktivieren' },
      { name: 'duration_threshold', selector: { number: { min: 0, max: 86400, step: 60 } }, description: 'Schwelle in Sekunden' },
      { name: 'duration_entity', selector: { entity: {} }, description: 'Alternativer Entität für Öffnungsdauer' },
      { name: 'duration_border_color', selector: { select: { options: colorOptions } }, description: 'Rahmenfarbe bei Dauerwarnung' },
      { name: 'duration_border_opacity', selector: { number: { min: 0, max: 1, step: 0.05 } }, description: 'Transparenz bei Dauerwarnung' },
      { name: 'temperature_warning_enabled', selector: { boolean: {} }, description: 'Temperaturabhängige Warnung aktivieren' },
      { name: 'temperature_entity', selector: { entity: {} }, description: 'Temperaturentität für Warnung' },
      { name: 'temperature_threshold', selector: { number: { min: -50, max: 50, step: 0.5 } }, description: 'Temperaturschwelle' },
      { name: 'temperature_threshold_mode', selector: { select: { options: [
        { value: 'below', label: 'Unter dem Schwellenwert' },
        { value: 'above', label: 'Über dem Schwellenwert' }
      ] } }, description: 'Wann die Temperaturwarnung aktiviert wird' },
      { name: 'humidity_warning_enabled', selector: { boolean: {} }, description: 'Luftfeuchtigkeitswarnung aktivieren' },
      { name: 'humidity_entity', selector: { entity: {} }, description: 'Luftfeuchtigkeitsentität' },
      { name: 'humidity_warning_threshold', selector: { number: { min: 0, max: 100, step: 1 } }, description: 'Schwelle in Prozent' },
      { name: 'humidity_border_color', selector: { select: { options: colorOptions } }, description: 'Rahmenfarbe bei Feuchtigkeitswarnung' },
      { name: 'humidity_border_opacity', selector: { number: { min: 0, max: 1, step: 0.05 } }, description: 'Transparenz bei Feuchtigkeitswarnung' }
    ];
  }
}

customElements.define('fensterkarte-card-editor', FensterkarteCardEditor);
