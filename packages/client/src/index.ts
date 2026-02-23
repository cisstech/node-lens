import { NodeLensClient } from './lib/core/node-lens-client';
export type { CommandExecutor } from './lib/core/commands';
export type { EventStore, HttpEventStore } from './lib/core/event-store';
export type { NodeLensClient } from './lib/core/node-lens-client';
export type { ConnectionStatus, HandshakeEvent, NodeLensAppInfo, NodeLensConfig, NodeLensState, PluginManifest } from './lib/types';

import './lib/components/attributes';
import './lib/components/badge';
import './lib/components/button';
import './lib/components/card';
import './lib/components/codemirror-editor';
import './lib/components/codicon';
import './lib/components/divider';
import './lib/components/grid';
import './lib/components/input';
import './lib/components/list';
import './lib/components/nodelens';
import './lib/components/plugin-view';
import './lib/components/popover';
import './lib/components/select';
import './lib/components/space';
import './lib/components/spinner';
import './lib/components/split';
import './lib/components/table';
import './lib/components/tabs';
import './lib/components/toggle';
import './lib/components/toolbar';
import './lib/components/tree';
import './lib/components/viewport-intersection';

export * from './lib/components/attributes';
export * from './lib/components/badge';
export * from './lib/components/button';
export * from './lib/components/card';
export * from './lib/components/codemirror-editor';
export * from './lib/components/codicon';
export * from './lib/components/divider';
export * from './lib/components/grid';
export * from './lib/components/input';
export * from './lib/components/list';
export * from './lib/components/nodelens';
export * from './lib/components/plugin-view';
export * from './lib/components/popover';
export * from './lib/components/select';
export * from './lib/components/space';
export * from './lib/components/spinner';
export * from './lib/components/split';
export * from './lib/components/table';
export * from './lib/components/tabs';
export * from './lib/components/toggle';
export * from './lib/components/toolbar';
export * from './lib/components/tree';
export * from './lib/components/viewport-intersection';

window.NodeLensClient = NodeLensClient;

declare global {
  interface Window {
    NodeLensClient: typeof NodeLensClient;
    nodeLensInstance: NodeLensClient;
  }
}
