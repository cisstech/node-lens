import type { Meta, StoryObj } from '@storybook/web-components';
import { html } from 'lit';
import { ViewportIntersection } from './viewport-intersection.js'; // Import the component class
import './viewport-intersection.js'; // Import the custom element definition

// Define the component's props and any custom storybook arguments
interface ViewportIntersectionProps extends ViewportIntersection {
  onIntersect: () => void; // For logging the event in the Actions panel
}

// Metadata for the Storybook component page
const meta: Meta<ViewportIntersectionProps> = {
  title: 'Components/ViewportIntersection',
  component: 'viewport-intersection',
  // This argType allows Storybook's "Actions" addon to listen for the 'intersect' event
  argTypes: {
    onIntersect: { action: 'intersect' },
  },
  // The render function is a good place for decorators or wrapping markup
  render: ({ debug, onIntersect }) => html`
    <style>
      .scroll-container {
        height: 200vh; /* Make the container tall enough to scroll */
        padding-top: 80vh; /* Position the component lower down */
        border: 2px dashed #ccc;
        text-align: center;
        font-family: sans-serif;
        color: #555;
      }
      h3 {
        margin-bottom: 2rem;
      }
    </style>
    <div class="scroll-container">
      <h3>Scroll down to trigger the intersection</h3>
      <p>An event will be logged in the "Actions" tab below.</p>
      <nl-viewport-intersection
        ?debug="${debug}"
        @intersect="${onIntersect}"
      ></nl-viewport-intersection>
    </div>
  `,
};

export default meta;

// Define the story object type
type Story = StoryObj<ViewportIntersectionProps>;

// The "Default" story
export const Default: Story = {
  args: {
    debug: false,
  },
};

// A story to demonstrate the "debug" mode
export const Debug: Story = {
  args: {
    debug: true,
  },
};
