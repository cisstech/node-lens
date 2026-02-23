import type { Meta, StoryObj } from "@storybook/web-components";
import { html } from "lit";
import type { NodeLensAppInfo, NodeLensState, PluginManifest } from "../types";
import "./button";
import "./codicon";
import "./nodelens";
import type { NodeLens } from "./nodelens";

const meta: Meta<NodeLens> = {
  title: "NodeLens/App",
  component: "node-lens",
  parameters: {
    layout: "fullscreen",
  },
};
export default meta;
type Story = StoryObj<NodeLens>;

const mockPlugins: PluginManifest[] = [
  {
    packageName: "@nodelens/plugin-routes",
    displayName: "Routes",
    tagName: "app-routes",
    icon: "🗺️",
    description: "Explore your app routes",
    url: "/plugins/routes",
  },
  {
    packageName: "@nodelens/plugin-config",
    displayName: "Configuration",
    tagName: "app-config",
    icon: "⚙️",
    description: "View your app configuration",
    url: "/plugins/config",
  },
  {
    packageName: "@nodelens/plugin-deps",
    displayName: "Dependencies",
    tagName: "app-deps",
    icon: "📦",
    description: "Manage your dependencies",
    url: "/plugins/deps",
  },
  {
    packageName: "@nodelens/plugin-info",
    displayName: "App Info",
    tagName: "app-info",
    icon: "ℹ️",
    description: "General app information",
    url: "/plugins/info",
  },
];

const mockAppInfo: NodeLensAppInfo = {
  framework: "express" as const,
  frameworkVersion: "4.18.2",
  platform: "express" as const,
  port: 3000,
  origin: "http://localhost:3000",
};

const renderComponent = (args: Partial<NodeLens>) => html`
  <node-lens
    .state=${args.state}
    .isExpanded=${args.isExpanded || false}
    .expandedPlugin=${args.expandedPlugin || null}
    .fullscreenPlugin=${args.fullscreenPlugin || null}
  ></node-lens>
`;

export const Disconnected: Story = {
  args: {
    state: { status: "disconnected", plugins: [] },
  },
  render: renderComponent,
};

export const Connecting: Story = {
  args: {
    state: { status: "connecting", plugins: [] },
  },
  render: renderComponent,
};

export const Connected: Story = {
  args: {
    state: {
      status: "connected",
      plugins: mockPlugins,
      appInfo: mockAppInfo,
    } as NodeLensState,
  },
  render: renderComponent,
};

export const Expanded: Story = {
  args: {
    ...Connected.args,
    isExpanded: true,
  },
  render: renderComponent,
};

export const PluginDetail: Story = {
  args: {
    ...Expanded.args,
    expandedPlugin: "@nodelens/plugin-routes",
  },
  render: renderComponent,
};

export const Fullscreen: Story = {
  args: {
    ...Expanded.args,
    fullscreenPlugin: "@nodelens/plugin-config",
  },
  render: renderComponent,
};
