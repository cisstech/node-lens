import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import '../style.css';

const meta: Meta = {
  title: 'Design System/Overview',
};
export default meta;

export const Philosophy: StoryObj = {
  render: () => html`
    <style>
      .doc-section { margin-bottom: 2rem; }
      .doc-title { font-size: 2rem; font-weight: 600; margin-bottom: 0.5rem; color: var(--nl-text-primary); }
      .doc-subtitle { font-size: 1.5rem; font-weight: 600; margin-bottom: 0.5rem; color: var(--nl-text-primary); border-bottom: 1px solid var(--nl-surface-border); padding-bottom: 0.5rem; }
      .doc-description { font-size: 1rem; color: var(--nl-text-secondary); margin-bottom: 1rem; }
      .nl-card { background-color: var(--nl-surface-app); border: 1px solid var(--nl-surface-border); border-radius: var(--nl-border-radius); }
      .nl-card-content { padding: 1rem; }
      pre {
        background-color: var(--nl-surface-control);
        padding: 1rem;
        border-radius: var(--nl-border-radius);
        font-family: monospace;
        overflow-x: auto;
      }
      .do-dont-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 1rem;
      }
      .do pre { border-left: 3px solid #28a745; }
      .dont pre { border-left: 3px solid #dc3545; }
      h4 { font-size: 1rem; font-weight: 600; margin: 1rem 0 0.5rem 0; }
      ul { margin: 0.5rem 0; padding-left: 1.5rem; }
      li { margin-bottom: 0.5rem; }
    </style>
    <div>
      <h1 class="doc-title">Node-lens Design System</h1>
      <p class="doc-description">
        Welcome to the Node-lens Design System. Our philosophy is to provide a clean, functional, and familiar UI for developers.
        The system is inspired by modern developer tools like VS Code, prioritizing clarity, information density, and accessibility.
      </p>

      <section class="doc-section">
        <h2 class="doc-subtitle">Core Principles</h2>
        <ul>
          <li><strong>Clarity over decoration:</strong> The UI should be intuitive and never distract from the data it presents.</li>
          <li><strong>Consistency is key:</strong> Components and layouts should be predictable and behave as expected.</li>
          <li><strong>Accessibility by default:</strong> All components must be accessible to all users.</li>
          <li><strong>Plugin-first architecture:</strong> The design system is built to be extended. Plugins are first-class citizens.</li>
        </ul>
      </section>

      <section class="doc-section">
        <h2 class="doc-subtitle">Plugin Integration: The "Transparent Box" Model</h2>
        <p class="doc-description">
          When building a plugin for Node-lens, think of your plugin as a "transparent box". It should focus solely on its own content and layout,
          and never on the container that holds it. The Node-lens host application will provide the "card" or "shell" that gives your plugin its
          background, border, padding, and shadow. This ensures a consistent look and feel across all plugins.
        </p>

        <div class="do-dont-grid">
          <div class="dont">
            <h4>❌ Don't: Style the container</h4>
            <pre><code>/* Your plugin's root element */
.my-plugin {
  background: var(--nl-surface-app);
  border: 1px solid var(--nl-surface-border);
  border-radius: var(--nl-border-radius);
  padding: 1rem;
  box-shadow: var(--nl-surface-shadow);
}</code></pre>
          </div>
          <div class="do">
            <h4>✅ Do: Focus on content</h4>
            <pre><code>/* Your plugin's root element */
.my-plugin {
  width: 100%; /* Fill the container */
  display: flex;
  flex-direction: column;
  gap: var(--nl-spacing-md);
}</code></pre>
          </div>
        </div>
      </section>

      <section class="doc-section">
        <h2 class="doc-subtitle">Using CSS Variables</h2>
        <p class="doc-description">
          Always use the provided CSS variables to style your plugin's content. This ensures that your plugin will automatically adapt to theme changes (light/dark)
          and any future design system updates.
        </p>
        <h4>Key Variables</h4>
        <ul>
          <li><b>Text:</b> <code>--nl-text-primary</code>, <code>--nl-text-secondary</code>, <code>--nl-text-on-primary</code></li>
          <li><b>Surfaces:</b> <code>--nl-surface-app</code>, <code>--nl-surface-control</code>, <code>--nl-surface-raised</code>, <code>--nl-surface-popover</code></li>
          <li><b>Borders & Accents:</b> <code>--nl-color-primary</code>, <code>--nl-surface-border</code></li>
          <li><b>Spacing:</b> <code>--nl-spacing-xs</code>, <code>--nl-spacing-sm</code>, etc.</li>
        </ul>
        <h4>Example: A simple plugin header</h4>
        <pre><code>.plugin-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: var(--nl-spacing-md);
  border-bottom: 1px solid var(--nl-surface-border);
}

.plugin-title {
  font-size: 1.2rem;
  font-weight: 600;
  color: var(--nl-text-primary);
}</code></pre>
      </section>
    </div>
  `,
};

