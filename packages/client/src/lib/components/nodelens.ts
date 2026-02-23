import { LitElement, css, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { NodeLensState } from '../types';
import './plugin-view';

type DockPosition = 'bottom' | 'right';

const LS_KEYS = {
  VISIBLE: 'nl.visible',
  HUD_VISIBLE: 'nl.hud.visible',
  DOCK_POS: 'nl.dock.pos',
  HEIGHT: 'nl.dock.height',
  WIDTH: 'nl.dock.width',
  LAST_PLUGIN: 'nl.last.plugin',
};

@customElement('node-lens')
export class NodeLens extends LitElement {
  @property({ type: Object }) state?: NodeLensState;
  @property({ type: Boolean }) pushContent = false;

  @state() private hudPos = { x: 40, y: 40 };
  @state() private hudDragging = false;
  @state() private dragOffset = { x: 0, y: 0 };
  @state() private hudVisible = true;
  @state() private dockVisible = false;
  @state() private dockPosition: DockPosition = 'bottom';
  @state() private dockHeight = 360;
  @state() private dockWidth = 480;
  @state() private resizing = false;
  @state() private activePlugin: string | null = null;
  @state() private bodyScrollLocked = false;

  private originalPaddingBottom = '';
  private originalPaddingRight = '';
  private savedBodyOverflow = '';
  private savedBodyOverscrollBehavior = '';
  private savedBodyTouchAction = '';

  override connectedCallback(): void {
    super.connectedCallback();
    window.addEventListener('keydown', this.onKey);
    this.restorePrefs();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    window.removeEventListener('keydown', this.onKey);
    this.resetBodyPadding();
    this.unlockBodyScroll();
  }

  protected override updated(changed: Map<string, unknown>) {
    super.updated(changed);
    if (
      changed.has('dockVisible') ||
      changed.has('dockHeight') ||
      changed.has('dockWidth') ||
      changed.has('dockPosition') ||
      changed.has('pushContent')
    ) {
      this.updateBodyPadding();
    }

    if (changed.has('dockVisible') && !this.dockVisible) {
      this.unlockBodyScroll();
    }
  }

  private restorePrefs() {
    try {
      const vis = localStorage.getItem(LS_KEYS.VISIBLE);
      this.dockVisible = vis ? vis === '1' : false;

      const pos = localStorage.getItem(LS_KEYS.DOCK_POS) as DockPosition | null;
      if (pos === 'right' || pos === 'bottom') this.dockPosition = pos;

      const h = Number(localStorage.getItem(LS_KEYS.HEIGHT));
      if (!Number.isNaN(h) && h > 120) this.dockHeight = h;

      const w = Number(localStorage.getItem(LS_KEYS.WIDTH));
      if (!Number.isNaN(w) && w > 260) this.dockWidth = w;

      const last = localStorage.getItem(LS_KEYS.LAST_PLUGIN);
      if (last) this.activePlugin = last;

      const hudVis = localStorage.getItem(LS_KEYS.HUD_VISIBLE);
      this.hudVisible = hudVis ? hudVis === '1' : true;
    } catch {
      /* no-op */
    }
  }

  private persistPrefs() {
    localStorage.setItem(LS_KEYS.VISIBLE, this.dockVisible ? '1' : '0');
    localStorage.setItem(LS_KEYS.DOCK_POS, this.dockPosition);
    localStorage.setItem(LS_KEYS.HEIGHT, String(this.dockHeight));
    localStorage.setItem(LS_KEYS.WIDTH, String(this.dockWidth));
    localStorage.setItem(LS_KEYS.LAST_PLUGIN, this.activePlugin ?? '');
    localStorage.setItem(LS_KEYS.HUD_VISIBLE, this.hudVisible ? '1' : '0');
  }

  private lockBodyScroll = () => {
    if (this.bodyScrollLocked) return;
    const b = document.body;
    this.savedBodyOverflow = b.style.overflow;
    this.savedBodyOverscrollBehavior = b.style.overscrollBehavior || '';
    this.savedBodyTouchAction = b.style.touchAction || '';
    b.style.overflow = 'hidden';
    b.style.overscrollBehavior = 'none';
    b.style.touchAction = 'none';
    this.bodyScrollLocked = true;
  };

  private unlockBodyScroll = () => {
    if (!this.bodyScrollLocked) return;
    const b = document.body;
    b.style.overflow = this.savedBodyOverflow;
    b.style.overscrollBehavior = this.savedBodyOverscrollBehavior;
    b.style.touchAction = this.savedBodyTouchAction;
    this.bodyScrollLocked = false;
  };

  private updateBodyPadding() {
    if (!this.pushContent) return;

    if (!this.originalPaddingBottom && !this.originalPaddingRight) {
      this.originalPaddingBottom = document.body.style.paddingBottom || '';
      this.originalPaddingRight = document.body.style.paddingRight || '';
    }

    if (this.dockVisible) {
      if (this.dockPosition === 'bottom') {
        document.body.style.paddingBottom = `${this.dockHeight}px`;
        document.body.style.paddingRight = this.originalPaddingRight;
      } else {
        document.body.style.paddingRight = `${this.dockWidth}px`;
        document.body.style.paddingBottom = this.originalPaddingBottom;
      }
      document.body.classList.add('nl-push-active');
    } else {
      this.resetBodyPadding();
    }
  }

  private resetBodyPadding() {
    if (!this.pushContent) return;
    document.body.style.paddingBottom = this.originalPaddingBottom;
    document.body.style.paddingRight = this.originalPaddingRight;
    document.body.classList.remove('nl-push-active');
  }

  private onKey = (e: KeyboardEvent) => {
    const isToggle = (e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'l';
    if (isToggle) {
      e.preventDefault();
      if (this.dockVisible) {
        this.onClose();
      } else {
        this.onOpen();
      }
      return;
    }
  };

  private onDockEnter = () => this.lockBodyScroll();
  private onDockLeave = () => this.unlockBodyScroll();

  private onHudMouseDown = (e: MouseEvent) => {
    const rect = (this.renderRoot.querySelector('.hud') as HTMLElement).getBoundingClientRect();
    this.dragOffset = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    document.addEventListener('mousemove', this.onHudDrag);
    document.addEventListener('mouseup', this.onHudMouseUp);
  };

  private onHudDrag = (e: MouseEvent) => {
    this.hudDragging = true;
    const newX = e.clientX - this.dragOffset.x;
    const newY = e.clientY - this.dragOffset.y;
    const maxX = window.innerWidth - 260;
    const maxY = window.innerHeight - 140;
    this.hudPos = {
      x: Math.max(10, Math.min(newX, maxX)),
      y: Math.max(10, Math.min(newY, maxY)),
    };
  };

  private onHudMouseUp = () => {
    setTimeout(() => {
      this.hudDragging = false;
    });
    document.removeEventListener('mousemove', this.onHudDrag);
    document.removeEventListener('mouseup', this.onHudMouseUp);
  };

  private onResizerDown = () => {
    this.resizing = true;
    document.body.style.userSelect = 'none';
    document.body.style.webkitUserSelect = 'none';
    document.body.style.pointerEvents = 'none';

    document.addEventListener('mousemove', this.onResizerMove);
    document.addEventListener('mouseup', this.onResizerUp);
    document.body.style.cursor = this.dockPosition === 'bottom' ? 'ns-resize' : 'ew-resize';
  };

  private onResizerMove = (e: MouseEvent) => {
    if (!this.resizing) return;
    if (this.dockPosition === 'bottom') {
      const newH = window.innerHeight - e.clientY;
      this.dockHeight = Math.max(160, Math.min(newH, window.innerHeight * 0.9));
    } else {
      const newW = window.innerWidth - e.clientX;
      this.dockWidth = Math.max(320, Math.min(newW, window.innerWidth * 0.8));
    }
    this.updateBodyPadding();
  };

  private onResizerUp = () => {
    this.resizing = false;
    document.removeEventListener('mousemove', this.onResizerMove);
    document.removeEventListener('mouseup', this.onResizerUp);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    document.body.style.webkitUserSelect = '';
    document.body.style.pointerEvents = '';
    this.persistPrefs();
  };

  private onOpen = () => {
    this.dockVisible = true;
    if (!this.activePlugin) this.activePlugin = this.pickFirstPlugin();
    this.persistPrefs();
  }

  private onClose = () => {
    this.dockVisible = false;
    this.unlockBodyScroll();
    this.resetBodyPadding();
    this.persistPrefs();
  }

  private toggleDockPosition = () => {
    this.dockPosition = this.dockPosition === 'bottom' ? 'right' : 'bottom';
    this.persistPrefs();
    this.updateBodyPadding();
  };

  private pickFirstPlugin(): string | null {
    return this.state?.plugins?.[0]?.packageName ?? null;
  }

  private renderHud() {
    const s = this.state;
    const status = s?.status ?? 'disconnected';
    return html`
      <div
        class="hud ${this.hudVisible ? '' : 'hidden'}"
        style="left:${this.hudPos.x}px; top:${this.hudPos.y}px"
        @mousedown=${this.onHudMouseDown}
        @click=${(e: MouseEvent) => {
        if (this.hudDragging) {
          e.stopPropagation();
          return;
        }
        this.onOpen();
      }}
      >
        <div class="hud-top">
          <div class="brand">NodeLens</div>
          <div class="dot ${status}"></div>
        </div>
        ${status === 'connected'
        ? html`
              <div class="hud-row"><span>Plugins</span><span>${s?.plugins?.length ?? 0}</span></div>
              <div class="hud-row"><span>Framework</span><span>${s?.appInfo?.framework ?? '—'}</span></div>
              <div class="hud-row"><span>Origin</span><span>${s?.appInfo?.origin ?? '—'}</span></div>
            `
        : html`<div class="hud-row"><span>Status</span><span>${status}</span></div>`}
        <div class="hud-foot">Open/Close • Ctrl/Cmd+Shift+L</div>
      </div>
    `;
  }

  private renderDockHeader() {
    const plugins = this.state?.plugins ?? [];
    const active = this.activePlugin ?? this.pickFirstPlugin();
    if (active !== this.activePlugin) this.activePlugin = active;

    return html`
      <div class="dock-header">
        <div class="tabs" role="tablist">
          ${plugins.map((p) => {
      const isActive = p.packageName === this.activePlugin;
      return html`
              <button
                role="tab"
                aria-selected=${isActive ? 'true' : 'false'}
                class="tab ${isActive ? 'active' : ''}"
                @click=${(e: Event) => {
          this.activePlugin = p.packageName;
          this.persistPrefs();
          (e.currentTarget as HTMLElement).scrollIntoView({
            behavior: 'smooth',
            block: 'nearest',
            inline: 'center'
          });
        }}
                title=${p.displayName}
              >
                <span class="icon">
                  <nl-codicon icon=${p.icon || 'extensions'}></nl-codicon>
                </span>
                <span class="label">${p.displayName}</span>
              </button>
            `;
    })}
        </div>
        <div class="actions">
          <nl-button
            variant="ghost"
            title="Toggle HUD"
            @click=${() => {
        this.hudVisible = !this.hudVisible;
        this.persistPrefs();
      }}
          >
            <nl-codicon icon="eye"></nl-codicon>
          </nl-button>
          <nl-button
            variant="ghost"
            title="Toggle bottom/right"
            @click=${this.toggleDockPosition}
          >
            <nl-codicon icon="${this.dockPosition === 'bottom' ? 'layout-sidebar-right' : 'layout-panel-dock'}"></nl-codicon>
          </nl-button>
          <nl-button
            variant="ghost"
            title="Close"
            @click=${this.onClose}
          >
            <nl-codicon icon="close"></nl-codicon>
          </nl-button>
        </div>
      </div>
    `;
  }

  private renderDockBody() {
    if (this.state?.status === 'disconnected') {
      return html`<div class="empty">Not connected to any NodeLens server.</div>`;
    }
    if (this.state?.status === 'connecting') {
      return html`<div class="empty">Connecting...</div>`;
    }
    if (!this.activePlugin) {
      return html`<div class="empty">No plugins available.</div>`;
    }
    return html`
      <div class="plugin-host" role="tabpanel" aria-label=${this.activePlugin}>
        <nl-plugin-view .plugin=${this.activePlugin}></nl-plugin-view>
      </div>
    `;
  }

  private renderDock() {
    const style = this.dockPosition === 'bottom'
      ? `height:${this.dockHeight}px; left:0; right:0; bottom:0;`
      : `width:${this.dockWidth}px; top:0; right:0; bottom:0;`;

    const classNames: string[] = ['dock'];
    if (this.dockPosition) classNames.push(this.dockPosition);
    if (this.dockVisible) classNames.push('open');
    if (this.resizing) classNames.push('dragging');

    return html`
      <div
        class="${classNames.join(' ')}"
        style=${style}
        @pointerenter=${this.onDockEnter}
        @pointerleave=${this.onDockLeave}
      >
        ${this.dockVisible
        ? html`
              ${this.renderDockHeader()}
              <div class="resizer ${this.dockPosition}" @mousedown=${this.onResizerDown}></div>
              ${this.renderDockBody()}
            `
        : nothing}
      </div>
    `;
  }

  override render() {
    return html`
      <div class="nl-root">
        ${this.renderHud()}
        ${this.renderDock()}
      </div>
    `;
  }

  static override styles = css`
    :host {
      position: fixed;
      inset: 0;
      pointer-events: none;
      z-index: 2147483000;
      font-family: var(--nl-font-family-sans);
      font-size: var(--nl-font-size-base);
      color: var(--nl-text-primary);
    }
    .nl-root {
      width: 100%;
      height: 100%;
    }
    /* HUD */
    .hud {
      position: absolute;
      width: 260px;
      background: var(--nl-surface-raised);
      border: 1px solid var(--nl-surface-border);
      border-radius: var(--nl-border-radius);
      box-shadow: var(--nl-shadow-lg);
      box-sizing: border-box;
      padding: var(--nl-spacing-md);
      pointer-events: auto;
      user-select: none;
      cursor: grab;
      transition: opacity 0.25s ease;
    }
    .hud.hidden {
      display: none;
    }
    .hud:active {
      cursor: grabbing;
    }
    .hud-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: var(--nl-spacing-sm);
    }
    .dock.open ~ .hud {
      opacity: 0.5;
    }
    .brand {
      font-weight: 700;
      font-size: 14px;
    }
    .dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: #dc2626;
      box-shadow: var(--nl-shadow-sm);
    }
    .dot.connected {
      background: #22c55e;
    }
    .dot.connecting {
      background: #eab308;
    }
    .hud-row {
      display: flex;
      justify-content: space-between;
      margin: 2px 0;
      font-size: 12px;
    }
    .hud-row span:first-child {
      color: var(--nl-text-secondary);
    }
    .hud-foot {
      margin-top: var(--nl-spacing-sm);
      border-top: 1px solid var(--nl-surface-border);
      padding-top: var(--nl-spacing-xs);
      text-align: center;
      font-family: ui-monospace, monospace;
      font-size: 12px;
      color: var(--nl-text-secondary);
    }
    /* Dock */
    .dock {
      pointer-events: auto;
      display: flex;
      flex-direction: column;
      box-sizing: border-box;
      position: fixed;
      background: var(--nl-surface-raised);
      box-shadow: var(--nl-shadow-lg);
      transition: transform 0.25s ease, opacity 0.25s ease;
    }
    .dock.bottom {
      left: 0;
      right: 0;
      bottom: 0;
      border-top: 1px solid var(--nl-surface-border);
      transform: translateY(100%);
      opacity: 0;
    }
    .dock.bottom.open {
      transform: translateY(0);
      opacity: 1;
    }
    .dock.right {
      top: 0;
      right: 0;
      bottom: 0;
      border-left: 1px solid var(--nl-surface-border);
      transform: translateX(100%);
      opacity: 0;
    }
    .dock.right.open {
      transform: translateX(0);
      opacity: 1;
    }
    .dock.dragging {
      user-select: none !important;
      -webkit-user-select: none !important;
      pointer-events: none;
    }
    .dock-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--nl-spacing-md);
      padding: var(--nl-spacing-sm) var(--nl-spacing-md);
      border-bottom: 1px solid var(--nl-surface-border);
      background: var(--nl-surface-popover);
      overflow: hidden;
    }
    .tabs {
      display: flex;
      gap: var(--nl-spacing-xs);
      overflow-x: auto;
      scrollbar-width: none;
      -webkit-mask-image: linear-gradient(
        to right,
        transparent 0,
        black var(--nl-spacing-md),
        black calc(100% - var(--nl-spacing-md)),
        transparent 100%
      );
      mask-image: linear-gradient(
        to right,
        transparent 0,
        black var(--nl-spacing-md),
        black calc(100% - var(--nl-spacing-md)),
        transparent 100%
      );
    }
    .tabs::-webkit-scrollbar {
      display: none;
    }
    .tab {
      display: inline-flex;
      align-items: center;
      gap: var(--nl-spacing-xs);
      padding: 6px 8px;
      border: 1px solid transparent;
      background: transparent;
      border-radius: var(--nl-border-radius);
      color: var(--nl-text-primary);
      cursor: pointer;
      font-size: 12px;
      white-space: nowrap;
    }
    .tab:hover {
      background: var(--nl-surface-hover);
    }
    .tab.active {
      background: var(--nl-surface-control);
      border-color: var(--nl-surface-border);
    }
    .tab .icon {
      display: grid;
      place-items: center;
      width: 16px;
      height: 16px;
    }
    .actions {
      display: flex;
      gap: var(--nl-spacing-xs);
      flex-shrink: 0;
    }
    /* Resizers */
    .resizer.bottom {
      height: 6px;
      cursor: ns-resize;
      background: transparent;
      position: absolute;
      left: 0;
      right: 0;
      top: -6px;
    }
    .resizer.right {
      width: 6px;
      cursor: ew-resize;
      background: transparent;
      position: absolute;
      left: -6px;
      top: 0;
      bottom: 0;
    }
    .plugin-host {
      flex: 1;
      min-height: 0;
      min-width: 0;
      overflow: hidden;
      box-sizing: border-box;
    }
    .empty {
      padding: var(--nl-spacing-lg);
      color: var(--nl-text-secondary);
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      text-align: center;
      font-size: 18px;
    }
  `;
}
