import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
//import { action } from '@storybook/addon-actions';
import './toggle';

const meta: Meta = {
  title: 'Forms/Toggle Switch',
  component: 'nl-toggle',
  argTypes: {
    checked: { control: 'boolean' },
  },
};
export default meta;
// @nl-change=${action('nl-change')}
export const Default: StoryObj = {
  render: args =>
    html`<nl-toggle
      ?checked=${args.checked}
    ></nl-toggle>`,
  args: {
    checked: false,
  },
};

export const Checked: StoryObj = {
  ...Default,
  args: {
    checked: true,
  },
};
