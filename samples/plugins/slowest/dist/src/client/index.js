// Plain custom element — no framework. NodeLens sets the `client` property on it.
class NlSlowest extends HTMLElement {
  set client(c) {
    this._client = c
    this.refresh()
  }

  connectedCallback() {
    this.innerHTML = '<div style="padding:16px;font-family:monospace">loading…</div>'
  }

  async refresh() {
    try {
      const rows = await this._client.commands.execute('node-lens-example-slowest', 'ranking')
      const list = (rows || [])
        .map((r) => `<tr><td style="padding:4px 12px">${r.route}</td><td style="padding:4px 12px;text-align:right">${r.maxMs.toFixed(1)} ms</td><td style="padding:4px 12px;text-align:right">${r.count}</td></tr>`)
        .join('')
      this.innerHTML = `<div style="padding:16px">
        <h3 style="margin:0 0 12px">Top slowest endpoints</h3>
        <table style="border-collapse:collapse;font-family:monospace;font-size:12px">
          <thead><tr><th style="text-align:left;padding:4px 12px">Route</th><th style="padding:4px 12px">Max</th><th style="padding:4px 12px">Hits</th></tr></thead>
          <tbody>${list || '<tr><td style="padding:4px 12px">no data yet</td></tr>'}</tbody>
        </table>
      </div>`
    } catch (e) {
      this.innerHTML = `<div style="padding:16px;color:#c00">plugin error: ${e.message}</div>`
    }
  }
}

customElements.define('nl-slowest', NlSlowest)
