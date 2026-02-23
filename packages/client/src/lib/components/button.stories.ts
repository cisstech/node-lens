import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './button';
import './codicon';
import { Button } from './button.js';

const meta: Meta<Button> = {
  title: 'Components/Button',
  component: 'nl-button',
  argTypes: {
    variant: {
      control: { type: 'select' },
      options: ['primary', 'secondary'],
    },
    disabled: {
      control: { type: 'boolean' },
    },
    copy: {
      control: { type: 'text' }
    },
    loading: {
      control: { type: 'boolean' },
    },
  },
};

export default meta;

type Story = StoryObj<Button>;

export const Primary: Story = {
  render: (args) => html`
    <nl-button
      variant=${args.variant}
      ?disabled=${args.disabled}
    >
      Button
    </nl-button>
  `,
  args: {
    variant: 'primary',
    disabled: false,
  },
};

export const Secondary: Story = {
    render: (args) => html`
      <nl-button
        variant=${args.variant}
        ?disabled=${args.disabled}
      >
        Button
      </nl-button>
    `,
    args: {
      variant: 'secondary',
      disabled: false,
    },
  };


export const Ghost: Story = {
  render: (args) => html`
    <nl-button
      variant=${args.variant}
      ?disabled=${args.disabled}
    >
      <nl-codicon icon="gear"></nl-codicon>
    </nl-button>
  `,
  args: {
    variant: 'ghost',
    disabled: false,
  },
};


export const Copy: Story = {
  render: (args) => html`
    <nl-button
      variant=${args.variant}
      ?disabled=${args.disabled}
      copy=${args.copy}
    >
      <nl-codicon icon="copy"></nl-codicon>
    </nl-button>
  `,
  args: {
    variant: 'ghost',
    disabled: false,
    copy: 'This text was copied to clipboard!'
  },
};


export const Loading: Story = {
  render: (args) => html`
    <nl-button
      variant=${args.variant}
      ?disabled=${args.disabled}
      ?loading=${args.loading}
    >
      Button
    </nl-button>
  `,
  args: {
    variant: 'primary',
    disabled: false,
    loading: true,
  },
};
