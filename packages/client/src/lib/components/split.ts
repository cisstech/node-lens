import { LitElement, css, html } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';

@customElement('nl-split')
export class NlSplit extends LitElement {
  @property({ type: String }) direction: 'horizontal' | 'vertical' = 'horizontal';
  @property({ type: Number }) min = 120;
  @property({ type: Number }) initial = 280;

  @query('.divider') private divider!: HTMLElement;

  @state() private size = 0;
  @state() private lastKnownSize = 0;

  private isDragging = false;
  private startPosition = 0;
  private startSize = 0;

  override connectedCallback() {
    super.connectedCallback();
    this.size = this.initial;
    this.lastKnownSize = this.initial;
  }

  override firstUpdated() {
    this.divider.addEventListener('mousedown', this.handleMouseDown);
    document.addEventListener('mousemove', this.handleMouseMove);
    document.addEventListener('mouseup', this.handleMouseUp);
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this.divider?.removeEventListener('mousedown', this.handleMouseDown);
    document.removeEventListener('mousemove', this.handleMouseMove);
    document.removeEventListener('mouseup', this.handleMouseUp);
  }

  private handleMouseDown = (event: MouseEvent) => {
    if ((event.target as HTMLElement).closest('.divider-controls')) return;
    event.preventDefault();
    this.isDragging = true;
    const isHorizontal = this.direction === 'horizontal';
    this.startPosition = isHorizontal ? event.clientX : event.clientY;
    this.startSize = this.size;
    this.applyDragState();
  };

  private handleMouseMove = (event: MouseEvent) => {
    if (!this.isDragging) return;
    event.preventDefault();
    const isHorizontal = this.direction === 'horizontal';
    const currentPosition = isHorizontal ? event.clientX : event.clientY;
    const delta = currentPosition - this.startPosition;
    let newSize = this.startSize + delta;
    const containerRect = this.getBoundingClientRect();
    const maxContainerSize = isHorizontal ? containerRect.width : containerRect.height;
    const maxAllowedSize = maxContainerSize - 4;
    if (newSize < this.min) newSize = this.min;
    if (newSize > maxAllowedSize - this.min) newSize = maxAllowedSize - this.min;
    this.size = Math.max(0, Math.min(newSize, maxAllowedSize));
    this.lastKnownSize = this.size > 0 ? this.size : this.lastKnownSize;
  };

  private handleMouseUp = () => {
    if (!this.isDragging) return;
    this.isDragging = false;
    this.cleanupDragState();
  };

  private closePane = (e: Event) => {
    e.stopPropagation();
    if (this.size > 0) {
      this.lastKnownSize = this.size;
    }
    this.size = 0;
  };

  private openPane = (e: Event) => {
    e.stopPropagation();
    this.size = this.lastKnownSize > 0 ? this.lastKnownSize : this.initial;
  };

  private applyDragState = () => {
    document.body.style.userSelect = 'none';
    document.body.style.cursor = this.direction === 'horizontal' ? 'col-resize' : 'row-resize';
    this.divider.classList.add('dragging');
  };

  private cleanupDragState = () => {
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
    this.divider?.classList.remove('dragging');
  };

  override render() {
    const isClosed = this.size === 0;
    const closeIcon = this.direction === 'horizontal' ? 'chevron-left' : 'chevron-up';
    const openIcon = this.direction === 'horizontal' ? 'chevron-right' : 'chevron-down';

    return html`
      <div class="container ${this.direction}">
        <div class="first-pane pane" style="flex-basis: ${this.size}px">
          <slot name="start"></slot>
        </div>
        <div class="divider">
          <div class="divider-controls">
            ${isClosed
              ? html`
                  <button class="control-button" @click=${this.openPane} title="Open pane">
                    <nl-codicon .icon=${openIcon}></nl-codicon>
                  </button>
                `
              : html`
                  <button class="control-button" @click=${this.closePane} title="Close pane">
                    <nl-codicon .icon=${closeIcon}></nl-codicon>
                  </button>
                `}
          </div>
        </div>
        <div class="second-pane pane">
          <slot name="end"></slot>
        </div>
      </div>
    `;
  }

  static override styles = css`
    :host {
      display: block;
      height: 100%;
      width: 100%;
    }
    .container {
      display: flex;
      height: 100%;
      width: 100%;
    }
    .container.horizontal { flex-direction: row; }
    .container.vertical { flex-direction: column; }

    .pane {
      overflow: auto;
      min-width: 0;
      min-height: 0;
    }
    .first-pane { flex-shrink: 0; }
    .second-pane { flex: 1; }

    /* --- Modern Floating Scrollbars --- */
    /* For Webkit browsers (Chrome, Safari, Edge) */
    .pane::-webkit-scrollbar {
      width: 10px;
      height: 10px;
    }
    .pane::-webkit-scrollbar-track {
      background: transparent;
    }
    .pane::-webkit-scrollbar-thumb {
      background: var(--nl-surface-border, rgba(128, 128, 128, 0.3));
      border-radius: 5px;
      border: 2px solid transparent;
      background-clip: content-box;
      opacity: 0;
      transition: opacity 0.2s;
    }
    .pane:hover::-webkit-scrollbar-thumb {
      opacity: 1;
    }
    /* For Firefox */
    .pane {
      scrollbar-width: thin;
      scrollbar-color: var(--nl-surface-border, rgba(128, 128, 128, 0.3)) transparent;
    }

    .divider {
      background: var(--nl-surface-border);
      flex-shrink: 0;
      transition: background-color 0.2s ease;
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .divider:hover { background: var(--nl-color-primary); }
    .divider.dragging { background: var(--nl-color-primary); }
    .horizontal .divider { width: 4px; cursor: col-resize; }
    .vertical .divider { height: 4px; cursor: row-resize; }

    /* --- Open/Close Button Styles --- */
    .divider-controls {
      position: absolute;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      transition: opacity 0.2s ease-in-out;
      pointer-events: none;
    }
    .divider:hover .divider-controls {
      opacity: 1;
      pointer-events: auto;
    }
    .control-button {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: var(--nl-surface-raised);
      border: 1px solid var(--nl-surface-border);
      color: var(--nl-text-primary);
      cursor: pointer;
      padding: 0;
      transition: transform 0.2s ease-in-out;
    }
    .control-button:hover {
      background: var(--nl-surface-hover);
      transform: scale(1.1);
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'nl-split': NlSplit;
  }
}
