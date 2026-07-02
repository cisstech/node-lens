# Contributing

Thanks for helping improve NodeLens.

## Development

This is an Nx workspace on Node 22 (see `.nvmrc`).

```bash
yarn install
yarn build     # nx run-many -t build
yarn test      # nx run-many -t test
yarn lint      # nx run-many -t lint
```

To try your changes against a real app, run the [blog sample](samples/blog):

```bash
docker compose up -d postgres
node packages/cli/bin/nls.js monitor --mode backend node samples/blog/index.js
```

## Commit messages

Commits follow [Conventional Commits](https://www.conventionalcommits.org)
(`feat:`, `fix:`, `docs:`, `refactor:`, `perf:`, `chore:`, ...). The changelog
and version bumps are generated from them.

## Releasing

Maintainers cut a release by bumping the version and changelog, then publishing:

```bash
yarn release:patch   # or release:minor / release:major
git push --follow-tags origin main
yarn publish:packages
```

CI can also publish through the "Publish to npm" workflow.

## Writing a plugin

See the [plugin authoring guide](docs/PLUGIN_AUTHORING.md).
