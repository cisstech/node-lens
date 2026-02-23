import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './input';
import './codicon';
import { Input } from './input.js';

const meta: Meta<Input> = {
  title: 'Components/Input',
  component: 'nl-input',
  argTypes: {
    disabled: {
      control: { type: 'boolean' },
    },
    placeholder: {
      control: { type: 'text' },
    },
    type: {
      control: { type: 'text' },
    },
    value: {
      control: { type: 'text' },
    },
    showClear: {
      control: { type: 'boolean' },
    },
    debounce: {
      control: { type: 'number' }
    }
  },
};

export default meta;

type Story = StoryObj<Input>;

export const Default: Story = {
  render: (args) => html`
    <nl-input
      ?disabled=${args.disabled}
      type=${args.type}
      .value=${args.value}
      ?showClear=${args.showClear}
      .debounce=${args.debounce}
      placeholder=${args.placeholder}
    >
    </nl-input>
  `,
  args: {
    disabled: false,
    type: 'text',
    value: '',
    placeholder: 'Type here...',
    showClear: true
  },
};
