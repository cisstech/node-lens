import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './codemirror-editor';
import { CodemirrorEditor } from './codemirror-editor.js';

const meta: Meta<CodemirrorEditor> = {
  title: 'Components/CodeMirrorEditor',
  component: 'nl-codemirror-editor',
  argTypes: {
    language: {
      control: { type: 'select' },
      options: ['sql', 'json', 'javascript'],
    },
    value: {
      control: { type: 'text' },
    },
    placeholder: {
      control: { type: 'text' },
    },
    readOnly: {
      control: { type: 'boolean' },
    },
    autoHeight: {
      control: { type: 'boolean' },
    },
    maxHeight: {
      control: { type: 'number' },
    },
  },
};

export default meta;

type Story = StoryObj<CodemirrorEditor>;

export const Default: Story = {
  render: (args) => html`
    <nl-codemirror-editor
      language=${args.language}
      .value=${args.value}
      placeholder=${args.placeholder}
      ?readOnly=${args.readOnly}
      ?autoHeight=${args.autoHeight}
      maxHeight=${args.maxHeight}
      style="height:240px;"
    ></nl-codemirror-editor>
  `,
  args: {
    language: 'sql',
    value: 'SELECT * FROM users LIMIT 10;',
    placeholder: 'Write your query here…',
    readOnly: false,
    autoHeight: false,
    maxHeight: 420,
  },
};

export const JSON: Story = {
  render: (args) => html`
    <nl-codemirror-editor
      language="json"
      .value=${args.value}
      placeholder="Enter JSON..."
    ></nl-codemirror-editor>
  `,
  args: {
    value: '{}',
  },
};

export const JavaScript: Story = {
  render: (args) => html`
    <nl-codemirror-editor
      language="javascript"
      .value=${args.value}
      placeholder="Enter JavaScript code..."
    ></nl-codemirror-editor>
  `,
  args: {
    value: `function hello() {\n  console.log("Hello, Storybook!");\n}`,
  },
};

export const ReadOnly: Story = {
  render: (args) => html`
    <nl-codemirror-editor
      language="sql"
      .value=${args.value}
      ?readOnly=${true}
    ></nl-codemirror-editor>
  `,
  args: {
    value: 'SELECT id, name FROM products WHERE price > 100;',
  },
};

export const AutoHeight: Story = {
  render: (args) => html`
    <nl-codemirror-editor
      language="json"
      .value=${args.value}
      ?autoHeight=${true}
      maxHeight=${args.maxHeight}
    ></nl-codemirror-editor>
  `,
  args: {
    value: '{}',
    maxHeight: 300,
  },
};
