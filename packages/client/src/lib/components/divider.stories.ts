import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import './divider';
import { Divider } from './divider';

const meta: Meta<Divider> = {
  title: 'Components/Divider',
  component: 'nl-divider',
  argTypes: {
    orientation: {
      control: { type: 'select' },
      options: ['horizontal', 'vertical'],
    },
  },
};
export default meta;

export const Horizontal: StoryObj = {
  render: () => html`
    <div>
      <p>Some content above the divider.</p>
      <nl-divider></nl-divider>
      <p>Some content below the divider.</p>
    </div>
  `,
};

export const HorizontalWithText: StoryObj = {
  name: 'Horizontal with Text',
  render: () => html`
    <div>
      <p>Some content above the divider.</p>
      <nl-divider>OR</nl-divider>
      <p>Some content below the divider.</p>
    </div>
  `,
};

export const Vertical: StoryObj = {
  render: () => html`
    <div style="display: flex; align-items: center; height: 50px;">
      <span>Left</span>
      <nl-divider orientation="vertical"></nl-divider>
      <span>Right</span>
    </div>
  `,
};
