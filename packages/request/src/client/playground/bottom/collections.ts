import { LitElement, css, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { CollectionGroup, CollectionRequest } from '../../../server/types';
import { httpMethodStyles } from '../../styles';


@customElement('nl-request-collections')
export class RequestCollections extends LitElement {
  @property({ attribute: false }) collections: CollectionGroup[] = [];

  override render() {
    return html`
      <div class="collections">
        ${!this.collections?.length
          ? html`<div class="empty">No collections available</div>`
          : this.collections.map(collection => html`
              <div class="collection">
                <div class="title">${collection.name}</div>
                <div class="reqs">
                  ${collection.requests.map(request => html`
                    <div
                      class="req"
                      @click=${() => this.applyCollection(request)}
                      title="${request.method} ${request.url}"
                    >
                      <span class="method ${request.method.toLowerCase()}">${request.method}</span>
                      <span class="name">${request.name}</span>
                    </div>
                  `)}
                </div>
              </div>
            `)}
      </div>
    `;
  }

  private applyCollection(req: CollectionRequest) {
    this.dispatchEvent(new CustomEvent('apply-collection', {
      detail: req,
      bubbles: true,
      composed: true,
    }));
  }

  static override styles = css`
    :host {
      font-family: var(--nl-font-family-sans);
      font-size: var(--nl-font-size-base);
      color: var(--nl-text-primary);
    }
    .collections {
      display: flex;
      flex-direction: column;
      gap: var(--nl-spacing-md);
    }

    .collection .title {
      font-weight: 600;
      font-size: 13px;
      margin-bottom: 4px;
    }

    .reqs {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .req {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 4px 6px;
      border-radius: var(--nl-border-radius);
      cursor: pointer;
      font-size: 13px;
    }

    .req:hover {
      background: var(--nl-surface-hover);
    }

    .name {
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .empty {
      font-size: 13px;
      color: var(--nl-text-secondary);
      font-style: italic;
    }

    ${httpMethodStyles}
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'nl-request-collections': RequestCollections;
  }
}
