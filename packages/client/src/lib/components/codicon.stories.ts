import { html } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
// @ts-expect-error -- raw import
import codiconStyles from '@vscode/codicons/dist/codicon.css?raw';
import './codicon';
import './input';
import { Codicon } from './codicon.js';

// Extract icon names from codicon.css
const iconNames = new Set<string>();
const regex = /\.codicon-([^:]+):before/g;
let match;
while ((match = regex.exec(codiconStyles)) !== null) {
  // split comma separated names
  match[1].split(',').forEach((icon) => {
    const name = icon.trim().split('.')[0];
    if (name) {
      iconNames.add(name);
    }
  });
}
const icons = Array.from(iconNames).sort();

const meta: Meta<Codicon> = {
  title: 'Components/Codicon',
  component: 'nl-codicon',
  argTypes: {
    icon: {
      control: { type: 'select' },
      options: icons,
    },
  },
};
export default meta;

export const Default: StoryObj = {
  args: {
    icon: 'check',
  },
  render: ({ icon }) => html`<nl-codicon icon=${icon}></nl-codicon>`,
};

export const AllIcons: StoryObj = {
  name: 'All Icons',
  render: () => {
    return html`
      <div
        style="display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 2rem;"
      >
        ${repeat(
          icons,
          (icon) => icon,
          (icon) => html`
            <div
              style="display: flex; flex-direction: column; align-items: center; gap: 0.5rem;"
            >
              <nl-codicon .icon=${icon}></nl-codicon>
              <span style="text-align: center;">${icon}</span>
            </div>
          `
        )}
      </div>
    `;
  },
};
