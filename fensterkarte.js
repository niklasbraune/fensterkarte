window.customCards = window.customCards || [];
window.customCards.push({
  type: 'fensterkarte-card',
  name: 'Fensterkarte',
  description: 'Anzeige des Fensterstatus mit konfigurierbaren Rahmen- und Warnfarben.',
  preview: true
});

class FensterkarteCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._hass = null;
    this._config = {};
  }

  static getConfigElement() {
    return document.createElement('fensterkarte-card-editor');
  }

  static getStubConfig() {
    return {
      entity: '',
      name: '',
      show_icon: true,
      icon_position: 'left',
      icon_size: 36,
      open_icon: 'mdi:window-open',
      closed_icon: 'mdi:window-closed',
      icon_color_open: null,
      icon_color_closed: null,
      show_name: true,
      name_position: 'right',
      name_size: 14,
      show_state: true,
      card_height: 0,
      tap_action: { action: 'more-info' },
      border_color: [0, 128, 0],
      border_color_open: [255, 200, 0],
      border_opacity: 1,
      border_blur: 4,
      border_closed_enabled: true,
      border_color_entity: '',
      duration_enabled: false,
      duration_threshold: '00:10:00',
      duration_entity: '',
      duration_border_color: [255, 140, 0],
      duration_border_opacity: 1,
      temperature_warning_enabled: false,
      temperature_entity: '',
      temperature_threshold: 18,
      temperature_threshold_mode: 'below',
      temperature_unit: 'celsius',
      humidity_warning_enabled: false,
      humidity_entity: '',
      humidity_warning_threshold: 65,
      humidity_border_color: [220, 50, 50],
      humidity_border_opacity: 1,
      preview_warning: false,
      pulse_enabled: false,
      pulse_interval: 1.5,
    };
  }

  setConfig(config) {
    if (!config) throw new Error('Fensterkarte: Ungültige Konfiguration');
    this._config = { ...FensterkarteCard.getStubConfig(), ...config };
    if (this._hass) this.render();
  }

  set hass(hass) {
    this._hass = hass;
    this.render();
  }

  get cardSize() { return 1; }

  render() {
    if (!this.shadowRoot || !this._config) return;

    const root = document.createElement('div');
    root.className = 'fensterkarte-root';

    if (!this._hass) {
      root.textContent = 'Home Assistant nicht verfügbar';
      this._renderRoot(root);
      return;
    }

    const entity = this._hass.states[this._config.entity];
    if (!this._config.entity || !entity) {
      root.textContent = this._config.entity
        ? `Entität ${this._config.entity} nicht gefunden`
        : 'Keine Entität konfiguriert';
      this._renderRoot(root);
      return;
    }

    const state = entity.state;
    const isOpen = this._isOpen(state);
    const label = this._config.name || entity.attributes.friendly_name || entity.entity_id;
    const displayState = this._formatState(state);
    const iconName = isOpen ? this._config.open_icon : this._config.closed_icon;

    const durationInfo = this._buildDurationInfo(entity, isOpen);
    const humidityInfo = this._buildHumidityInfo();
    const border = this._computeBorder(isOpen, durationInfo, humidityInfo);

    const isCentered = this._config.icon_position === 'center';
    const iconSize = Number(this._config.icon_size) || 36;
    const cardHeight = Number(this._config.card_height) || 0;

    // ── Outer border shell (gradient or solid) ───────────────────────────
    const borderEl = document.createElement('div');
    borderEl.className = 'fensterkarte-border';
    borderEl.style.borderRadius = '14px';
    borderEl.style.padding = '2px';
    borderEl.style.background = this._buildGradient(border.colors);
    borderEl.style.boxSizing = 'border-box';
    if (cardHeight > 0) borderEl.style.minHeight = `${cardHeight}px`;

    const blurPx = border.blur;
    const primaryColor = border.colors[0];
    const glowShadow = blurPx > 0 && primaryColor !== 'transparent'
      ? `0 0 ${blurPx}px ${Math.ceil(blurPx / 2)}px ${primaryColor}`
      : 'var(--ha-card-box-shadow, none)';

    if (border.pulse) {
      borderEl.style.setProperty('--fk-box-shadow-peak', glowShadow);
      borderEl.style.setProperty('--fk-pulse-duration', `${Number(this._config.pulse_interval) || 1.5}s`);
      borderEl.classList.add('fensterkarte-pulse');
    } else {
      borderEl.style.boxShadow = glowShadow;
    }

    // ── Inner card wrapper ───────────────────────────────────────────────
    const wrapper = document.createElement('div');
    wrapper.className = 'fensterkarte-wrapper';
    wrapper.style.borderRadius = '12px';
    wrapper.style.background = 'var(--card-background-color, rgba(255,255,255,0.9))';
    wrapper.style.padding = '12px';
    wrapper.style.display = 'flex';
    wrapper.style.alignItems = 'center';
    wrapper.style.gap = '10px';
    wrapper.style.height = '100%';
    wrapper.style.boxSizing = 'border-box';

    if (isCentered) {
      wrapper.style.flexDirection = 'column';
      wrapper.style.justifyContent = 'center';
      wrapper.style.alignItems = 'center';
    } else {
      wrapper.style.flexDirection = this._getFlexDirection();
    }

    const tapAction = this._config.tap_action?.action;
    if (tapAction && tapAction !== 'none') {
      wrapper.style.cursor = 'pointer';
      wrapper.addEventListener('click', () => this._handleTap());
    }

    // ── Icon ─────────────────────────────────────────────────────────────
    const icon = document.createElement('ha-icon');
    icon.setAttribute('icon', iconName);
    icon.style.setProperty('--mdc-icon-size', `${iconSize}px`);
    icon.style.width = `${iconSize}px`;
    icon.style.height = `${iconSize}px`;
    icon.style.flexShrink = '0';
    icon.style.display = this._config.show_icon === false ? 'none' : 'flex';
    icon.style.alignItems = 'center';
    icon.style.justifyContent = 'center';

    const iconColorArr = isOpen ? this._config.icon_color_open : this._config.icon_color_closed;
    if (Array.isArray(iconColorArr) && iconColorArr.length === 3) {
      icon.style.color = `rgb(${iconColorArr[0]},${iconColorArr[1]},${iconColorArr[2]})`;
    }

    // ── Content ───────────────────────────────────────────────────────────
    const isNameCenter = this._config.name_position === 'center' || isCentered;
    const content = document.createElement('div');
    content.style.display = 'flex';
    content.style.flexDirection = isCentered ? 'column' : this._getTextDirection();
    content.style.flex = isCentered ? 'none' : '1';
    content.style.gap = '4px';
    content.style.minWidth = '0';
    if (isNameCenter) {
      content.style.textAlign = 'center';
      content.style.alignItems = 'center';
      content.style.width = '100%';
    }

    const nameEl = document.createElement('div');
    nameEl.textContent = label;
    nameEl.style.fontSize = `${this._config.name_size}px`;
    nameEl.style.fontWeight = '600';
    nameEl.style.overflow = 'hidden';
    nameEl.style.textOverflow = 'ellipsis';
    nameEl.style.whiteSpace = 'nowrap';
    nameEl.style.display = this._config.show_name === false ? 'none' : 'block';

    const stateEl = document.createElement('div');
    stateEl.textContent = displayState;
    stateEl.style.opacity = '0.85';
    stateEl.style.fontSize = '0.9em';
    stateEl.style.display = this._config.show_state === false ? 'none' : 'block';

    const extra = document.createElement('div');
    extra.style.display = 'flex';
    extra.style.flexDirection = 'column';
    extra.style.gap = '3px';
    extra.style.fontSize = '0.82em';
    extra.style.opacity = '0.82';

    if (durationInfo.label) {
      const dl = document.createElement('div');
      dl.textContent = durationInfo.label;
      extra.appendChild(dl);
    }
    if (humidityInfo.label) {
      const hl = document.createElement('div');
      hl.textContent = humidityInfo.label;
      extra.appendChild(hl);
    }

    if (isCentered || this._config.name_position === 'top') {
      content.appendChild(nameEl);
      content.appendChild(stateEl);
    } else {
      content.appendChild(stateEl);
      content.appendChild(nameEl);
    }
    content.appendChild(extra);

    // ── Assemble ──────────────────────────────────────────────────────────
    if (isCentered || this._config.icon_position === 'top') {
      wrapper.appendChild(icon);
      wrapper.appendChild(content);
    } else if (this._config.icon_position === 'bottom') {
      wrapper.style.flexDirection = 'column-reverse';
      wrapper.appendChild(icon);
      wrapper.appendChild(content);
    } else if (this._config.icon_position === 'left') {
      wrapper.appendChild(icon);
      wrapper.appendChild(content);
    } else {
      wrapper.appendChild(content);
      wrapper.appendChild(icon);
    }

    borderEl.appendChild(wrapper);
    root.appendChild(borderEl);
    this._renderRoot(root);
  }

  _renderRoot(child) {
    this.shadowRoot.innerHTML = '';
    const style = document.createElement('style');
    style.textContent = `
      :host { display: block; height: 100%; }
      .fensterkarte-root { height: 100%; font-family: var(--ha-card-font-family, inherit); color: var(--primary-text-color, #000); }
      .fensterkarte-border { height: 100%; }
      .fensterkarte-wrapper { height: 100%; }
      ha-icon { color: var(--paper-item-icon-color, #3F51B5); }
      @keyframes fensterkarte-pulse {
        0%, 100% { box-shadow: var(--fk-box-shadow-peak, none); }
        50% { box-shadow: none; }
      }
      .fensterkarte-pulse { animation: fensterkarte-pulse var(--fk-pulse-duration, 1.5s) ease-in-out infinite; }
    `;
    this.shadowRoot.appendChild(style);
    this.shadowRoot.appendChild(child);
  }

  _buildGradient(colors) {
    if (!colors || colors.length === 0) return 'transparent';
    if (colors.length === 1) return colors[0];
    const deg = 360 / colors.length;
    const stops = colors.flatMap((c, i) => [
      `${c} ${(i * deg).toFixed(1)}deg`,
      `${c} ${((i + 1) * deg).toFixed(1)}deg`,
    ]);
    return `conic-gradient(from 0deg, ${stops.join(', ')})`;
  }

  _handleTap() {
    const action = this._config.tap_action || { action: 'more-info' };
    switch (action.action) {
      case 'more-info':
        this.dispatchEvent(new CustomEvent('hass-more-info', {
          detail: { entityId: this._config.entity }, bubbles: true, composed: true,
        }));
        break;
      case 'toggle':
        this._hass.callService('homeassistant', 'toggle', { entity_id: this._config.entity });
        break;
      case 'navigate':
        if (action.navigation_path) {
          window.history.pushState(null, '', action.navigation_path);
          window.dispatchEvent(new CustomEvent('location-changed', { bubbles: false }));
        }
        break;
      case 'url':
        if (action.url_path)
          window.open(action.url_path, action.url_path.startsWith('http') ? '_blank' : '_self');
        break;
      case 'call-service':
        if (action.service) {
          const [d, s] = action.service.split('.');
          this._hass.callService(d, s, action.service_data || { entity_id: this._config.entity });
        }
        break;
    }
  }

  _isOpen(state) {
    return ['open', 'on', 'true', 'opened'].includes(String(state).toLowerCase());
  }

  _formatState(state) {
    const n = String(state).toLowerCase();
    if (['open', 'opened', 'on', 'true'].includes(n)) return 'Geöffnet';
    if (['closed', 'off', 'false'].includes(n)) return 'Geschlossen';
    return state;
  }

  _getFlexDirection() {
    const p = this._config.icon_position;
    return (p === 'top' || p === 'bottom' || p === 'center') ? 'column' : 'row';
  }

  _getTextDirection() {
    return this._config.name_position === 'top' ? 'column' : 'row';
  }

  _colorToRgb(color) {
    if (Array.isArray(color) && color.length === 3) return color;
    const named = {
      green:[0,128,0], yellow:[255,255,0], orange:[255,165,0], red:[255,0,0],
      blue:[0,0,255], purple:[128,0,128], brown:[165,42,42], black:[0,0,0], white:[255,255,255],
    };
    if (named[color]) return named[color];
    if (typeof color === 'string' && color.startsWith('#')) {
      const hex = color.slice(1);
      if (hex.length === 3) return [parseInt(hex[0]+hex[0],16),parseInt(hex[1]+hex[1],16),parseInt(hex[2]+hex[2],16)];
      if (hex.length === 6) return [parseInt(hex.slice(0,2),16),parseInt(hex.slice(2,4),16),parseInt(hex.slice(4,6),16)];
    }
    return null;
  }

  _applyOpacity(color, opacity) {
    if (Array.isArray(color) && color.length === 3) {
      if (opacity >= 1) return `rgb(${color[0]},${color[1]},${color[2]})`;
      return `rgba(${color[0]},${color[1]},${color[2]},${opacity})`;
    }
    if (opacity >= 1) return color;
    const rgb = this._colorToRgb(color);
    if (!rgb) return color;
    return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${opacity})`;
  }

  _mixColors(c1, c2) {
    const r1 = this._colorToRgb(c1), r2 = this._colorToRgb(c2);
    if (!r1 || !r2) return this._applyOpacity(c1, 1);
    return `rgb(${Math.round((r1[0]+r2[0])/2)},${Math.round((r1[1]+r2[1])/2)},${Math.round((r1[2]+r2[2])/2)})`;
  }

  _parseThreshold(value) {
    if (!value && value !== 0) return 0;
    if (typeof value === 'number') return value;
    const s = String(value).trim();
    if (s.includes(':')) {
      const p = s.split(':').map(n => parseInt(n,10) || 0);
      if (p.length === 3) return p[0]*3600 + p[1]*60 + p[2];
      if (p.length === 2) return p[0]*60 + p[1];
    }
    return parseInt(s,10) || 0;
  }

  _buildDurationInfo(entity, isOpen) {
    const info = { label: '', active: false };
    if (!this._config.duration_enabled || !isOpen) return info;
    let duration = 0;
    if (this._config.duration_entity) {
      const ds = this._hass.states[this._config.duration_entity];
      if (ds && !isNaN(Number(ds.state))) duration = Number(ds.state);
    }
    if (!duration && entity?.last_changed)
      duration = Math.floor((new Date() - new Date(entity.last_changed)) / 1000);
    const threshold = this._parseThreshold(this._config.duration_threshold);
    info.label = `Offen seit ${this._formatDuration(duration)}`;
    info.active = threshold > 0 && duration >= threshold && this._isTemperatureConditionMet();
    if (info.active) info.label += ' (Warnung)';
    return info;
  }

  _isTemperatureConditionMet() {
    if (!this._config.temperature_warning_enabled || !this._config.temperature_entity) return true;
    const ts = this._hass.states[this._config.temperature_entity];
    if (!ts || isNaN(Number(ts.state))) return true;
    let temp = Number(ts.state);
    if (this._config.temperature_unit === 'fahrenheit') temp = temp * 9 / 5 + 32;
    const threshold = Number(this._config.temperature_threshold);
    return this._config.temperature_threshold_mode === 'above' ? temp >= threshold : temp <= threshold;
  }

  _buildHumidityInfo() {
    const info = { label: '', active: false };
    if (!this._config.humidity_warning_enabled || !this._config.humidity_entity) return info;
    const hs = this._hass.states[this._config.humidity_entity];
    if (!hs || isNaN(Number(hs.state))) return info;
    const humidity = Number(hs.state);
    const threshold = Number(this._config.humidity_warning_threshold) || 0;
    if (humidity >= threshold) {
      info.active = true;
      info.label = `${humidity}% RF (Schwelle: ${threshold}%)`;
    } else {
      info.label = `${humidity}% RF`;
    }
    return info;
  }

  _computeBorder(isOpen, durationInfo, humidityInfo) {
    const baseOpacity = Number(this._config.border_opacity) || 1;
    const blur = Number(this._config.border_blur) || 0;
    const pulse = !!this._config.pulse_enabled;
    const preview = this._config.preview_warning;

    const durationActive = durationInfo.active || preview === 'duration' || preview === 'both';
    const humidityActive = humidityInfo.active || preview === 'humidity' || preview === 'both';

    const colors = [];
    if (humidityActive) colors.push(this._applyOpacity(
      this._config.humidity_border_color || [220,50,50],
      Number(this._config.humidity_border_opacity) || 1
    ));
    if (durationActive) colors.push(this._applyOpacity(
      this._config.duration_border_color || [255,140,0],
      Number(this._config.duration_border_opacity) || 1
    ));

    if (colors.length > 0) return { colors, pulse, blur };

    if (!isOpen && this._config.border_closed_enabled === false)
      return { colors: ['transparent'], pulse: false, blur: 0 };

    let baseColor = isOpen
      ? (this._config.border_color_open || this._config.border_color || [0,128,0])
      : (this._config.border_color || [0,128,0]);

    if (this._config.border_color_entity) {
      const be = this._hass.states[this._config.border_color_entity];
      if (be?.state) baseColor = be.state;
    }
    return { colors: [this._applyOpacity(baseColor, baseOpacity)], pulse: false, blur };
  }

  _formatDuration(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  }
}

customElements.define('fensterkarte-card', FensterkarteCard);

// ── Editor ──────────────────────────────────────────────────────────────────

class FensterkarteCardEditor extends HTMLElement {
  constructor() {
    super();
    this._config = {};
    this._hass = null;
    this._cardType = null;
    this._forms = [];
    this.attachShadow({ mode: 'open' });
  }

  set hass(hass) {
    this._hass = hass;
    if (this._forms.length === 0 && this._hass) this._render();
  }

  set config(config) {
    if (!config) return;
    if (!this._cardType && config.type) this._cardType = config.type;
    this._config = { ...config };
    if (this._forms.length > 0) {
      const data = this._getFormData();
      for (const { form } of this._forms) form.data = data;
    } else if (this._hass) {
      this._render();
    }
  }

  get config() { return this._config; }

  _getFormData() {
    const { type, ...rest } = this._config;
    return rest;
  }

  _render() {
    if (!this.shadowRoot || !this._hass) return;
    this._forms = [];

    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; }
        details { border-bottom: 1px solid var(--divider-color, #e0e0e0); }
        summary {
          padding: 14px 16px; font-weight: 500; cursor: pointer; user-select: none;
          display: flex; align-items: center; justify-content: space-between;
          color: var(--primary-text-color); list-style: none;
        }
        summary::-webkit-details-marker { display: none; }
        summary::after { content: '▾'; font-size: 16px; color: var(--secondary-text-color); }
        details[open] summary::after { content: '▴'; }
        .section-form { padding: 0 4px 8px; }
        .test-row { padding: 2px 16px 10px; display: flex; gap: 8px; flex-wrap: wrap; }
        .test-btn {
          font-size: 12px; padding: 4px 12px; border-radius: 12px;
          border: 1px solid var(--primary-color, #3F51B5);
          background: transparent; color: var(--primary-color, #3F51B5);
          cursor: pointer; font-family: inherit;
        }
        .test-btn.active { background: var(--primary-color, #3F51B5); color: white; }
      </style>
    `;

    const cfg = this._config;
    const data = this._getFormData();
    const sl = (min, max, step) => ({ number: { min, max, step, mode: 'slider' } });
    const positions = [
      { value: 'left', label: 'Links' }, { value: 'center', label: 'Mitte' },
      { value: 'right', label: 'Rechts' }, { value: 'top', label: 'Oben' },
      { value: 'bottom', label: 'Unten' },
    ];

    // ── Section: Darstellung ───────────────────────────────────────────
    this._addSection('Darstellung', [
      { name: 'entity', label: 'Entität', required: true, selector: { entity: {} } },
      { name: 'name', label: 'Anzeigename', selector: { text: {} } },
      { name: 'card_height', label: 'Kartenhöhe px (0 = auto)', selector: sl(0, 400, 4) },
      { name: 'show_icon', label: 'Icon anzeigen', selector: { boolean: {} } },
      { name: 'icon_position', label: 'Icon Position', selector: { select: { options: positions } } },
      { name: 'icon_size', label: 'Icon Größe (px)', selector: sl(16, 128, 2) },
      { name: 'open_icon', label: 'Icon geöffnet', selector: { icon: {} } },
      { name: 'closed_icon', label: 'Icon geschlossen', selector: { icon: {} } },
      { name: 'icon_color_open', label: 'Icon Farbe geöffnet', selector: { color_rgb: {} } },
      { name: 'icon_color_closed', label: 'Icon Farbe geschlossen', selector: { color_rgb: {} } },
      { name: 'show_name', label: 'Name anzeigen', selector: { boolean: {} } },
      { name: 'name_position', label: 'Name Position', selector: { select: { options: positions } } },
      { name: 'name_size', label: 'Schriftgröße (px)', selector: sl(10, 48, 1) },
      { name: 'show_state', label: 'Status anzeigen', selector: { boolean: {} } },
      { name: 'tap_action', label: 'Aktion beim Tippen', selector: { action: {} } },
    ], { open: true });

    // ── Section: Rand & Farbe ──────────────────────────────────────────
    const randSchema = [
      { name: 'border_color', label: 'Randfarbe (geschlossen)', selector: { color_rgb: {} } },
      { name: 'border_color_open', label: 'Randfarbe (geöffnet, keine Warnung)', selector: { color_rgb: {} } },
      { name: 'border_opacity', label: 'Deckkraft', selector: sl(0, 1, 0.05) },
      { name: 'border_blur', label: 'Unschärfe / Glow (px)', selector: sl(0, 30, 1) },
      { name: 'border_closed_enabled', label: 'Rand bei geschlossenem Fenster', selector: { boolean: {} } },
      { name: 'border_color_entity', label: 'Randfarbe über Entität', selector: { entity: {} } },
      { name: 'pulse_enabled', label: 'Rand pulsieren bei Warnung', selector: { boolean: {} } },
    ];
    if (cfg.pulse_enabled) {
      randSchema.push({ name: 'pulse_interval', label: 'Puls-Intervall (Sekunden)', selector: sl(0.3, 5, 0.1) });
    }
    this._addSection('Rand & Farbe', randSchema);

    // ── Section: Öffnungsdauer-Warnung ─────────────────────────────────
    const dauerSchema = [
      { name: 'duration_enabled', label: 'Aktiviert', selector: { boolean: {} } },
    ];
    if (cfg.duration_enabled) {
      dauerSchema.push(
        { name: 'duration_threshold', label: 'Warnschwelle (HH:MM:SS)', selector: { text: {} } },
        { name: 'duration_entity', label: 'Dauer-Entität (optional)', selector: { entity: {} } },
        { name: 'duration_border_color', label: 'Randfarbe', selector: { color_rgb: {} } },
        { name: 'duration_border_opacity', label: 'Deckkraft', selector: sl(0, 1, 0.05) },
        { name: 'temperature_warning_enabled', label: 'Nur bei bestimmter Temperatur', selector: { boolean: {} } }
      );
      if (cfg.temperature_warning_enabled) {
        dauerSchema.push(
          { name: 'temperature_entity', label: 'Temperatur-Entität', selector: { entity: {} } },
          { name: 'temperature_unit', label: 'Einheit', selector: { select: { options: [
            { value: 'celsius', label: '°C' }, { value: 'fahrenheit', label: '°F' }
          ] } } },
          { name: 'temperature_threshold',
            label: `Schwelle (${cfg.temperature_unit === 'fahrenheit' ? '°F' : '°C'})`,
            selector: { number: {
              min: cfg.temperature_unit === 'fahrenheit' ? -58 : -50,
              max: cfg.temperature_unit === 'fahrenheit' ? 122 : 50,
              step: 0.5, mode: 'box',
            } } },
          { name: 'temperature_threshold_mode', label: 'Bedingung', selector: { select: { options: [
            { value: 'below', label: 'Unter dem Schwellenwert' },
            { value: 'above', label: 'Über dem Schwellenwert' },
          ] } } }
        );
      }
    }
    this._addSection('Öffnungsdauer-Warnung', dauerSchema, { testWarning: 'duration' });

    // ── Section: Feuchtigkeitswarnung ──────────────────────────────────
    const feuchSchema = [
      { name: 'humidity_warning_enabled', label: 'Aktiviert', selector: { boolean: {} } },
    ];
    if (cfg.humidity_warning_enabled) {
      feuchSchema.push(
        { name: 'humidity_entity', label: 'Feuchtigkeits-Entität', selector: { entity: {} } },
        { name: 'humidity_warning_threshold', label: 'Schwelle (%)', selector: sl(0, 100, 1) },
        { name: 'humidity_border_color', label: 'Randfarbe', selector: { color_rgb: {} } },
        { name: 'humidity_border_opacity', label: 'Deckkraft', selector: sl(0, 1, 0.05) }
      );
    }
    this._addSection('Feuchtigkeitswarnung', feuchSchema, { testWarning: 'humidity' });
  }

  _addSection(title, schema, { open = false, testWarning = null } = {}) {
    const details = document.createElement('details');
    if (open) details.open = true;

    const summary = document.createElement('summary');
    summary.textContent = title;
    details.appendChild(summary);

    if (testWarning) {
      const row = document.createElement('div');
      row.className = 'test-row';
      const btn = document.createElement('button');
      btn.className = 'test-btn' + (this._config.preview_warning === testWarning ? ' active' : '');
      btn.dataset.warning = testWarning;
      btn.textContent = 'Warnung testen';
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const prev = this._config.preview_warning;
        const next = prev === testWarning ? false : testWarning;
        this._applyChange({ preview_warning: next });
        this.shadowRoot.querySelectorAll('.test-btn').forEach(b => {
          b.classList.toggle('active', b.dataset.warning === next);
        });
      });
      row.appendChild(btn);
      details.appendChild(row);
    }

    const formWrap = document.createElement('div');
    formWrap.className = 'section-form';
    const form = document.createElement('ha-form');
    form.hass = this._hass;
    form.data = this._getFormData();
    form.schema = schema;
    // ha-form ignores schema.label by default — provide computeLabel so our labels are used
    form.computeLabel = (s) => s.label || s.name;

    form.addEventListener('value-changed', (e) => {
      this._applyChange(e.detail.value);
    });

    this._forms.push({ form, title, testWarning });
    formWrap.appendChild(form);
    details.appendChild(formWrap);
    this.shadowRoot.appendChild(details);
  }

  _applyChange(value) {
    const { type, ...stored } = this._config;
    const cardType = type || this._cardType || 'custom:fensterkarte-card';
    const newConfig = {
      type: cardType,
      ...FensterkarteCard.getStubConfig(),
      ...stored,
      ...value,
    };
    this._config = { ...newConfig };

    // If schema-conditional fields changed, rebuild sections
    const triggers = ['duration_enabled', 'temperature_warning_enabled', 'humidity_warning_enabled', 'pulse_enabled'];
    if (triggers.some(k => k in value)) {
      this._render();
    } else {
      const data = this._getFormData();
      for (const { form } of this._forms) form.data = data;
    }

    this.dispatchEvent(new CustomEvent('config-changed', {
      detail: { config: newConfig }, bubbles: true, composed: true,
    }));
  }
}

customElements.define('fensterkarte-card-editor', FensterkarteCardEditor);
