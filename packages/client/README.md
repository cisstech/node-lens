# @cisstech/node-lens-client

The NodeLens dashboard: the web UI the server serves at
`/node-lens/assets/`. It's a set of [Lit](https://lit.dev) web components, a
dockable shell that connects to the server over Server-Sent Events, plus a
design-system component library (`nl-table`, `nl-tabs`, `nl-tree`, `nl-select`,
editors, …) that plugins reuse for their own tabs.

## What plugin authors need from it

Every plugin tab receives a `NodeLensClient` instance on its custom element's
`client` property, which exposes:

- `client.events`: read stored events (`list`) and subscribe to live ones (`subscribe`)
- `client.commands`: call a plugin's server-side `handleCommand` (`execute`)
- `client.registry`: the plugins advertised by the current session

See the [plugin authoring guide](../../docs/PLUGIN_AUTHORING.md) for the full
contract; you rarely depend on this package directly beyond its exported types.

## Develop

```bash
npx nx build node-lens-client     # build the dashboard bundle
npx nx test node-lens-client      # unit tests
npx nx storybook node-lens-client # browse the component library
```
