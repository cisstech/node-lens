import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import './grid';

const meta: Meta = {
  title: 'Layout/Grid',
  component: 'nl-row',
};
export default meta;

const style = html`
  <style>
    nl-col > div {
      background-color: var(--nl-color-primary);
      color: var(--nl-text-on-primary);
      padding: var(--nl-spacing-sm) 0;
      text-align: center;
      border-radius: var(--nl-border-radius);
    }
  </style>
`;

export const Basic: StoryObj = {
  render: () => html`
    ${style}
    <nl-row>
      <nl-col span="24"><div>col-24</div></nl-col>
    </nl-row>
    <nl-row>
      <nl-col span="12"><div>col-12</div></nl-col>
      <nl-col span="12"><div>col-12</div></nl-col>
    </nl-row>
    <nl-row>
      <nl-col span="8"><div>col-8</div></nl-col>
      <nl-col span="8"><div>col-8</div></nl-col>
      <nl-col span="8"><div>col-8</div></nl-col>
    </nl-row>
    <nl-row>
      <nl-col span="6"><div>col-6</div></nl-col>
      <nl-col span="6"><div>col-6</div></nl-col>
      <nl-col span="6"><div>col-6</div></nl-col>
      <nl-col span="6"><div>col-6</div></nl-col>
    </nl-row>
  `,
};

export const Gutter: StoryObj = {
  render: () => html`
    ${style}
    <nl-row gutter="16">
      <nl-col span="6"><div>col-6</div></nl-col>
      <nl-col span="6"><div>col-6</div></nl-col>
      <nl-col span="6"><div>col-6</div></nl-col>
      <nl-col span="6"><div>col-6</div></nl-col>
    </nl-row>
  `,
};

export const ResponsiveGutter: StoryObj = {
  render: () => html`
    ${style}
    <nl-row .gutter=${[16, 16]}>
      <nl-col span="6"><div>col-6</div></nl-col>
      <nl-col span="6"><div>col-6</div></nl-col>
      <nl-col span="6"><div>col-6</div></nl-col>
      <nl-col span="6"><div>col-6</div></nl-col>
      <nl-col span="6"><div>col-6</div></nl-col>
      <nl-col span="6"><div>col-6</div></nl-col>
      <nl-col span="6"><div>col-6</div></nl-col>
      <nl-col span="6"><div>col-6</div></nl-col>
    </nl-row>
  `,
};
