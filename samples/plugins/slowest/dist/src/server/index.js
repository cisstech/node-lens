'use strict'
// Reference plugin — see docs/PLUGIN_AUTHORING.md. No build step: this file is
// both the source and the shipped dist/src/server/index.js.
const { OTEL_TRACE_EVENT } = require('@cisstech/node-lens-server')

const PLUGIN_NAME = 'node-lens-example-slowest'

class SlowestPlugin {
  constructor() {
    this.icon = 'flame'
    this.tagName = 'nl-slowest'
    this.displayName = 'Slowest'
    this.packageName = PLUGIN_NAME
    this.description = 'Top slowest HTTP endpoints'
    this.top = new Map()
  }

  bindToEventBus(eventBus) {
    eventBus.on(OTEL_TRACE_EVENT, (info) => {
      const spans = info.data || []
      for (const span of spans) {
        const attrs = span.attributes || {}
        const route = attrs['http.route'] || attrs['http.target']
        if (!route || span.kind !== 1 /* SpanKind.SERVER */) continue
        const durMs = span.duration ? span.duration[0] * 1000 + span.duration[1] / 1e6 : 0
        const prev = this.top.get(route) || { route, count: 0, maxMs: 0 }
        prev.count++
        prev.maxMs = Math.max(prev.maxMs, durMs)
        this.top.set(route, prev)
      }
      const ranking = [...this.top.values()].sort((a, b) => b.maxMs - a.maxMs).slice(0, 10)
      eventBus.emit('slowest', ranking, PLUGIN_NAME)
    })
  }

  async handleCommand(command) {
    if (command === 'ranking') {
      return [...this.top.values()].sort((a, b) => b.maxMs - a.maxMs).slice(0, 10)
    }
    throw new Error(`Unknown command: ${command}`)
  }
}

module.exports = { SlowestPlugin }
