import { LitElement, TemplateResult, css, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { RequestOperation } from '../../server/types';
import {
  calculateOperationsTimeFrame,
  clamp01,
  countOperationsByType,
  filterOperationsByDuration,
  filterOperationsBySearch,
  filterOperationsByType,
  findOperationByKey,
  getOperationColor,
  getOperationKey,
  isLongOperation,
} from './utils';

import { formatMs } from '../utils';
import './operation-details';

// Configuration constants
const TIMELINE_CONFIG = {
  AXIS_STEPS: 4,
  AXIS_LABEL_PADDING: { left: 10, right: 20 },
  POPOVER_DIMENSIONS: { maxWidth: 400, maxHeight: 300 },
  THRESHOLDS: {
    SHORT_OPERATION_MS: 1,
    LONG_OPERATION_MS: 100,
  },
  PERCENTAGE_SCALE: 100,
  DEPTH_INDENT_PX: 14,
  NAVIGATION: {
    NEXT_OFFSET: 1,
    PREV_OFFSET: -1,
  },
} as const;

/**
 * Interactive timeline component for visualizing request operation traces.
 *
 * Features:
 * - Hierarchical operation visualization with collapse/expand
 * - Operation type filtering and search
 * - Performance highlighting for long operations
 * - Keyboard navigation and shortcuts
 * - Compact and detailed view modes
 */
@customElement('nl-request-timeline')
export class RequestTimeline extends LitElement {
  @property({ type: Array }) operations: RequestOperation[] = [];

  // Mouse tracking for popover positioning
  @state() private mouseX = 0;
  @state() private mouseY = 0;

  // Operation interaction state
  @state() private hoverOp: string | null = null;
  @state() private pinnedOp: string | null = null;
  @state() private focusedOp: string | null = null;
  @state() private collapsedOps = new Set<string>();

  // View configuration
  @state() private compactView = false;
  @state() private hideShortOps = false;
  @state() private searchQuery = '';
  @state() private hiddenOperationTypes = new Set<string>();

  override connectedCallback() {
    super.connectedCallback();
    window.addEventListener('keydown', this.onKeyDown);
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener('keydown', this.onKeyDown);
  }

  /**
   * Renders the complete timeline interface with filtering, controls, and operation visualization.
   * Applies active filters (type, search, duration) and handles focused/pinned state.
   */
  override render() {
    let { baseStart, total } = calculateOperationsTimeFrame(this.operations);
    let opsToRender = this.operations;

    // Apply type filter
    if (this.hiddenOperationTypes.size > 0) {
      opsToRender = filterOperationsByType(opsToRender, this.hiddenOperationTypes);
    }

    // Apply search filter
    if (this.searchQuery.trim()) {
      opsToRender = filterOperationsBySearch(opsToRender, this.searchQuery.trim());
    }

    // Apply duration filter
    if (this.hideShortOps) {
      opsToRender = filterOperationsByDuration(opsToRender, TIMELINE_CONFIG.THRESHOLDS.SHORT_OPERATION_MS);
    }

    if (this.focusedOp) {
      const op = findOperationByKey(this.operations, this.focusedOp);
      if (op) {
        opsToRender = [op];
        baseStart = op.startTimeMs;
        total = (op.endTimeMs ?? op.startTimeMs) - op.startTimeMs;
      }
    }

    if (!total) return html`<div class="muted">No operations</div>`;

    const activeKey = this.pinnedOp ?? this.hoverOp;
    const activeOp = activeKey ? findOperationByKey(this.operations, activeKey) : null;
    const opCounts = countOperationsByType(this.operations);

    return html`
      <div class="timeline">
        <div class="tl-head">
          <div class="tl-title">Timeline</div>
          <div class="tl-search">
            <input
              type="text"
              placeholder="Search operations..."
              .value=${this.searchQuery}
              @input=${(e: InputEvent) => {
                this.searchQuery = (e.target as HTMLInputElement).value;
                this.requestUpdate();
              }}
              class="search-input"
            />
          </div>
          <div class="tl-controls">
            <nl-button variant="ghost" @click=${this.collapseAll} title="Collapse All">
              <nl-codicon icon="collapse-all"></nl-codicon>
            </nl-button>
            <nl-button variant="ghost" @click=${this.expandAll} title="Expand All">
              <nl-codicon icon="expand-all"></nl-codicon>
            </nl-button>
            <nl-button variant="ghost" @click=${this.toggleCompactView} title="Compact View">
              <nl-codicon icon="${this.compactView ? 'list-tree' : 'list-flat'}"></nl-codicon>
            </nl-button>
            <nl-button variant="ghost" @click=${this.toggleDurationFilter} title="Hide operations < 1ms">
              <nl-codicon icon="${this.hideShortOps ? 'eye' : 'eye-closed'}"></nl-codicon>
            </nl-button>
            ${this.focusedOp
              ? html`
                  <nl-button variant="ghost" @click=${this.clearFocus}>
                    <nl-codicon icon="discard"></nl-codicon> Reset focus
                  </nl-button>
                `
              : nothing}
          </div>
        </div>
        <div class="legend">
          ${opCounts.error > 0 ? html`<span class="legend-item ${this.hiddenOperationTypes.has('error') ? 'hidden' : ''}" @click=${() => this.toggleOperationType('error')}><span class="dot" style="background:var(--nl-request-op-color-error)"></span>Error <span class="count">(${opCounts.error})</span></span>` : nothing}
          ${opCounts.graphql > 0 ? html`<span class="legend-item ${this.hiddenOperationTypes.has('graphql') ? 'hidden' : ''}" @click=${() => this.toggleOperationType('graphql')}><span class="dot" style="background:var(--nl-request-op-color-graphql)"></span>GraphQL <span class="count">(${opCounts.graphql})</span></span>` : nothing}
          ${opCounts.cache > 0 ? html`<span class="legend-item ${this.hiddenOperationTypes.has('cache') ? 'hidden' : ''}" @click=${() => this.toggleOperationType('cache')}><span class="dot" style="background:var(--nl-request-op-color-cache)"></span>Cache <span class="count">(${opCounts.cache})</span></span>` : nothing}
          ${opCounts.db > 0 ? html`<span class="legend-item ${this.hiddenOperationTypes.has('db') ? 'hidden' : ''}" @click=${() => this.toggleOperationType('db')}><span class="dot" style="background:var(--nl-request-op-color-db)"></span>DB <span class="count">(${opCounts.db})</span></span>` : nothing}
          ${opCounts.http > 0 ? html`<span class="legend-item ${this.hiddenOperationTypes.has('http') ? 'hidden' : ''}" @click=${() => this.toggleOperationType('http')}><span class="dot" style="background:var(--nl-request-op-color-http)"></span>HTTP <span class="count">(${opCounts.http})</span></span>` : nothing}
          ${opCounts.middleware > 0 ? html`<span class="legend-item ${this.hiddenOperationTypes.has('middleware') ? 'hidden' : ''}" @click=${() => this.toggleOperationType('middleware')}><span class="dot" style="background:var(--nl-request-op-color-middleware)"></span>Middleware <span class="count">(${opCounts.middleware})</span></span>` : nothing}
          ${opCounts.default > 0 ? html`<span class="legend-item ${this.hiddenOperationTypes.has('default') ? 'hidden' : ''}" @click=${() => this.toggleOperationType('default')}><span class="dot" style="background:var(--nl-request-op-color-default)"></span>Other <span class="count">(${opCounts.default})</span></span>` : nothing}
        </div>
        <div class="tl-body ${this.compactView ? 'compact' : ''}">
          ${this.renderAxis(total)} ${opsToRender.map((op) => this.renderOp(op, baseStart, total))}
        </div>
      </div>
      ${activeOp
        ? html`
            <nl-popover
              .open=${!!activeKey}
              .x=${this.mouseX}
              .y=${this.mouseY}
              .maxWidth=${TIMELINE_CONFIG.POPOVER_DIMENSIONS.maxWidth}
              .maxHeight=${TIMELINE_CONFIG.POPOVER_DIMENSIONS.maxHeight}
            >
              <nl-operation-details
                .operation=${activeOp}
                .baseStart=${baseStart}
                .isPinned=${this.pinnedOp === activeKey}
                .isFocused=${this.focusedOp === activeKey}
                @pin-toggle=${() => this.togglePin(activeOp)}
                @focus-from=${() => this.focusFrom(activeOp)}
                @focus-reset=${this.clearFocus}
              ></nl-operation-details>
            </nl-popover>
          `
        : nothing}
    `;
  }

  /**
   * Handles keyboard shortcuts for timeline navigation and actions.
   * Global shortcuts (when no operation pinned): Shift+C (collapse/expand), H (compact), F (filter)
   * Pinned shortcuts: Escape (close), C (toggle collapse), Arrow keys (navigate)
   */
  private onKeyDown = (e: KeyboardEvent)  => {
    if (!this.pinnedOp) {
      // Global keyboard shortcuts
      if (e.key === 'c' && e.shiftKey) {
        e.preventDefault();
        if (this.collapsedOps.size > 0) {
          this.expandAll();
        } else {
          this.collapseAll();
        }
        return;
      }
      if (e.key === 'h') {
        e.preventDefault();
        this.toggleCompactView();
        return;
      }
      if (e.key === 'f') {
        e.preventDefault();
        this.toggleDurationFilter();
        return;
      }
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      this.pinnedOp = null;
      this.hoverOp = null;
      this.focusedOp = null;
      return;
    }

    if (e.key === 'c') {
      e.preventDefault();
      if (this.pinnedOp) {
        this.toggleCollapse(this.pinnedOp);
      }
      return;
    }

    const rows = Array.from(this.renderRoot.querySelectorAll<HTMLElement>('.op-row'));
    const keys = rows.map((el) => el.dataset.key).filter((k): k is string => !!k);
    const idx = keys.indexOf(this.pinnedOp);

    if (e.key === 'ArrowDown' && idx < keys.length - TIMELINE_CONFIG.NAVIGATION.NEXT_OFFSET) {
      e.preventDefault();
      this.pinnedOp = keys[idx + TIMELINE_CONFIG.NAVIGATION.NEXT_OFFSET];
      this.requestUpdate();
    }

    if (e.key === 'ArrowUp' && idx > 0) {
      e.preventDefault();
      this.pinnedOp = keys[idx + TIMELINE_CONFIG.NAVIGATION.PREV_OFFSET];
      this.requestUpdate();
    }
  }

  private onMouseMove(e: MouseEvent, op: RequestOperation) {
    if (!this.pinnedOp) {
      this.hoverOp = getOperationKey(op);
      this.mouseX = e.clientX;
      this.mouseY = e.clientY;
      this.requestUpdate();
    }
  }

  private onMouseLeave(op: RequestOperation) {
    if (!this.pinnedOp && this.hoverOp === getOperationKey(op)) {
      this.hoverOp = null;
    }
  }

  private togglePin(op: RequestOperation) {
    const key = getOperationKey(op);
    this.pinnedOp = this.pinnedOp === key ? null : key;
    if (!this.pinnedOp) {
      this.hoverOp = null;
    } else {
      this.requestUpdate();
    }
  }

  private focusFrom(op: RequestOperation) {
    this.focusedOp = getOperationKey(op);
  }

  private clearFocus() {
    this.focusedOp = null;
  }

  private collapseAll() {
    const allKeys = new Set<string>();
    const walk = (ops: RequestOperation[]) => {
      ops.forEach(op => {
        if (op.children && op.children.length > 0) {
          allKeys.add(getOperationKey(op));
          walk(op.children);
        }
      });
    };
    walk(this.operations);
    this.collapsedOps = allKeys;
    this.requestUpdate();
  }

  private expandAll() {
    this.collapsedOps.clear();
    this.requestUpdate();
  }

  private toggleCompactView() {
    this.compactView = !this.compactView;
    this.requestUpdate();
  }

  private toggleDurationFilter() {
    this.hideShortOps = !this.hideShortOps;
    this.requestUpdate();
  }

  /** Filters operations by minimum duration threshold. */
  private filterOperationsByDuration(operations: RequestOperation[], minDurationMs: number): RequestOperation[] {
    return operations.filter(op => {
      const dur = Math.max(0, op.durationMs ?? (op.endTimeMs - op.startTimeMs));
      return dur >= minDurationMs;
    }).map(op => ({
      ...op,
      children: op.children ? this.filterOperationsByDuration(op.children, minDurationMs) : undefined
    }));
  }

  /** Filters operations by search query (matches operation names). */
  private filterOperationsBySearch(operations: RequestOperation[], query: string): RequestOperation[] {
    return operations.filter(op => {
      const matchesName = op.name.toLowerCase().includes(query);
      const hasMatchingChildren = op.children && this.filterOperationsBySearch(op.children, query).length > 0;
      return matchesName || hasMatchingChildren;
    }).map(op => ({
      ...op,
      children: op.children ? this.filterOperationsBySearch(op.children, query) : undefined
    }));
  }

  private toggleOperationType(type: string) {
    if (this.hiddenOperationTypes.has(type)) {
      this.hiddenOperationTypes.delete(type);
    } else {
      this.hiddenOperationTypes.add(type);
    }
    this.requestUpdate();
  }

  private toggleCollapse(opKey: string) {
    if (this.collapsedOps.has(opKey)) {
      this.collapsedOps.delete(opKey);
    } else {
      this.collapsedOps.add(opKey);
    }
    this.requestUpdate();
  }

  private renderAxis(total: number) {
    const steps = TIMELINE_CONFIG.AXIS_STEPS;
    const ticks = Array.from({ length: steps + 2 }, (_, i) => Math.round((i / (steps + 1)) * total));
    const left = (index: number) => (ticks[index] / total) * TIMELINE_CONFIG.PERCENTAGE_SCALE;
    const labelStyle = (index: number) =>
      index === 0
        ? `left:${TIMELINE_CONFIG.AXIS_LABEL_PADDING.left}px; transform:none;`
        : index === ticks.length - 1
        ? `right:${TIMELINE_CONFIG.AXIS_LABEL_PADDING.right}px; left:auto; transform:none;`
        : '';

    return html`
      <div class="axis">
        ${ticks.map(
          (t, i) => html`
            <div class="tick" style="left:${left(i)}%">
              <span class="tick-line"></span>
              <span class="tick-label" style=${labelStyle(i)}>${t}ms</span>
            </div>
          `
        )}
      </div>
    `;
  }

  private renderOp(op: RequestOperation, baseStart: number, total: number, depth = 0): TemplateResult {
    const dur = Math.max(0, op.durationMs ?? (op.endTimeMs - op.startTimeMs));
    const offsetPct = clamp01((op.startTimeMs - baseStart) / total) * TIMELINE_CONFIG.PERCENTAGE_SCALE;
    const widthPct = clamp01(dur / total) * TIMELINE_CONFIG.PERCENTAGE_SCALE;
    const color = getOperationColor(op);
    const key = getOperationKey(op);
    const isCollapsible = op.children && op.children.length > 0;
    const isLongOp = isLongOperation(op, TIMELINE_CONFIG.THRESHOLDS.LONG_OPERATION_MS);

    // Auto-collapse short operations by default
    const shouldAutoCollapse = dur < TIMELINE_CONFIG.THRESHOLDS.SHORT_OPERATION_MS && isCollapsible && !this.collapsedOps.has(key);
    if (shouldAutoCollapse) {
      this.collapsedOps.add(key);
    }

    const isCollapsed = this.collapsedOps.has(key);

    return html`
      <div class="op-wrapper">
        <div
          class="op-row ${this.pinnedOp === key ? 'pinned' : ''} ${isLongOp ? 'long-operation' : ''}"
          data-key=${key}
          style="--depth: ${depth}"
          @mousemove=${(e: MouseEvent) => this.onMouseMove(e, op)}
          @mouseleave=${() => this.onMouseLeave(op)}
          @dblclick=${() => isCollapsible ? this.toggleCollapse(key) : null}
        >
          <div class="op-meta">
            <div class="op-name-wrapper">
              ${isCollapsible
                ? html`
                    <nl-button
                      variant="ghost"
                      class="chevron-btn"
                      @click=${() => this.toggleCollapse(key)}
                    >
                      <nl-codicon
                        icon="chevron-right"
                        class="chevron-icon ${isCollapsed ? 'collapsed' : ''}"
                      ></nl-codicon>
                    </nl-button>
                  `
                : html`<span class="chevron-placeholder"></span>`}
              <span class="op-name" title=${op.name}>${op.name}</span>
            </div>
            <span class="op-dur ${isLongOp ? 'long-duration' : ''}">${formatMs(dur)}</span>
          </div>
          <div class="op-track">
            <div
              class="op-bar ${isLongOp ? 'long-bar' : ''}"
              style="left:${offsetPct}%; width:${widthPct}%; background:${color}"
              @click=${() => this.togglePin(op)}
            ></div>
            ${op.events?.map(
              (ev) =>
                html`
                  <span
                    class="ev"
                    style="left:${clamp01((ev.time - baseStart) / total) * TIMELINE_CONFIG.PERCENTAGE_SCALE}%"
                    title="${ev.name}"
                  ></span>
                `
            )}
            <div class="op-actions">
              <nl-button variant="ghost" @click=${() => this.togglePin(op)}>
                <nl-codicon icon="pin"></nl-codicon> Pin
              </nl-button>
              <nl-button variant="ghost" @click=${() => this.focusFrom(op)}>
                <nl-codicon icon="search"></nl-codicon> Focus
              </nl-button>
            </div>
          </div>
        </div>
        ${isCollapsible
          ? html`
              <div class="op-children-container ${isCollapsed ? 'collapsed' : ''}">
                <div class="op-children-content">
                  ${op.children?.map((c) => this.renderOp(c, baseStart, total, depth + 1))}
                </div>
              </div>
            `
          : nothing}
      </div>
    `;
  }

  static override styles = css`
    :host {
      display: block;
      font-family: var(--nl-font-family-sans);
      font-size: var(--nl-font-size-base);
      color: var(--nl-text-primary);

      /* Timeline operation colors */
      --nl-request-op-color-error: #ef4444;
      --nl-request-op-color-graphql: #e879f9;
      --nl-request-op-color-cache: #f59e0b;
      --nl-request-op-color-http: #14b8a6;
      --nl-request-op-color-db: #8b5cf6;
      --nl-request-op-color-middleware: #3b82f6;
      --nl-request-op-color-default: #f97316;

      /* Layout constants */
      --depth-indent: 14px;
    }
    .timeline {
      border: 1px solid var(--nl-surface-border);
      border-radius: var(--nl-border-radius);
      background: var(--nl-surface-control);
      overflow: hidden;
      position: relative;
    }
    .tl-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 6px 10px;
      border-bottom: 1px solid var(--nl-surface-border);
      gap: 8px;
    }
    .tl-search {
      flex: 1;
      max-width: 200px;
    }
    .search-input {
      width: 100%;
      padding: 4px 8px;
      border: 1px solid var(--nl-surface-border);
      border-radius: var(--nl-border-radius);
      background: var(--nl-surface-app);
      color: var(--nl-text-primary);
      font-size: 12px;
    }
    .search-input:focus {
      outline: none;
      border-color: var(--nl-color-primary);
    }
    .tl-controls {
      display: flex;
      gap: 4px;
      align-items: center;
    }
    .legend {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      padding: 4px 10px;
      font-size: 12px;
      color: var(--nl-text-secondary);
    }
    .legend-item {
      cursor: pointer;
      padding: 2px 4px;
      border-radius: var(--nl-border-radius);
      transition: all 0.2s ease;
    }
    .legend-item:hover {
      background: var(--nl-surface-hover);
    }
    .legend-item.hidden {
      opacity: 0.4;
      text-decoration: line-through;
    }
    .dot {
      display: inline-block;
      width: 10px;
      height: 10px;
      border-radius: 50%;
      margin-right: 4px;
      vertical-align: middle;
    }
    .count {
      color: var(--nl-text-primary);
      font-weight: 500;
    }
    .tl-body {
      position: relative;
      padding: 16px 10px;
      margin-top: 1rem;
    }
    .axis {
      position: absolute;
      top: 8px;
      left: 0;
      right: 0;
      bottom: 0;
      pointer-events: none;
    }
    .tick {
      position: absolute;
      top: 0;
      height: 100%;
    }
    .tick-line {
      position: absolute;
      top: 0;
      bottom: 0;
      width: 1px;
      background: var(--nl-surface-border);
      opacity: 0.3;
    }
    .tick-label {
      position: absolute;
      top: -14px;
      transform: translateX(-50%);
      font-size: 11px;
      color: var(--nl-text-secondary);
    }
    .tl-body.compact .op-row {
      padding: 3px 0;
    }
    .tl-body.compact .op-name {
      font-size: 11px;
    }
    .tl-body.compact .op-dur {
      font-size: 11px;
    }
    .tl-body.compact .op-track {
      height: 16px;
    }
    .op-row {
      display: block;
      padding: 6px 0;
      margin-left: calc(var(--depth, 0) * var(--depth-indent));
      cursor: pointer;
      position: relative;
    }
    .op-row::before {
      content: '';
      position: absolute;
      left: calc(-1 * var(--depth-indent));
      top: 0;
      bottom: 0;
      width: 1px;
      background: var(--nl-surface-border);
      opacity: 0.3;
    }
    .op-row::after {
      content: '';
      position: absolute;
      left: calc(-1 * var(--depth-indent));
      top: 50%;
      width: 8px;
      height: 1px;
      background: var(--nl-surface-border);
      opacity: 0.3;
    }
    .op-row:first-child::before {
      top: 50%;
    }
    .op-row:last-child::before {
      bottom: 50%;
    }
    .op-row.long-operation {
      border-left: 3px solid var(--nl-color-warning);
      padding-left: 4px;
      background: color-mix(in oklab, var(--nl-color-warning) 5%, transparent);
    }
    .op-row.pinned {
      outline: 1px solid var(--nl-color-primary);
      outline-offset: 1px;
      background: var(--nl-surface-hover);
      border-radius: var(--nl-border-radius);
    }
    .op-meta {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 4px;
    }
    .op-name-wrapper {
      display: flex;
      align-items: center;
      min-width: 0;
    }
    .op-name {
      font-family: var(--nl-font-family-mono, monospace);
      font-size: 12px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .op-dur {
      font-size: 12px;
      color: var(--nl-text-secondary);
      flex-shrink: 0;
      padding-left: 8px;
    }
    .op-dur.long-duration {
      color: var(--nl-color-warning);
      font-weight: 600;
    }
    .chevron-btn {
      padding: 0;
      height: 16px;
      width: 16px;
      margin-right: 8px;
      flex-shrink: 0;
    }
    .chevron-placeholder {
      width: 16px;
      margin-right: 4px;
      flex-shrink: 0;
    }
    .chevron-icon {
      transition: transform 0.2s ease-in-out;
    }
    .chevron-icon.collapsed {
      transform: rotate(-90deg);
    }
    .op-children-container {
      display: grid;
      grid-template-rows: 1fr;
      transition: grid-template-rows 0.3s ease-in-out;
    }
    .op-children-container.collapsed {
      grid-template-rows: 0fr;
    }
    .op-children-content {
      overflow: hidden;
      min-height: 0;
    }
    .op-track {
      position: relative;
      height: 20px;
      border: 1px solid var(--nl-surface-border);
      border-radius: 4px;
      background: var(--nl-surface-app);
      overflow: hidden;
    }
    .op-bar {
      position: absolute;
      top: 0;
      height: 100%;
      cursor: pointer;
    }
    .op-bar.long-bar {
      box-shadow: 0 0 0 2px var(--nl-color-warning);
      border-radius: 2px;
    }
    .ev {
      position: absolute;
      top: 0;
      width: 2px;
      height: 100%;
      background: var(--nl-color-primary);
    }
    .op-actions {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      display: flex;
      gap: 4px;
      background: rgba(0, 0, 0, 0.5);
      padding: 2px 6px;
      border-radius: var(--nl-border-radius);
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.15s ease-in-out;
    }
    .op-track:hover .op-actions {
      opacity: 1;
      pointer-events: auto;
    }
    .op-actions nl-button {
      color: white;
      --nl-surface-hover: rgba(255, 255, 255, 0.2);
    }
    .muted {
      color: var(--nl-text-secondary);
    }
  `;
}
