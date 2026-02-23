import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import './toolbar';
import './button';
import './input';

const meta: Meta = {
  title: 'Navigation/Toolbar',
  component: 'nl-toolbar',
};
export default meta;

export const Basic: StoryObj = {
  render: () => html`
    <nl-toolbar>
      <nl-button variant="primary">Save</nl-button>
      <nl-button>Cancel</nl-button>
      <nl-input placeholder="Search..."></nl-input>
    </nl-toolbar>
  `,
};
