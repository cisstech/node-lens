import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';

export type SpaceSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

@customElement('nl-space')
export class Space extends LitElement {
  @property({ type: String , reflect: true})
  direction: 'horizontal' | 'vertical' = 'horizontal';

  @property({ type: String , reflect: true})
  gap: SpaceSize = 'sm';

  @property({ type: String, reflect: true })
  justify: 'start' | 'end' | 'center' | 'space-between' | 'space-around' = 'start';

  @property({ type: String, reflect: true })
  align: 'start' | 'end' | 'center' | 'baseline' = 'center';

  static override styles = css`
    :host {
      display: inline-flex;
    }
  `;

  override render() {
    const styles = {
      display: 'flex',
      width: '100%',
      flexDirection: this.direction === 'vertical' ? 'column' : 'row',
      gap: `var(--nl-spacing-${this.gap})`,
      justifyContent: this.justify,
      alignItems: this.align,
    };

    return html`
      <div style=${styleMap(styles)}>
        <slot></slot>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'nl-space': Space;
  }
}
