import { LitElement, html, css } from 'lit';
import { customElement, property, state, query } from 'lit/decorators.js';
import { live } from 'lit/directives/live.js';

export interface SelectOption {
  value: string;
  label: string;
}

@customElement('nl-select')
export class Select extends LitElement {
  @property({ type: Array })
  options: SelectOption[] = [];

  @property({ type: String })
  value = '';

  @property({ type: Array })
  values: string[] = [];

  @property({ type: Boolean })
  multi = false;

  @property({ type: String })
  placeholder = 'Select...';

  @state() private _open = false;
  @state() private _searchText = '';
  @state() private _focusedIndex = -1;
  @state() private _filteredOptions: SelectOption[] = [];

  @query('.search-input') private _searchInput!: HTMLInputElement;

  constructor() {
    super();
    this.tabIndex = 0;
  }

  override connectedCallback() {
    super.connectedCallback();
    document.addEventListener('click', this._handleClickOutside);
    this.addEventListener('keydown', this._handleKeydown);
    this.addEventListener('focusout', this._handleFocusOut);
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener('click', this._handleClickOutside);
    this.removeEventListener('keydown', this._handleKeydown);
    this.removeEventListener('focusout', this._handleFocusOut);
  }

  override updated(changedProperties: Map<string | symbol, unknown>) {
    if (changedProperties.has('_focusedIndex') && this._focusedIndex > -1) {
      this._scrollIntoView();
    }
  }

  private _scrollIntoView() {
    const focusedOption = this.shadowRoot?.querySelector('.option.focused');
    focusedOption?.scrollIntoView({ block: 'nearest' });
  }

  private _handleClickOutside = (e: MouseEvent) => {
    if (this._open && !e.composedPath().includes(this)) {
      this._toggle(false);
    }
  };

  private _handleFocusOut = (e: FocusEvent) => {
    if (this._open && !this.shadowRoot?.contains(e.relatedTarget as Node)) {
      this._toggle(false);
    }
  };

  private async _toggle(open = !this._open) {
    this._open = open;
    if (this._open) {
      this._filterOptions();
      await this.updateComplete;
      this._searchInput?.focus();
    } else {
      this._searchText = '';
      this._focusedIndex = -1;
    }
  }

  private _removeValue(valueToRemove: string, event: Event) {
    event.stopPropagation();
    const newValues = this.values.filter(v => v !== valueToRemove);
    this.values = newValues;
    this.dispatchEvent(new CustomEvent('change', { detail: { values: this.values } }));
  }

