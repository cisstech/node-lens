import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './select';
import './codicon'
import { Select, SelectOption } from './select.js';

const meta: Meta<Select> = {
  title: 'Components/Select',
  component: 'nl-select',
  argTypes: {
    options: {
      control: { type: 'object' },
    },
    value: {
      control: { type: 'text' },
    },
    values: {
      control: { type: 'object' },
    },
    multi: {
      control: { type: 'boolean' },
    },
    placeholder: {
      control: { type: 'text' },
    },
  },
};

export default meta;

type Story = StoryObj<Select>;

const options: SelectOption[] = [
    { value: 'javascript', label: 'JavaScript' },
    { value: 'typescript', label: 'TypeScript' },
    { value: 'python', label: 'Python' },
    { value: 'java', label: 'Java' },
    { value: 'csharp', label: 'C#' },
    { value: 'cpp', label: 'C++' },
];

export const Default: Story = {
  render: (args) => html`
    <nl-select
      .options=${args.options}
      value=${args.value}
      placeholder=${args.placeholder}
      @change=${(e: CustomEvent) => {
        console.log('Single select changed:', e.detail);
      }}
    >
    </nl-select>
  `,
  args: {
    options: options,
    value: 'javascript',
    placeholder: 'Select an option',
  },
};

export const WithIcon: Story = {
  render: (args) => html`
    <nl-select
      .options=${args.options}
      value=${args.value}
      placeholder=${args.placeholder}
      @change=${(e: CustomEvent) => {
        console.log('Single select with icon changed:', e.detail);
      }}
    >
      <nl-codicon slot="icon" icon="git-commit"></nl-codicon>
    </nl-select>
  `,
  args: {
    options: options,
    value: 'typescript',
    placeholder: 'Select an option',
  },
};

export const MultiSelect: Story = {
  render: (args) => html`
    <nl-select
      .options=${args.options}
      .values=${args.values}
      .multi=${args.multi}
      placeholder=${args.placeholder}
      @change=${(e: CustomEvent) => {
        console.log('Multi-select changed:', e.detail);
      }}
    >
    </nl-select>
  `,
  args: {
    options: options,
    values: ['javascript', 'python'],
    multi: true,
    placeholder: 'Select multiple options',
  },
};

export const MultiSelectWithIcon: Story = {
  render: (args) => html`
    <nl-select
      .options=${args.options}
      .values=${args.values}
      .multi=${args.multi}
      placeholder=${args.placeholder}
      @change=${(e: CustomEvent) => {
        console.log('Multi-select with icon changed:', e.detail);
      }}
    >
      <nl-codicon slot="icon" icon="checklist"></nl-codicon>
    </nl-select>
  `,
  args: {
    options: options,
    values: ['typescript', 'java'],
    multi: true,
    placeholder: 'Select multiple with icon',
  },
};

export const SearchableMultiSelect: Story = {
  render: (args) => html`
    <div style="width: 400px;">
      <h3>Try searching while having selections!</h3>
      <nl-select
        .options=${args.options}
        .values=${args.values}
        .multi=${args.multi}
        placeholder=${args.placeholder}
        @change=${(e: CustomEvent) => {
          console.log('Searchable multi-select changed:', e.detail);
        }}
      >
        <nl-codicon slot="icon" icon="search"></nl-codicon>
      </nl-select>
    </div>
  `,
  args: {
    options: options,
    values: ['javascript', 'typescript', 'python'],
    multi: true,
    placeholder: 'Search and select programming languages',
  },
};

export const SmallContainer: Story = {
  render: (args) => html`
    <div style="display: flex; gap: 1rem; align-items: start; flex-wrap: wrap;">
      <div style="width: 200px; padding: 8px; border: 1px dashed #ccc;">
        <h4 style="margin: 0 0 8px 0; font-size: 12px;">200px width</h4>
        <nl-select
          .options=${args.options}
          .values=${args.values}
          .multi=${args.multi}
          placeholder=${args.placeholder}
          @change=${(e: CustomEvent) => {
            console.log('200px container changed:', e.detail);
          }}
        >
          <nl-codicon slot="icon" icon="filter"></nl-codicon>
        </nl-select>
      </div>

      <div style="width: 150px; padding: 8px; border: 1px dashed #ccc;">
        <h4 style="margin: 0 0 8px 0; font-size: 12px;">150px width</h4>
        <nl-select
          .options=${args.options}
          .values=${args.values}
          .multi=${args.multi}
          placeholder=${args.placeholder}
          @change=${(e: CustomEvent) => {
            console.log('150px container changed:', e.detail);
          }}
        >
          <nl-codicon slot="icon" icon="filter"></nl-codicon>
        </nl-select>
      </div>

      <div style="width: 120px; padding: 8px; border: 1px dashed #ccc;">
        <h4 style="margin: 0 0 8px 0; font-size: 12px;">120px width</h4>
        <nl-select
          .options=${args.options}
          .values=${args.values}
          .multi=${args.multi}
          placeholder=${args.placeholder}
          @change=${(e: CustomEvent) => {
            console.log('120px container changed:', e.detail);
          }}
        >
          <nl-codicon slot="icon" icon="filter"></nl-codicon>
        </nl-select>
      </div>

      <div style="width: 100px; padding: 8px; border: 1px dashed #ccc;">
        <h4 style="margin: 0 0 8px 0; font-size: 12px;">100px width</h4>
        <nl-select
          .options=${args.options}
          .values=${args.values}
          .multi=${args.multi}
          placeholder="Select..."
          @change=${(e: CustomEvent) => {
            console.log('100px container changed:', e.detail);
          }}
        >
          <nl-codicon slot="icon" icon="filter"></nl-codicon>
        </nl-select>
      </div>
    </div>
  `,
  args: {
    options: options,
    values: ['javascript', 'typescript'],
    multi: true,
    placeholder: 'Select languages...',
  },
};
