import { css, html, LitElement, PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { until } from 'lit/directives/until.js';
import { NodeLensClient } from '../core/node-lens-client';
import type { PluginManifest } from '../types';

@customElement('nl-plugin-view')
export class PluginView extends LitElement {
  @property({ type: String }) plugin = '';

  @state() private manifest?: PluginManifest;
  @state() private client?: NodeLensClient;

  override connectedCallback(): void {
    super.connectedCallback();
    this.client = (window as Window & typeof globalThis).nodeLensInstance;
    this.manifest = this.client?.registry?.getByName?.(this.plugin);
    this.client?.registry?.addEventListener('registry-updated', this.onRegistryUpdated.bind(this));
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.client?.registry?.removeEventListener('registry-updated', this.onRegistryUpdated.bind(this));
  }

  protected override updated(_changedProperties: PropertyValues): void {
    if (_changedProperties.has('pluginName') && this.client) {
      this.manifest = this.client.registry.getByName(this.plugin);
    }
  }


  private onRegistryUpdated() {
    this.manifest = this.client?.registry.getByName(this.plugin);
  }

  private renderPlugin() {
    this.manifest = this.client?.registry.getByName(this.plugin);
    if (!this.client || !this.manifest) {
      return html`<div class="error">Plugin manifest not found for ${this.plugin}.</div>`;
    }

    const doRender = async () => {
      try {
        if (!this.client || !this.manifest) {
          return html`<div class="error">Client or manifest not available.</div>`;
        }
        await this.client.registry.loadPlugin(this.manifest);
        const el = document.createElement(this.manifest.tagName) as LitElement & { client: NodeLensClient };
        el.client = this.client;

        // Container ensures full-size + border-box for the plugin element
        const container = document.createElement('div');
        container.appendChild(el);
        container.style.width = '100%';
        container.style.height = '100%';
        container.style.boxSizing = 'border-box';

        const style = (el as HTMLElement).style;
        style.boxSizing = 'border-box';
        style.width = '100%';
        style.height = '100%';
        style.padding = 'var(--nl-spacing-lg)';
        style.fontFamily = 'var(--nl-font-family-sans)';
        style.fontSize = 'var(--nl-font-size-base)';
        style.color = 'var(--nl-text-primary)';

        return container;
      } catch (e) {
        console.error(`[NodeLens] Failed to render plugin ${this.plugin}`, e);
        return html`<div class="error">Error loading plugin: ${this.plugin}</div>`;
      }
    };

    return html`${until(
      doRender(),
      html`
        <div class="loading">
          <div class="spinner"></div>
          <p>Loading ${this.manifest.displayName}...</p>
        </div>
      `
    )}`;
  }

  override render() {
    return this.renderPlugin()
  }

  static override styles = css`
    :host {
      display: block;
      width: 100%;
      height: 100%;
      box-sizing: border-box;
    }
    .loading {
      height: 100%;
      display: grid;
      place-items: center;
      color: var(--nl-text-secondary);
      gap: var(--nl-spacing-md);
    }
    .spinner {
      width: 22px;
      height: 22px;
      border: 3px solid var(--nl-surface-border);
      border-top: 3px solid var(--nl-color-primary);
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }
    .error {
      padding: var(--nl-spacing-lg);
      color: var(--nl-color-primary);
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `;
}
