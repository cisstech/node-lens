import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import './tree';

const meta: Meta = {
  title: 'Data Display/Tree',
  component: 'nl-tree',
};
export default meta;

export const Basic: StoryObj = {
  render: () => html`
    <nl-tree>
      <nl-tree-node>
        <span slot="content">Parent 1</span>
        <nl-tree-node>
          <span slot="content">Child 1.1</span>
          <nl-tree-node>
            <span slot="content">Grandchild 1.1.1</span>
          </nl-tree-node>
        </nl-tree-node>
        <nl-tree-node>
          <span slot="content">Child 1.2</span>
        </nl-tree-node>
      </nl-tree-node>
      <nl-tree-node>
        <span slot="content">Parent 2</span>
        <nl-tree-node>
          <span slot="content">Child 2.1</span>
        </nl-tree-node>
      </nl-tree-node>
      <nl-tree-node>
        <span slot="content">Parent 3 (no children)</span>
      </nl-tree-node>
    </nl-tree>
  `,
};

export const PreExpanded: StoryObj = {
    render: () => html`
      <nl-tree>
        <nl-tree-node expanded>
          <span slot="content">Parent 1 (Expanded)</span>
          <nl-tree-node>
            <span slot="content">Child 1.1</span>
          </nl-tree-node>
        </nl-tree-node>
      </nl-tree>
    `,
  };
