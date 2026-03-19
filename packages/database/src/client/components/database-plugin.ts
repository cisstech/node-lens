import type { NodeLensClient } from '@cisstech/node-lens-client'
import { LitElement, css, html } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'

import './playground.js'
import './traces.js'

const databaseTabs = ['traces', 'playground'] as const
type DatabaseTabs = typeof databaseTabs[number]

@customElement('nl-database')
export class DatabasePlugin extends LitElement {
  @property({ type: Object }) client!: NodeLensClient

  @state() private activeTab: DatabaseTabs = 'traces'

  private setActiveTab(e: CustomEvent<{ key: DatabaseTabs }>) {
    const { key } = e.detail
    if (!(databaseTabs as readonly string[]).includes(key)) {
      return
    }
    this.activeTab = key
  }

  override render() {
    return html`
      <div class="layout">
        <nl-tabs .activeKey=${this.activeTab} @tab-click=${this.setActiveTab}>
          <nl-tab key="traces" slot="tabs">Database Traces</nl-tab>
          <nl-tab key="playground" slot="tabs">Query Playground</nl-tab>

          <nl-tab-panel key="traces" slot="panels">
            <nl-database-traces .client=${this.client}></nl-database-traces>
          </nl-tab-panel>

          <nl-tab-panel key="playground" slot="panels">
            <nl-database-playground .client=${this.client}></nl-database-playground>
          </nl-tab-panel>
        </nl-tabs>
      </div>
    `
  }



  static override styles = css`
    :host {
      display: block;
      width: 100%;
      height: 100%;
      font-family: var(--nl-font-family-sans);
      font-size: var(--nl-font-size-base);
      line-height: var(--nl-line-height-base);
      color: var(--nl-text-primary);
      background: var(--nl-surface-app);
      overflow: hidden;
    }

    .layout {
      display: flex;
      flex-direction: column;
      height: 100%;
      overflow: hidden;
    }

    .state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 200px;
      color: var(--nl-text-secondary);
      gap: var(--nl-spacing-sm);
      text-align: center;
    }

    .state-error {
      color: var(--nl-color-error);
    }
  `
}
