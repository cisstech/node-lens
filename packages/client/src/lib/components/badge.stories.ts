import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { Badge, BADGE_VARIANTS, BadgeVariant } from './badge';
import './badge';

const meta: Meta<Badge> = {
  title: 'Components/Badge',
  component: 'nl-badge',
  argTypes: {
    variant: {
      control: { type: 'select' },
      options: BADGE_VARIANTS,
    },
  },
  render: (args) => html`
    <nl-badge variant=${args.variant}>
      ${args.slot}
    </nl-badge>
  `,
};
export default meta;

export const Default: StoryObj = {
  args: {
    variant: 'neutral',
    slot: 'Badge',
  },
};

export const Variants: StoryObj = {
  render: () => html`
    <div style="display: flex; gap: var(--nl-spacing-md);">
      ${BADGE_VARIANTS.map((variant: BadgeVariant) => html`
        <nl-badge variant=${variant}>
          ${variant.charAt(0).toUpperCase() + variant.slice(1)}
        </nl-badge>
      `)}
    </div>
  `,
};
