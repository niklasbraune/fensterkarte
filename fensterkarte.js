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

  static async getConfigElement() {
    await import('./fensterkarte-editor.js');
    return document.createElement('fensterkarte-card-editor');
  }

  static getStubConfig() {
    return {
      entity: '',
      name: '',
      show_icon: true,
      icon_position: 'left',
      icon_size: 48,
      show_name: true,
      name_position: 'right',
      name_size: 16,
      show_state: true,
      open_icon: 'mdi:window-open',
      closed_icon: 'mdi:window-closed',
      border_color: 'green',
      border_opacity: 1,
      duration_enabled: false,
      duration_threshold: 600,
      duration_entity: '',
      duration_border_color: 'orange',
      duration_border_opacity: 1,
      temperature_warning_enabled: false,
      temperature_entity: '',
      temperature_threshold: 18,
      temperature_threshold_mode: 'below',
      humidity_warning_enabled: false,
      humidity_entity: '',
      humidity_warning_threshold: 65,
      humidity_border_color: 'red',
      humidity_border_opacity: 1,
      pulse_enabled: false,
    };
  }

  setConfig(config) {
    if (!config || !config.entity) {
      throw new Error('Fensterkarte benötigt mindestens die Konfiguration `entity`');
    }
    const defaults = FensterkarteCard.getStubConfig();
    this._config = { ...defaults, ...config };
  }

  set hass(hass) {
    this._hass = hass;
    this.render();
  }

  get cardSize() {
    return 1;
  }

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
    if (!entity) {
      root.textContent = `Entität ${this._config.entity} nicht gefunden`;
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

    const wrapper = document.createElement('div');
    wrapper.className = 'fensterkarte-wrapper';
    wrapper.style.border = `2px solid ${border.color}`;
    wrapper.style.borderRadius = '14px';
    wrapper.style.background = 'var(--card-background-color, rgba(255,255,255,0.9))';
    wrapper.style.boxShadow = 'var(--ha-card-box-shadow, none)';
    wrapper.style.padding = '14px';
    wrapper.style.display = 'flex';
    wrapper.style.alignItems = 'center';
    wrapper.style.gap = '12px';
    wrapper.style.flexDirection = this._getFlexDirection();

    if (border.pulse) {
      wrapper.style.setProperty('--fk-border-color', border.color);
      wrapper.classList.add('fensterkarte-pulse');
    }

    const icon = document.createElement('ha-icon');
    icon.setAttribute('icon', iconName);
    icon.style.width = `${this._config.icon_size}px`;
    icon.style.height = `${this._config.icon_size}px`;
    icon.style.lineHeight = `${this._config.icon_size}px`;
    icon.style.fontSize = `${this._config.icon_size}px`;
    icon.style.display = this._config.show_icon ? 'block' : 'none';

    const content = document.createElement('div');
    content.style.display = 'flex';
    content.style.flexDirection = this._getTextDirection();
    content.style.flex = '1';
    content.style.gap = '6px';

    const nameEl = document.createElement('div');
    nameEl.className = 'fensterkarte-name';
    nameEl.textContent = label;
    nameEl.style.fontSize = `${this._config.name_size}px`;
    nameEl.style.fontWeight = '600';
    nameEl.style.display = this._config.show_name ? 'block' : 'none';

    const stateEl = document.createElement('div');
    stateEl.className = 'fensterkarte-state';
    stateEl.textContent = displayState;
    stateEl.style.opacity = '0.9';
    stateEl.style.fontSize = '0.95rem';
    stateEl.style.display = this._config.show_state ? 'block' : 'none';

    const extra = document.createElement('div');
    extra.className = 'fensterkarte-extra';
    extra.style.display = 'flex';
    extra.style.flexDirection = 'column';
    extra.style.gap = '4px';
    extra.style.fontSize = '0.88rem';
    extra.style.opacity = '0.88';

    if (durationInfo.label) {
      const durationLine = document.createElement('div');
      durationLine.textContent = durationInfo.label;
      extra.appendChild(durationLine);
    }

    if (humidityInfo.label) {
      const humidityLine = document.createElement('div');
      humidityLine.textContent = humidityInfo.label;
      extra.appendChild(humidityLine);
    }

    if (this._config.show_name && this._config.name_position === 'top') {
      content.appendChild(nameEl);
      content.appendChild(stateEl);
    } else {
      content.appendChild(stateEl);
      content.appendChild(nameEl);
    }

    content.appendChild(extra);

    if (this._config.icon_position === 'top' || this._config.icon_position === 'bottom') {
      wrapper.appendChild(icon);
      wrapper.appendChild(content);
      if (this._config.icon_position === 'bottom') {
        wrapper.style.flexDirection = 'column-reverse';
      }
    } else if (this._config.icon_position === 'left') {
      wrapper.appendChild(icon);
      wrapper.appendChild(content);
    } else {
      wrapper.appendChild(content);
      wrapper.appendChild(icon);
    }

    root.appendChild(wrapper);
    this._renderRoot(root);
  }

  _renderRoot(child) {
    this.shadowRoot.innerHTML = '';
    const style = document.createElement('style');
    style.textContent = `
      .fensterkarte-root {
        font-family: var(--ha-card-font-family, inherit);
        color: var(--primary-text-color, #000);
      }
      ha-icon {
        color: var(--paper-item-icon-color, #3F51B5);
      }
      @keyframes fensterkarte-pulse {
        0%, 100% { border-color: var(--fk-border-color); }
        50% { border-color: transparent; }
      }
      .fensterkarte-pulse {
        animation: fensterkarte-pulse 1.5s ease-in-out infinite;
      }
    `;
    this.shadowRoot.appendChild(style);
    this.shadowRoot.appendChild(child);
  }

  _isOpen(state) {
    const normalized = String(state).toLowerCase();
    return ['open', 'on', 'true', 'opened'].includes(normalized);
  }

  _formatState(state) {
    const normalized = String(state).toLowerCase();
    if (['open', 'opened', 'on', 'true'].includes(normalized)) return 'Geöffnet';
    if (['closed', 'off', 'false'].includes(normalized)) return 'Geschlossen';
    return state;
  }

  _getFlexDirection() {
    if (this._config.icon_position === 'top' || this._config.icon_position === 'bottom') return 'column';
    return 'row';
  }

  _getTextDirection() {
    if (this._config.name_position === 'top' || this._config.name_position === 'bottom') return 'column';
    return 'row';
  }

  _colorToRgb(color) {
    const named = {
      green:  [0, 128, 0],
      yellow: [255, 255, 0],
      orange: [255, 165, 0],
      red:    [255, 0, 0],
      blue:   [0, 0, 255],
      purple: [128, 0, 128],
      brown:  [165, 42, 42],
      black:  [0, 0, 0],
      white:  [255, 255, 255],
    };
    if (named[color]) return named[color];
    if (typeof color === 'string' && color.startsWith('#')) {
      const hex = color.slice(1);
      if (hex.length === 3) {
        return [
          parseInt(hex[0] + hex[0], 16),
          parseInt(hex[1] + hex[1], 16),
          parseInt(hex[2] + hex[2], 16),
        ];
      }
      if (hex.length === 6) {
        return [
          parseInt(hex.slice(0, 2), 16),
          parseInt(hex.slice(2, 4), 16),
          parseInt(hex.slice(4, 6), 16),
        ];
      }
    }
    return null;
  }

  _applyOpacity(color, opacity) {
    if (opacity >= 1) return color;
    const rgb = this._colorToRgb(color);
    if (!rgb) return color;
    return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${opacity})`;
  }

  _mixColors(color1, color2) {
    const rgb1 = this._colorToRgb(color1);
    const rgb2 = this._colorToRgb(color2);
    if (!rgb1 || !rgb2) return color1;
    return `rgb(${Math.round((rgb1[0] + rgb2[0]) / 2)}, ${Math.round((rgb1[1] + rgb2[1]) / 2)}, ${Math.round((rgb1[2] + rgb2[2]) / 2)})`;
  }

  _buildDurationInfo(entity, isOpen) {
    const info = { label: '', active: false };
    if (!this._config.duration_enabled || !isOpen) return info;

    let duration = 0;
    if (this._config.duration_entity) {
      const durationState = this._hass.states[this._config.duration_entity];
      if (durationState && !isNaN(Number(durationState.state))) {
        duration = Number(durationState.state);
      }
    }

    if (!duration && entity && entity.last_changed) {
      duration = Math.floor((new Date() - new Date(entity.last_changed)) / 1000);
    }

    const threshold = Number(this._config.duration_threshold) || 0;
    const formatted = this._formatDuration(duration);
    info.label = `Offen seit ${formatted}`;
    info.active = threshold > 0 && duration >= threshold && this._isTemperatureConditionMet();
    if (info.active) {
      info.label += ' (Warnung aktiviert)';
    }
    info.duration = duration;
    return info;
  }

  _isTemperatureConditionMet() {
    if (!this._config.temperature_warning_enabled || !this._config.temperature_entity) return true;
    const tempState = this._hass.states[this._config.temperature_entity];
    if (!tempState || isNaN(Number(tempState.state))) return true;

    const temp = Number(tempState.state);
    const threshold = Number(this._config.temperature_threshold);
    return this._config.temperature_threshold_mode === 'above'
      ? temp >= threshold
      : temp <= threshold;
  }

  _buildHumidityInfo() {
    const info = { label: '', active: false };
    if (!this._config.humidity_warning_enabled || !this._config.humidity_entity) return info;

    const humidityState = this._hass.states[this._config.humidity_entity];
    if (!humidityState || isNaN(Number(humidityState.state))) return info;
    const humidity = Number(humidityState.state);
    const threshold = Number(this._config.humidity_warning_threshold) || 0;
    if (humidity >= threshold) {
      info.active = true;
      info.label = `Feuchtigkeit ${humidity}% (Schwelle: ${threshold}%)`;
    } else {
      info.label = `Feuchtigkeit ${humidity}%`;
    }
    return info;
  }

  _computeBorder(isOpen, durationInfo, humidityInfo) {
    const baseOpacity = Number(this._config.border_opacity) || 1;
    const humidityActive = humidityInfo.active;
    const durationActive = durationInfo.active;

    if (humidityActive && durationActive) {
      const humColor = this._config.humidity_border_color || 'red';
      const durColor = this._config.duration_border_color || 'orange';
      const mixedOpacity = (
        (Number(this._config.humidity_border_opacity) || 1) +
        (Number(this._config.duration_border_opacity) || 1)
      ) / 2;
      return {
        color: this._applyOpacity(this._mixColors(humColor, durColor), mixedOpacity),
        pulse: !!this._config.pulse_enabled,
      };
    }

    if (humidityActive) {
      return {
        color: this._applyOpacity(
          this._config.humidity_border_color || 'red',
          Number(this._config.humidity_border_opacity) || baseOpacity
        ),
        pulse: !!this._config.pulse_enabled,
      };
    }

    if (durationActive) {
      return {
        color: this._applyOpacity(
          this._config.duration_border_color || 'orange',
          Number(this._config.duration_border_opacity) || baseOpacity
        ),
        pulse: !!this._config.pulse_enabled,
      };
    }

    let baseColor = this._config.border_color || 'var(--divider-color, #a0a0a0)';
    if (this._config.border_color_entity) {
      const borderEntity = this._hass.states[this._config.border_color_entity];
      if (borderEntity && borderEntity.state) {
        baseColor = borderEntity.state;
      }
    }
    return { color: this._applyOpacity(baseColor, baseOpacity), pulse: false };
  }

  _formatDuration(seconds) {
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    if (hours > 0) return `${hours}h ${remainingMinutes}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }
}

customElements.define('fensterkarte-card', FensterkarteCard);
