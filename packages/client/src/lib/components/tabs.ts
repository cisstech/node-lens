import { LitElement, html, css } from 'lit';
import {
  customElement,
  property,
  queryAssignedElements,
} from 'lit/decorators.js';

@customElement('nl-tabs')
export class Tabs extends LitElement {
  @property({ type: String, reflect: true })
  variant: 'underline' | 'pills' | 'cards' = 'underline';

  @property({ type: String, reflect: true })
  activeKey = '';

  @property({ type: Boolean, reflect: true })
  stickyTabs = false;

  @queryAssignedElements({ slot: 'tabs', selector: 'nl-tab' })
  private tabs!: Tab[];

  @queryAssignedElements({ slot: 'panels', selector: 'nl-tab-panel' })
  private panels!: TabPanel[];

  static override styles = css`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
      --nl-tabs-list-background: transparent;
      --nl-tabs-list-sticky-background: var(--nl-surface-app);

      /* Used for the fade effect mask */
      --nl-tabs-fade-color: var(--nl-tabs-list-sticky-background);
    }
    .tab-list {
      display: flex;
      flex-shrink: 0;
      background: var(--nl-tabs-list-background);

      /* Responsive Scrolling */
      overflow-x: auto;
      /* Prevent tabs from wrapping to a new line */
      white-space: nowrap;

      /* Hide the native scrollbar */
      scrollbar-width: none; /* For Firefox */
    }
    /* Hide scrollbar for Chrome, Safari, and Opera */
    .tab-list::-webkit-scrollbar {
      display: none;
    }

    :host([stickyTabs]) .tab-list {
      position: sticky;
      top: 0;
      z-index: 10;
      background: var(--nl-tabs-list-sticky-background);
    }

    /* On sticky, the fade should be based on the sticky background color */
    :host([stickyTabs]) {
      --nl-tabs-fade-color: var(--nl-tabs-list-sticky-background);
    }

    .panels {
      flex: 1;
      min-height: 0;
      overflow: hidden;
    }
  `;

  override render() {
    return html`
      <div class="tab-list" @tab-click=${this.handleTabClick}>
        <slot name="tabs" @slotchange=${this.handleSlotChange}></slot>
      </div>
      <div class="panels">
        <slot name="panels" @slotchange=${this.handleSlotChange}></slot>
      </div>
    `;
  }

  private handleTabClick(e: CustomEvent<{ key: string }>) {
    this.activeKey = e.detail.key;
    this.updateActiveState();
  }

  private handleSlotChange() {
    this.updateActiveState();
  }

  private updateActiveState() {
    this.tabs?.forEach(tab => {
      tab.toggleAttribute('active', tab.key === this.activeKey);
      tab.setAttribute('variant', this.variant);
    });
    this.panels?.forEach(panel => {
      panel.toggleAttribute('active', panel.key === this.activeKey);
    });
  }

  override firstUpdated() {
    this.updateActiveState();
  }

  override updated(changedProps: Map<string, unknown>) {
    if (changedProps.has('activeKey')) {
      this.updateActiveState();
    }
  }
}

@customElement('nl-tab')
export class Tab extends LitElement {
  @property({ type: String })
  key = '';

  static override styles = css`
    :host {
      cursor: pointer;
      padding: var(--nl-spacing-sm) var(--nl-spacing-md);
      transition:
        color 0.2s,
        border-color 0.2s,
        background-color 0.2s;
    }

    /* Underline variant */
    :host([variant='underline']) {
      border-bottom: 2px solid transparent;
      margin-bottom: -1px;
    }
    :host([variant='underline'][active]) {
      border-color: var(--nl-color-primary);
      color: var(--nl-color-primary);
    }

    /* Pills variant */
    :host([variant='pills']) {
      border-radius: var(--nl-border-radius);
      margin-right: var(--nl-spacing-xs);
    }
    :host([variant='pills'][active]) {
      background-color: var(--nl-color-primary);
      color: var(--nl-text-on-primary);
    }

    /* Cards variant */
    :host([variant='cards'][active]) {
      background-color: var(--nl-surface-raised);
    }
  `;

  override render() {
    return html`<slot></slot>`;
  }

  constructor() {
    super();
    this.addEventListener('click', this.handleClick);
  }

  private handleClick() {
    this.dispatchEvent(
      new CustomEvent('tab-click', {
        detail: { key: this.key },
        bubbles: true,
        composed: true,
      })
    );
  }
}

@customElement('nl-tab-panel')
export class TabPanel extends LitElement {
  @property({ type: String })
  key = '';

  static override styles = css`
    :host {
      display: none;
      height: 100%;
      overflow-y: auto;
      padding: var(--nl-spacing-md) 0;
      box-sizing: border-box;
    }
    :host([active]) {
      display: block;
    }
  `;

  override render() {
    return html`<slot></slot>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'nl-tabs': Tabs;
    'nl-tab': Tab;
    'nl-tab-panel': TabPanel;
  }
}
