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
    if (!this.shadowRoot) return;
    if (!this._config) return;

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
    wrapper.style.opacity = border.opacity;
    wrapper.style.borderRadius = '14px';
    wrapper.style.background = 'var(--card-background-color, rgba(255,255,255,0.9))';
    wrapper.style.boxShadow = 'var(--ha-card-box-shadow, none)';
    wrapper.style.padding = '14px';
    wrapper.style.display = 'flex';
    wrapper.style.alignItems = 'center';
    wrapper.style.gap = '12px';
    wrapper.style.flexDirection = this._getFlexDirection();

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
    } else {
      if (this._config.icon_position === 'left') {
        wrapper.appendChild(icon);
        wrapper.appendChild(content);
      } else {
        wrapper.appendChild(content);
        wrapper.appendChild(icon);
      }
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
    `;
    this.shadowRoot.appendChild(style);
    this.shadowRoot.appendChild(child);
  }

  _isOpen(state) {
    const normalized = String(state).toLowerCase();
    return ['open', 'on', 'true', 'opened', 'openable'].includes(normalized);
  }

  _formatState(state) {
    const normalized = String(state).toLowerCase();
    if (['open', 'opened', 'on', 'true'].includes(normalized)) return 'Geöffnet';
    if (['closed', 'off', 'false'].includes(normalized)) return 'Geschlossen';
    return state;
  }

  _getFlexDirection() {
    if (this._config.icon_position === 'top') return 'column';
    if (this._config.icon_position === 'bottom') return 'column';
    return 'row';
  }

  _getTextDirection() {
    if (this._config.name_position === 'top' || this._config.name_position === 'bottom') return 'column';
    return 'row';
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
      info.label += ` (Warnung aktiviert)`;
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
    if (this._config.temperature_threshold_mode === 'above') {
      return temp >= threshold;
    }
    return temp <= threshold;
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
    const opacity = Number(this._config.border_opacity) || 1;
    let color = this._config.border_color || 'var(--divider-color, #a0a0a0)';

    if (humidityInfo.active) {
      color = this._config.humidity_border_color || 'red';
      return { color, opacity: Number(this._config.humidity_border_opacity) || opacity };
    }

    if (durationInfo.active) {
      color = this._config.duration_border_color || 'orange';
      return { color, opacity: Number(this._config.duration_border_opacity) || opacity };
    }

    if (this._config.border_color_entity) {
      const borderEntity = this._hass.states[this._config.border_color_entity];
      if (borderEntity && borderEntity.state) {
        color = borderEntity.state;
      }
    }

    return { color, opacity };
  }

  _formatDuration(seconds) {
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${remainingMinutes}m`;
    }
    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
  }
}

customElements.define('fensterkarte-card', FensterkarteCard);
