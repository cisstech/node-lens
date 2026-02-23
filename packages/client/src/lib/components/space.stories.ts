import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import './space';
import './button';

const meta: Meta = {
  title: 'Layout/Space',
  component: 'nl-space',
  argTypes: {
    direction: {
      control: { type: 'select' },
      options: ['horizontal', 'vertical'],
    },
    gap: {
      control: { type: 'select' },
      options: ['xs', 'sm', 'md', 'lg', 'xl'],
    },
    justify: {
      control: { type: 'select' },
      options: ['start', 'end', 'center', 'space-between', 'space-around'],
    },
    align: {
      control: { type: 'select' },
      options: ['start', 'end', 'center', 'baseline'],
    },
  },
};
export default meta;

const Template: StoryObj = {
  render: (args) => html`
    <nl-space
      direction=${args.direction}
      gap=${args.gap}
      justify=${args.justify}
      align=${args.align}
      style="width: 100%; background-color: var(--nl-surface-control); padding: 1rem;"
    >
      <nl-button>Button 1</nl-button>
      <nl-button>Button 2</nl-button>
      <nl-button>Button 3</nl-button>
    </nl-space>
  `,
};

export const Horizontal = {
  ...Template,
  args: {
    direction: 'horizontal',
    gap: 'sm',
    justify: 'start',
    align: 'center',
  },
};

export const Vertical = {
  ...Template,
  args: {
    direction: 'vertical',
    gap: 'sm',
    justify: 'start',
    align: 'center',
  },
};

export const JustifyEnd = {
  ...Template,
  args: {
    ...Horizontal.args,
    justify: 'end',
  },
};

export const JustifyCenter = {
  ...Template,
  args: {
    ...Horizontal.args,
    justify: 'center',
  },
};

export const JustifySpaceBetween = {
  ...Template,
  args: {
    ...Horizontal.args,
    justify: 'space-between',
  },
};