const colorTokens = [
  { name: 'primary', var: '--nl-color-primary' },
  { name: 'primary-hover', var: '--nl-color-primary-hover' },
  { name: 'text-on-primary', var: '--nl-text-on-primary' },
  { name: 'success', var: '--nl-color-success' },
  { name: 'success-hover', var: '--nl-color-success-hover' },
  { name: 'error', var: '--nl-color-error' },
  { name: 'error-hover', var: '--nl-color-error-hover' },
  { name: 'warning', var: '--nl-color-warning' },
  { name: 'warning-hover', var: '--nl-color-warning-hover' },
  { name: 'info', var: '--nl-color-info' },
  { name: 'info-hover', var: '--nl-color-info-hover' },
  { name: 'surface-control', var: '--nl-surface-control' },
  { name: 'surface-app', var: '--nl-surface-app' },
  { name: 'surface-control', var: '--nl-surface-control' },
  { name: 'surface-raised', var: '--nl-surface-raised' },
  { name: 'surface-popover', var: '--nl-surface-popover' },
  { name: 'surface-hover', var: '--nl-surface-hover' },
  { name: 'surface-border', var: '--nl-surface-border' },
  { name: 'text-primary', var: '--nl-text-primary' },
  { name: 'text-secondary', var: '--nl-text-secondary' },
];

const colorSection = (theme: 'light' | 'dark') => html`
  <div style="padding: 1rem; background-color: var(--nl-surface-app); color: var(--nl-text-primary);" data-theme=${theme}>
    <h3 style="color: var(--nl-text-primary);">${theme === 'light' ? 'Light' : 'Dark'} Theme</h3>
    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 1rem;">
      ${colorTokens.map(token => html`
        <div style="display: flex; flex-direction: column; gap: 0.5rem;">
          <div style="width: 100%; height: 50px; background-color: var(${token.var}); border: 1px solid var(--nl-surface-border);"></div>
          <div style="font-family: var(--nl-font-family-sans);">
            <div>${token.name}</div>
            <div style="color: var(--nl-text-secondary); font-size: 12px;">var(${token.var})</div>
          </div>
        </div>
      `)}
    </div>
  </div>
`;

export const Colors: StoryObj = {
  render: () => html`
    <div>
      <h2>Colors</h2>
      <p>The color system is divided into light and dark themes.</p>

      ${colorSection('light')}

      <div style="margin-top: 1rem;">
        ${colorSection('dark')}
      </div>
    </div>
  `,
};


export const Typography: StoryObj = {
    render: () => html`
      <h2>Typography</h2>
      <div style="display: flex; flex-direction: column; gap: 1rem;">
        <div>
          <div style="font-family: var(--nl-font-family-sans); font-size: 24px;">Aa</div>
          <div>Font Family Sans: var(--nl-font-family-sans)</div>
        </div>
        <div>
          <div style="font-size: var(--nl-font-size-base);">Base Font Size (13px)</div>
          <div>Font Size Base: var(--nl-font-size-base)</div>
        </div>
        <div>
          <div style="line-height: var(--nl-line-height-base);">Base Line Height (1.4)</div>
          <div>Line Height Base: var(--nl-line-height-base)</div>
        </div>
      </div>
    `,
  };

  export const Spacing: StoryObj = {
    render: () => html`
      <h2>Spacing</h2>
      <div style="display: flex; flex-direction: column; gap: 1rem;">
        ${['xs', 'sm', 'md', 'lg', 'xl'].map(space => html`
          <div>
            <div>var(--nl-spacing-${space})</div>
            <div style="width: var(--nl-spacing-${space}); height: 20px; background-color: var(--nl-color-primary);"></div>
          </div>
        `)}
      </div>
    `,
  };

  export const BorderRadius: StoryObj = {
    render: () => html`
      <h2>Border Radius</h2>
      <div style="width: 50px; height: 50px; border: 1px solid var(--nl-surface-border); border-radius: var(--nl-border-radius);"></div>
      <div>var(--nl-border-radius)</div>
    `,
  };
