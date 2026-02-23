import type { Meta, StoryObj } from '@storybook/web-components';
import { html } from 'lit';
import './popover';
import { Popover } from './popover.js';

const meta: Meta<Popover> = {
  title: 'Components/Popover',
  component: 'nl-popover',
  parameters: { layout: 'centered' },
};
export default meta;

type Story = StoryObj;

export const Default: Story = {
  render: () => html`
    <div style="padding:80px; height:420px; border:1px dashed #ccc; position:relative;">
      <p>Popover should render near (150, 120) and be visible even outside containers.</p>
      <nl-popover .x=${150} .y=${120} .open=${true}>
        <div style="max-width:260px">
          <h4 style="margin:0 0 8px;">Popover Content</h4>
          <p style="margin:0 0 6px;">This content is slotted and portaled to <code>document.body</code>.</p>
          <button onclick="alert('Works inside portal')">Click me</button>
        </div>
      </nl-popover>
    </div>
  `,
};

export const Interactive: Story = {
  render: () => {
    const tpl = html`
      <div style="padding:80px; height:420px; border:1px dashed #ccc; position:relative;">
        <button id="btn" style="padding:6px 10px;">Toggle popover</button>
        <nl-popover id="pop" .open=${false} .offset=${10}>
          <div style="max-width:260px">
            <h4 style="margin:0 0 8px;">Dynamic Popover</h4>
            <p>It follows the button and flips to stay in view.</p>
          </div>
        </nl-popover>
      </div>
    `;

    // Wire after render
    queueMicrotask(() => {
      const btn = document.getElementById('btn') as HTMLButtonElement;
      const pop = document.getElementById('pop') as Popover;
      if (!btn || !pop) return;

      const position = () => {
        const r = btn.getBoundingClientRect();
        pop.x = r.right;
        pop.y = r.top;
      };
      position();

      btn.addEventListener('click', () => {
        position();
        pop.open = !pop.open;
      });

      window.addEventListener('resize', () => {
        if (pop.open) position();
      });
    });

    return tpl;
  },
};
