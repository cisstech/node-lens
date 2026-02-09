/* Example server plugin skeleton. Adjust as needed. */
// Logs plugin implementation; reuses EventBus & NodeLensPlugin types from @cisstech/node-lens-server (workspace or npm)
import type { EventBus, NodeLensPlugin } from './_types-shim.js'

// Replaced during generation
export const __PLUGIN_CONST__ = '__PLUGIN_NAME__'

export interface MyPluginOptions {
  /* add option fields */
}

export class MyPlugin implements NodeLensPlugin {
  readonly icon = '🧩'
  readonly description = 'MyPlugin for NodeLens'
  constructor(private readonly options: Partial<MyPluginOptions> = {}) {}
  async attach(eventBus: EventBus): Promise<void> {
    // setup / subscribe
    this._bus = eventBus
  }
  private _bus?: EventBus
}

export const createMyPlugin = (opts?: Partial<MyPluginOptions>) => new MyPlugin(opts)
