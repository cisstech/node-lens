import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { List } from './list.js';
import './list';

const meta: Meta = {
  title: 'Components/List',
  component: 'nl-list',
};
export default meta;

export const Default: StoryObj = {
  render: () => html`
    <nl-list>
      <nl-list-item>Item 1</nl-list-item>
      <nl-list-item>Item 2</nl-list-item>
      <nl-list-item>Item 3</nl-list-item>
    </nl-list>
  `,
};

export const Selectable: StoryObj = {
  render: () => html`
    <nl-list @selection-change=${(e: CustomEvent) => {
      const list = e.target as List;
      const selectedItem = e.detail.value;
      Array.from(list.querySelectorAll('nl-list-item')).forEach(item => {
        item.selected = item.textContent === selectedItem;
      });
    }}>
      <nl-list-item selectable>Item 1</nl-list-item>
      <nl-list-item selectable selected>Item 2</nl-list-item>
      <nl-list-item selectable>Item 3</nl-list-item>
    </nl-list>
  `,
};
