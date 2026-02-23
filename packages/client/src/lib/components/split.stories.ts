import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import './split';

const meta: Meta = {
  title: 'Layout/Split',
  component: 'nl-split',
};
export default meta;

export const Horizontal: StoryObj = {
  render: () => html`
    <div style="height:400px; border:1px solid var(--nl-surface-border);">
      <nl-split direction="horizontal" initial="200">
        <div slot="start" style="padding:8px; background:var(--nl-surface-control);">
          <h4>Left Pane</h4>
          <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit.</p>
          <p>Resize me →</p>
        </div>
        <div slot="end" style="padding:8px; background:var(--nl-surface-app);">
          <h4>Right Pane</h4>
          ${Array.from({ length: 20 }).map(
            (_, i) => html`<p>Line ${i + 1}: Lorem ipsum dolor sit amet.</p>`
          )}
        </div>
      </nl-split>
    </div>
  `,
};

export const Vertical: StoryObj = {
  render: () => html`
    <div style="height:400px; border:1px solid var(--nl-surface-border);">
      <nl-split direction="vertical" initial="150">
        <div slot="start" style="padding:8px; background:var(--nl-surface-control);">
          <h4>Top Pane</h4>
          <p>Drag ↓ to resize</p>
        </div>
        <div slot="end" style="padding:8px; background:var(--nl-surface-app); overflow:auto;">
          <h4>Bottom Pane (Scrollable)</h4>
          ${Array.from({ length: 40 }).map(
            (_, i) => html`<p>Row ${i + 1}: Lorem ipsum dolor sit amet.</p>`
          )}
        </div>
      </nl-split>
    </div>
  `,
};

export const Nested: StoryObj = {
  render: () => html`
    <div style="height:400px; border:1px solid var(--nl-surface-border);">
      <nl-split direction="horizontal" initial="200">
        <div slot="start" style="padding:8px; background:var(--nl-surface-control);">
          <h4>Sidebar</h4>
          ${Array.from({ length: 10 }).map((_, i) => html`<p>Item ${i + 1}</p>`)}
        </div>
        <div slot="end" style="height:100%;">
          <nl-split direction="vertical" initial="200">
            <div slot="start" style="padding:8px; background:var(--nl-surface-popover);">
              <h4>Editor</h4>
              <textarea style="width:100%;height:100px;">// code here</textarea>
            </div>
            <div slot="end" style="padding:8px; background:var(--nl-surface-app); overflow:auto;">
              <h4>Console</h4>
              ${Array.from({ length: 30 }).map(
                (_, i) => html`<p>Log ${i + 1}: Hello world</p>`
              )}
            </div>
          </nl-split>
        </div>
      </nl-split>
    </div>
  `,
};
