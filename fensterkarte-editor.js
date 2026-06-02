class FensterkarteCardEditor extends HTMLElement {
  constructor() {
    super();
    this._config = {};
    this._hass = null;
    this.attachShadow({ mode: 'open' });
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._form && this._hass) {
      this._render();
    }
  }

  set config(config) {
    this._config = config || {};
    if (this._form) {
      this._form.data = this._config;
    } else {
      this._render();
    }
  }

  get config() {
    return this._config;
  }

  _render() {
    if (!this.shadowRoot || !this._hass) return;

    this.shadowRoot.innerHTML = `
      <style>
        div {
          padding: 16px;
        }
      </style>
      <div></div>
    `;

    const div = this.shadowRoot.querySelector('div');
    const form = document.createElement('ha-form');
    
    form.hass = this._hass;
    form.data = this._config;
    form.schema = this._getSchema();
    
    form.addEventListener('value-changed', (event) => {
      const newConfig = event.detail.value;
      this._config = newConfig;
      this.dispatchEvent(
        new CustomEvent('config-changed', {
          detail: { config: newConfig },
          bubbles: true,
          composed: true,
        })
      );
    });

    div.appendChild(form);
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
      { name: 'entity', required: true, selector: { entity: {} } },
      { name: 'name', selector: { text: {} } },
      { name: 'show_icon', selector: { boolean: {} } },
      { name: 'icon_position', selector: { select: { options: [
        { value: 'left', label: 'Links' },
        { value: 'right', label: 'Rechts' },
        { value: 'top', label: 'Oben' },
        { value: 'bottom', label: 'Unten' }
      ] } } },
      { name: 'icon_size', selector: { number: { min: 16, max: 120, step: 1 } } },
      { name: 'show_name', selector: { boolean: {} } },
      { name: 'name_position', selector: { select: { options: [
        { value: 'left', label: 'Links' },
        { value: 'right', label: 'Rechts' },
        { value: 'top', label: 'Oben' },
        { value: 'bottom', label: 'Unten' }
      ] } } },
      { name: 'name_size', selector: { number: { min: 10, max: 48, step: 1 } } },
      { name: 'show_state', selector: { boolean: {} } },
      { name: 'open_icon', selector: { icon: {} } },
      { name: 'closed_icon', selector: { icon: {} } },
      { name: 'border_color', selector: { select: { options: colorOptions } } },
      { name: 'border_opacity', selector: { number: { min: 0, max: 1, step: 0.05 } } },
      { name: 'border_color_entity', selector: { entity: {} } },
      { name: 'duration_enabled', selector: { boolean: {} } },
      { name: 'duration_threshold', selector: { number: { min: 0, max: 86400, step: 60 } } },
      { name: 'duration_entity', selector: { entity: {} } },
      { name: 'duration_border_color', selector: { select: { options: colorOptions } } },
      { name: 'duration_border_opacity', selector: { number: { min: 0, max: 1, step: 0.05 } } },
      { name: 'temperature_warning_enabled', selector: { boolean: {} } },
      { name: 'temperature_entity', selector: { entity: {} } },
      { name: 'temperature_threshold', selector: { number: { min: -50, max: 50, step: 0.5 } } },
      { name: 'temperature_threshold_mode', selector: { select: { options: [
        { value: 'below', label: 'Unter dem Schwellenwert' },
        { value: 'above', label: 'Über dem Schwellenwert' }
      ] } } },
      { name: 'humidity_warning_enabled', selector: { boolean: {} } },
      { name: 'humidity_entity', selector: { entity: {} } },
      { name: 'humidity_warning_threshold', selector: { number: { min: 0, max: 100, step: 1 } } },
      { name: 'humidity_border_color', selector: { select: { options: colorOptions } } },
      { name: 'humidity_border_opacity', selector: { number: { min: 0, max: 1, step: 0.05 } } }
    ];
  }
}

customElements.define('fensterkarte-card-editor', FensterkarteCardEditor);
