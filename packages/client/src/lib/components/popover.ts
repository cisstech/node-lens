import { LitElement, html, css } from 'lit';
import { customElement, property, query } from 'lit/decorators.js';

@customElement('nl-popover')
export class Popover extends LitElement {
  /** Show/Hide popover */
  @property({ type: Boolean, reflect: true }) open = false;
  /** Target point (viewport coords) */
  @property({ type: Number }) x = 0;
  @property({ type: Number }) y = 0;
  /** Offset from pointer/target */
  @property({ type: Number }) offset = 12;
  /** Optional sizing / clamping */
  @property({ type: Number }) maxWidth = 400;
  @property({ type: Number }) maxHeight = 300;
  /** Flip to keep inside viewport */
  @property({ type: Boolean }) flip = true;

  @query('slot') private slotEl!: HTMLSlotElement;

  private portalRoot: HTMLDivElement | null = null;   // fixed overlay container
  private contentHost: HTMLDivElement | null = null;  // actual popover box

  override connectedCallback() {
    super.connectedCallback();
    this.ensurePortal();
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this.teardownPortal();
  }

  /** Create the fixed portal container once */
  private ensurePortal() {
    if (this.portalRoot) return;

    // Root overlay to keep pointer-events off except the popover itself
    const root = document.createElement('div');
    root.style.position = 'fixed';
    root.style.inset = '0';
    root.style.zIndex = '2147483647';
    root.style.pointerEvents = 'none';
    document.body.appendChild(root);
    this.portalRoot = root;

    // Actual popover box
    const pop = document.createElement('div');
    pop.style.position = 'fixed';
    pop.style.pointerEvents = 'auto';
    pop.style.display = 'none';
    // Inline visual styles (fall back to plain colors if CSS vars not set)
    pop.style.background = 'var(--nl-surface-popover, #1f2937)';
    pop.style.border = '1px solid var(--nl-surface-border, #374151)';
    pop.style.borderRadius = '8px';
    pop.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
    pop.style.padding = '8px';
    pop.style.maxWidth = `${this.maxWidth}px`;
    pop.style.maxHeight = `${this.maxHeight}px`;
    pop.style.overflow = 'auto';

    root.appendChild(pop);
    this.contentHost = pop;

    // If slot is already filled, move nodes into portal now
    this.moveSlottedNodes();
    this.updatePosition();
  }

  /** Clean up; return content to host so it isn’t orphaned */
  private teardownPortal() {
    if (this.contentHost) {
      const frag = document.createDocumentFragment();
      while (this.contentHost.firstChild) {
        frag.appendChild(this.contentHost.firstChild);
      }
      // put nodes back under the component to avoid losing them on disconnect
      this.appendChild(frag);
    }
    this.portalRoot?.remove();
    this.portalRoot = null;
    this.contentHost = null;
  }

  private onSlotChange = () => {
    this.moveSlottedNodes();
  };

  /** Move slotted nodes to the portal container */
  private moveSlottedNodes() {
    if (!this.contentHost || !this.slotEl) return;
    const nodes = this.slotEl.assignedNodes({ flatten: true });
    if (!nodes.length) return;

    const frag = document.createDocumentFragment();
    for (const n of nodes) {
      // Skip pure whitespace text nodes
      if (n.nodeType === Node.TEXT_NODE && !n.textContent?.trim()) continue;
      frag.appendChild(n);
    }
    this.contentHost.appendChild(frag);
  }

  /** Position + flip logic */
  private updatePosition() {
    if (!this.contentHost) return;

    let left = this.x + this.offset;
    let top = this.y + this.offset;

    // Measure with a temporary block display to get size when opening
    const prevDisplay = this.contentHost.style.display;
    if (this.open && prevDisplay === 'none') this.contentHost.style.display = 'block';

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const rect = this.contentHost.getBoundingClientRect();
    const w = rect.width || this.maxWidth;
    const h = rect.height || this.maxHeight;

    if (this.flip) {
      if (left + w > vw) left = this.x - w - this.offset;
      if (top + h > vh) top = this.y - h - this.offset;
      left = Math.max(4, Math.min(vw - w - 4, left));
      top = Math.max(4, Math.min(vh - h - 4, top));
    }

    this.contentHost.style.left = `${Math.round(left)}px`;
    this.contentHost.style.top = `${Math.round(top)}px`;

    // restore display state
    if (!this.open) this.contentHost.style.display = 'none';
  }

  protected override updated(changed: Map<string, unknown>) {
    if (changed.has('open') || changed.has('x') || changed.has('y') || changed.has('maxWidth') || changed.has('maxHeight')) {
      this.ensurePortal();
      this.moveSlottedNodes();
      if (this.contentHost) {
        this.contentHost.style.display = this.open ? 'block' : 'none';
      }
      this.updatePosition();
    }
  }

  override render() {
    // Keep the slot hidden in the shadow; content is moved out to the portal
    return html`<slot @slotchange=${this.onSlotChange} style="display:none"></slot>`;
  }

  static override styles = css`
    :host { display: contents; } /* no visual footprint inside host */
  `;
}
