import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './attributes';
import { Attributes } from './attributes.js';
import './button';
import './codicon';

const meta: Meta<Attributes> = {
  title: 'Data Display/Attributes',
  component: 'nl-attributes',
  argTypes: {
    data: {
      control: { type: 'object' },
    },
    copiableKeys: {
      control: { type: 'boolean' },
    },
    copiableValues: {
      control: { type: 'boolean' },
    },
    variant: {
      control: { type: 'radio' },
      options: ['default', 'compact'],
    },
  },
};

export default meta;

type Story = StoryObj<Attributes>;

const options: Record<string, string> = {
  accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'accept-encoding': 'gzip, deflate, br',
  'accept-language': 'en-US,en;q=0.5',
  'cache-control': 'no-cache',
  'connection': 'keep-alive',
  'host': 'example.com',
  'pragma': 'no-cache',
  'sec-fetch-dest': 'document',
  'sec-fetch-mode': 'navigate',
}

export const Default: Story = {
  render: (args) => html`
    <nl-attributes
      .data=${args.data}
      .copiableKeys=${args.copiableKeys}
      .copiableValues=${args.copiableValues}
      .variant=${args.variant}
    >
    </nl-attributes>
  `,
  args: {
    data: options,
    copiableKeys: true,
    copiableValues: true,
    variant: 'default',
  },
};
