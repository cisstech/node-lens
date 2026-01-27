import { PluginManager } from './manager'
import type { AppInfo, NodeLensPlugin } from './types'

function fakePlugin(name: string, isAvailable?: (a: AppInfo) => boolean): NodeLensPlugin {
  return {
    icon: 'x',
    tagName: `nl-${name}`,
    displayName: name,
    packageName: `@test/${name}`,
    description: name,
    bindToEventBus: () => undefined,
    ...(isAvailable ? { isAvailable } : {}),
  }
}

const expressApp = { framework: 'express' } as AppInfo
const nestApp = { framework: 'nestjs' } as AppInfo

describe('PluginManager.getHandshakePlugins', () => {
  it('includes every plugin when no appInfo is provided', () => {
    const m = new PluginManager('/node-lens/')
    m.registerPlugin(fakePlugin('a'))
    m.registerPlugin(fakePlugin('b', (a) => a.framework === 'nestjs'))
    expect(m.getHandshakePlugins().map((p) => p.displayName)).toEqual(['a', 'b'])
  })

  it('hides plugins whose isAvailable() returns false for the running app', () => {
    const m = new PluginManager('/node-lens/')
    m.registerPlugin(fakePlugin('request'))
    m.registerPlugin(fakePlugin('introspection', (a) => a.framework === 'nestjs'))

    expect(m.getHandshakePlugins(expressApp).map((p) => p.displayName)).toEqual(['request'])
    expect(m.getHandshakePlugins(nestApp).map((p) => p.displayName)).toEqual(['request', 'introspection'])
  })
})
