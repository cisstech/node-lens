import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import './table';

const meta: Meta = {
  title: 'Components/Table',
  component: 'nl-table-wrapper',
};
export default meta;

export const Default: StoryObj = {
  render: () => html`
    <nl-table-wrapper>
      <nl-table>
        <nl-thead>
          <nl-tr>
            <nl-th>Name</nl-th>
            <nl-th>Version</nl-th>
            <nl-th>Description</nl-th>
          </nl-tr>
        </nl-thead>
        <nl-tbody>
          <nl-tr>
            <nl-td>@node-lens/client</nl-td>
            <nl-td>1.0.0</nl-td>
            <nl-td>The client-side UI components.</nl-td>
          </nl-tr>
          <nl-tr>
            <nl-td>@node-lens/server</nl-td>
            <nl-td>1.0.0</nl-td>
            <nl-td>The server-side data provider.</nl-td>
          </nl-tr>
          <nl-tr>
            <nl-td>lit</nl-td>
            <nl-td>3.1.0</nl-td>
            <nl-td>Simple. Fast. Web Components.</nl-td>
          </nl-tr>
        </nl-tbody>
      </nl-table>
    </nl-table-wrapper>
  `,
};
