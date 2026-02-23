import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import './card';
import './button';

const meta: Meta = {
  title: 'Data Display/Card',
  component: 'nl-card',
};
export default meta;

export const Basic: StoryObj = {
  render: () => html`
    <nl-card>
      <p>This is the content of the card.</p>
    </nl-card>
  `,
};

export const WithTitle: StoryObj = {
  render: () => html`
    <nl-card title="Card Title">
      <p>This card has a title.</p>
      <p>And some more content.</p>
    </nl-card>
  `,
};

export const WithSlottedTitle: StoryObj = {
  render: () => html`
    <nl-card>
      <div slot="title" style="display: flex; justify-content: space-between; align-items: center;">
        <span>Custom Title</span>
        <nl-button size="small">Action</nl-button>
      </div>
      <p>This card has a custom title with an action button.</p>
    </nl-card>
  `,
};
