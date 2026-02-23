import { expect } from '@storybook/jest';
import { userEvent, within } from '@storybook/testing-library';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './tabs';
import { Tabs } from './tabs.js';

const meta: Meta<Tabs> = {
  title: 'Navigation/Tabs',
  component: 'nl-tabs',
};
export default meta;

export const Underline: StoryObj = {
  name: 'Underline (Default)',
  render: () => html`
    <nl-tabs activeKey="1">
      <nl-tab slot="tabs" key="1">Tab 1</nl-tab>
      <nl-tab slot="tabs" key="2">Tab 2</nl-tab>
      <nl-tab slot="tabs" key="3">Tab 3</nl-tab>

      <nl-tab-panel slot="panels" key="1">Content of Tab Pane 1</nl-tab-panel>
      <nl-tab-panel slot="panels" key="2">Content of Tab Pane 2</nl-tab-panel>
      <nl-tab-panel slot="panels" key="3">Content of Tab Pane 3</nl-tab-panel>
    </nl-tabs>
  `,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const tab2 = await canvas.findByText('Tab 2');
    const tab1Panel = await canvas.findByText('Content of Tab Pane 1');

    // Check initial state
    expect(tab1Panel).toBeVisible();

    // Click tab 2
    await userEvent.click(tab2);

    // Check new state
    const tab2Panel = await canvas.findByText('Content of Tab Pane 2');
    expect(tab1Panel).not.toBeVisible();
    expect(tab2Panel).toBeVisible();
  },
};

export const Pills: StoryObj = {
  render: () => html`
    <nl-tabs activeKey="1" variant="pills">
      <nl-tab slot="tabs" key="1">Tab 1</nl-tab>
      <nl-tab slot="tabs" key="2">Tab 2</nl-tab>
      <nl-tab slot="tabs" key="3">Tab 3</nl-tab>

      <nl-tab-panel slot="panels" key="1">Content of Tab Pane 1</nl-tab-panel>
      <nl-tab-panel slot="panels" key="2">Content of Tab Pane 2</nl-tab-panel>
      <nl-tab-panel slot="panels" key="3">Content of Tab Pane 3</nl-tab-panel>
    </nl-tabs>
  `,
};

export const Cards: StoryObj = {
  render: () => html`
    <nl-tabs activeKey="1" variant="cards">
      <nl-tab slot="tabs" key="1">Tab 1</nl-tab>
      <nl-tab slot="tabs" key="2">Tab 2</nl-tab>
      <nl-tab slot="tabs" key="3">Tab 3</nl-tab>

      <nl-tab-panel slot="panels" key="1">Content of Tab Pane 1</nl-tab-panel>
      <nl-tab-panel slot="panels" key="2">Content of Tab Pane 2</nl-tab-panel>
      <nl-tab-panel slot="panels" key="3">Content of Tab Pane 3</nl-tab-panel>
    </nl-tabs>
  `,
};


export const Sticky: StoryObj = {
  render: () => html`
    <div style="height:300px; border:1px solid gray;">
      <nl-tabs activeKey="1" stickyTabs>
        <nl-tab slot="tabs" key="1">History</nl-tab>
        <nl-tab slot="tabs" key="2">Explorer</nl-tab>

        <nl-tab-panel slot="panels" key="1">
          ${'Lorem ipsum dolor sit amet. '.repeat(200)}
        </nl-tab-panel>
        <nl-tab-panel slot="panels" key="2">
          ${'Another tab with scrollable content. '.repeat(200)}
        </nl-tab-panel>
      </nl-tabs>
    </div>
  `,
};