  private _handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Tab') {
      if (this._open) {
        this._toggle(false);
      }
      return;
    }

    // Prevent default for keys that we will handle, but allow normal typing in search input
    if ([' ', 'Enter', 'Escape', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
      e.preventDefault();
    }

    // Only prevent backspace if we're not in search mode or if search is empty and we want to remove tags
    if (e.key === 'Backspace' && (!this._open || (this.multi && this._searchText === '' && this.values.length > 0))) {
      e.preventDefault();
    }

    if (!this._open) {
      if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        this._toggle(true);
        if (e.key === 'ArrowDown') this._focusedIndex = 0;
        if (e.key === 'ArrowUp') this._focusedIndex = this._filteredOptions.length - 1;
      }
      return;
    }

    switch (e.key) {
      case 'Escape':
        this._toggle(false);
        this.focus();
        break;
      case 'ArrowDown':
        this._focusedIndex = (this._focusedIndex + 1) % this._filteredOptions.length;
        break;
      case 'ArrowUp':
        this._focusedIndex = (this._focusedIndex - 1 + this._filteredOptions.length) % this._filteredOptions.length;
        break;
      case 'Enter':
        if (this._focusedIndex > -1) {
          this._selectOption(this._filteredOptions[this._focusedIndex]);
        }
        break;
      case 'Backspace':
        if (this.multi && this._searchText === '' && this.values.length > 0) {
          // Remove last selected value when backspace is pressed with empty search
          const newValues = [...this.values];
          newValues.pop();
          this.values = newValues;
          this.dispatchEvent(new CustomEvent('change', { detail: { values: this.values } }));
        }
        break;
    }
  }

  private _selectOption(option: SelectOption) {
    if (this.multi) {
      const currentValues = [...this.values];
      const index = currentValues.indexOf(option.value);

      if (index > -1) {
        // Remove if already selected
        currentValues.splice(index, 1);
      } else {
        // Add if not selected
        currentValues.push(option.value);
      }

      this.values = currentValues;
      this.dispatchEvent(new CustomEvent('change', { detail: { values: this.values } }));

      // Keep dropdown open for multi-select
      this._filterOptions();
      this._focusedIndex = -1;
      setTimeout(() => this._searchInput?.focus(), 0);
    } else {
      this.value = option.value;
      this.dispatchEvent(new CustomEvent('change', { detail: { value: this.value } }));
      this._toggle(false);
      this.focus();
    }
  }

  private _handleSearchInput(e: Event) {
    const input = e.target as HTMLInputElement;
    this._searchText = input.value;
    this._filterOptions();
    this._focusedIndex = 0;
  }

  private _filterOptions() {
    this._filteredOptions = this.options.filter(option =>
      option.label.toLowerCase().includes(this._searchText.toLowerCase())
    );
  }

  override render() {
    const selectedOption = this.options.find((o) => o.value === this.value);
    const selectedOptions = this.multi ? this.options.filter(o => this.values.includes(o.value)) : [];
    const activeDescendant = this._focusedIndex > -1 && this._filteredOptions[this._focusedIndex]
      ? `option-${this._filteredOptions[this._focusedIndex].value}`
      : '';

    return html`
      <div
        class="control"
        @click=${() => this._toggle()}
        role="combobox"
        aria-expanded=${this._open}
        aria-haspopup="listbox"
        aria-owns="listbox"
        aria-activedescendant=${activeDescendant}
      >
        <div class="value-container">
          <slot name="icon"></slot>
          ${this._open
            ? html`
                <div class="search-container">
                  ${this.multi && selectedOptions.length > 0
                    ? html`<span class="current-count">${selectedOptions.length} selected</span>`
                    : !this.multi && selectedOption
                    ? html`<span class="current-value">${selectedOption.label}:</span>`
                    : ''
                  }
                  <input
                    class="search-input"
                    type="text"
                    .value=${live(this._searchText)}
                    @input=${this._handleSearchInput}
                    @click=${(e: Event) => e.stopPropagation()}
                    placeholder=${this._searchText === '' ? (this.multi ? 'Search...' : 'Type to search...') : ''}
                  />
                </div>
              `
            : this.multi
            ? html`
                <div class="multi-value-container">
                  ${selectedOptions.length > 0
                    ? selectedOptions.length === 1
                      ? html`
                          <span class="tag">
                            ${selectedOptions[0].label}
                            <button
                              class="tag-remove"
                              @click=${(e: Event) => this._removeValue(selectedOptions[0].value, e)}
                              aria-label="Remove ${selectedOptions[0].label}"
                            >×</button>
                          </span>
                        `
                      : html`<span class="count-indicator">${selectedOptions.length} items selected</span>`
                    : html`<span class="placeholder">${this.placeholder}</span>`
                  }
                </div>
              `
            : html`<span class="value-text">${selectedOption ? selectedOption.label : this.placeholder}</span>`
          }
        </div>
        <svg class="dropdown-arrow" width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M4 6L8 10L12 6" stroke="currentColor" stroke-width="1.5"/>
        </svg>
      </div>
      ${this._open
        ? html`
            <div id="listbox" class="dropdown" role="listbox">
              ${this._filteredOptions.map(
                (option, index) =>
                  html`<div
                    id="option-${option.value}"
                    class="option ${index === this._focusedIndex ? 'focused' : ''} ${this.multi && this.values.includes(option.value) ? 'selected' : ''}"
                    @click=${() => this._selectOption(option)}
                    role="option"
                    aria-selected=${this.multi ? this.values.includes(option.value) : option.value === this.value}
                  >
                    ${this.multi ? html`
                      <div class="option-content">
                        <input
                          type="checkbox"
                          class="option-checkbox"
                          .checked=${this.values.includes(option.value)}
                          @click=${(e: Event) => e.stopPropagation()}
                        />
                        <span>${option.label}</span>
                      </div>
                    ` : option.label}
                  </div>`
              )}
            </div>
          `
        : ''}
    `;
  }

  static override styles = css`
    :host {
      display: inline-block;
      position: relative;
      width: 100%;
      font-family: var(--nl-font-family-sans);
    }
    :host(:focus) { outline: none; }
    :host(:focus) .control { border-color: var(--nl-color-primary); }

    .control {
      display: flex;
      align-items: center;
      width: 100%;
      min-height: 36px;
      padding: 0 12px;
      border: 1px solid var(--nl-surface-border);
      border-radius: var(--nl-border-radius);
      background: var(--nl-surface-control);
      color: var(--nl-text-primary);
      cursor: pointer;
      gap: 8px;
      box-sizing: border-box;
    }

    .value-container {
      display: flex;
      align-items: center;
      flex: 1;
      min-width: 0;
      gap: 6px;
    }

    ::slotted([slot='icon']) {
      color: var(--nl-text-secondary);
      flex-shrink: 0;
    }

    .search-container {
      display: flex;
      align-items: center;
      flex: 1;
      gap: 6px;
    }

    .search-input, .value-text {
      flex: 1;
      min-width: 40px; /* Ensure minimum space for typing */
      background: none;
      border: none;
      padding: 0;
      font-size: inherit;
      color: inherit;
    }
    .search-input:focus { outline: none; }
    .search-input::placeholder {
      color: var(--nl-text-secondary);
      opacity: 0.7;
    }

    .value-text, .placeholder {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      color: var(--nl-text-secondary);
    }

    .current-value, .current-count, .count-indicator {
      color: var(--nl-text-secondary);
      font-size: 0.875rem;
      white-space: nowrap;
      flex-shrink: 0;
      max-width: 120px;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .multi-value-container {
      display: flex;
      align-items: center;
      flex: 1;
      min-width: 0;
    }

    .tag {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      background: var(--nl-color-primary);
      color: var(--nl-text-on-primary);
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 0.875rem;
      max-width: calc(100% - 40px); /* Leave space for arrow and padding */
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      flex-shrink: 1;
    }

    .tag-remove {
      background: none;
      border: none;
      color: inherit;
      cursor: pointer;
      padding: 0;
      width: 14px;
      height: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      font-size: 12px;
    }
    .tag-remove:hover {
      background: rgba(255, 255, 255, 0.2);
    }

    .dropdown-arrow {
      flex-shrink: 0;
      color: var(--nl-text-secondary);
    }

    .dropdown {
      position: absolute;
      top: calc(100% + 4px);
      left: 0;
      right: 0;
      background: var(--nl-surface-popover);
      border: 1px solid var(--nl-surface-border);
      border-radius: var(--nl-border-radius);
      box-shadow: var(--nl-shadow-md);
      z-index: 10001;
      max-height: 200px;
      overflow-y: auto;
    }

    .option {
      display: flex;
      align-items: center;
      padding: 8px 12px;
      cursor: pointer;
      color: var(--nl-text-primary);
    }
    .option:hover, .option.focused {
      background: var(--nl-color-primary);
      color: var(--nl-text-on-primary);
    }
    .option.selected {
      background: var(--nl-surface-hover);
    }
    .option.selected:hover, .option.selected.focused {
      background: var(--nl-color-primary);
      color: var(--nl-text-on-primary);
    }

    .option-content {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .option-checkbox {
      margin: 0;
    }
  `;
}
