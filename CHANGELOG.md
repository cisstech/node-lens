# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

### 0.1.2 (2026-10-29)


### Features

* **client:** dashboard shell and design-system components ([c0b152d](https://github.com/cisstech/node-lens/commit/c0b152dba9c48e178604b06a3975ebf0215e2d69))
* **cli:** monitor a Node app with zero-config instrumentation ([8f0ba8f](https://github.com/cisstech/node-lens/commit/8f0ba8f9cf242f0c0bbd646a08848f903c9580f1))
* **database:** query monitoring, N+1 detection, and a query playground ([e7cfe4e](https://github.com/cisstech/node-lens/commit/e7cfe4e8924e89cb86bc9b476f7475b4f88882b1))
* **introspection:** NestJS module, provider, and route introspection ([e0c7b43](https://github.com/cisstech/node-lens/commit/e0c7b43096adcab128a2eb3c9dee5f5d5d68b7c2))
* **logging:** capture and correlate application logs ([68f2a7c](https://github.com/cisstech/node-lens/commit/68f2a7c5db0c600f37bd688306c6047b5aa9bc22))
* **mcp:** expose runtime data to AI agents over MCP ([0ae44ef](https://github.com/cisstech/node-lens/commit/0ae44effee120763d4bac30e344a2a2fc63002db))
* **request:** HTTP request monitoring with interactive timelines ([01491ff](https://github.com/cisstech/node-lens/commit/01491ff2a7e58e8ae25120efde11d8926676206a))
* **server:** OpenTelemetry bridge, event bus, and plugin framework ([2801faa](https://github.com/cisstech/node-lens/commit/2801faa8904a33cdda7a9b109c2abc4652b1d675))


### Bug Fixes

* **build:** build the server once before plugins to stop CI races ([9f8087a](https://github.com/cisstech/node-lens/commit/9f8087aee5f7bdbbdb37d91b0aedb10b28eefdfd))
* **build:** reference the server project from plugin server builds ([1495a5e](https://github.com/cisstech/node-lens/commit/1495a5e6efce35f1e819a4b2d3110abc1814ef5a))
* **ci:** disable setup-node's package-manager cache ([691287a](https://github.com/cisstech/node-lens/commit/691287aea16b986efe35076797e5e8ce04db6efc))
* **ci:** run CI on yarn 4 via corepack ([78ddc9b](https://github.com/cisstech/node-lens/commit/78ddc9b171bf4d670ae4aa3fa7b0ebfabe861e79))
* **client:** load jest config as ESM so CI tests run ([db79202](https://github.com/cisstech/node-lens/commit/db79202398f03c5aa5fc194d508a36d75a2eafa7))
* **cli:** ship the dashboard so a single install works ([e911484](https://github.com/cisstech/node-lens/commit/e911484bfebde2e61ad78f30f64ba30b395d438b))
* **release:** generate the changelog and push the release tag ([d7e2fb3](https://github.com/cisstech/node-lens/commit/d7e2fb3e701af8f3bf2b5fa9ca18048cc98b541d))

### 0.1.1 (2026-07-07)

### Features

* **cli:** monitor a Node app with zero-config instrumentation ([8f0ba8f](https://github.com/cisstech/node-lens/commit/8f0ba8f9cf242f0c0bbd646a08848f903c9580f1))
* **server:** OpenTelemetry bridge, event bus, and plugin framework ([2801faa](https://github.com/cisstech/node-lens/commit/2801faa8904a33cdda7a9b109c2abc4652b1d675))
* **client:** dashboard shell and design-system components ([c0b152d](https://github.com/cisstech/node-lens/commit/c0b152dba9c48e178604b06a3975ebf0215e2d69))
* **request:** HTTP request monitoring with interactive timelines ([01491ff](https://github.com/cisstech/node-lens/commit/01491ff2a7e58e8ae25120efde11d8926676206a))
* **database:** query monitoring, N+1 detection, and a query playground ([e7cfe4e](https://github.com/cisstech/node-lens/commit/e7cfe4e8924e89cb86bc9b476f7475b4f88882b1))
* **logging:** capture and correlate application logs ([68f2a7c](https://github.com/cisstech/node-lens/commit/68f2a7c5db0c600f37bd688306c6047b5aa9bc22))
* **introspection:** NestJS module, provider, and route introspection ([e0c7b43](https://github.com/cisstech/node-lens/commit/e0c7b43096adcab128a2eb3c9dee5f5d5d68b7c2))
* **mcp:** expose runtime data to AI agents over MCP ([0ae44ef](https://github.com/cisstech/node-lens/commit/0ae44effee120763d4bac30e344a2a2fc63002db))

### Bug Fixes

* **cli:** ship the dashboard so a single install works ([e911484](https://github.com/cisstech/node-lens/commit/e911484bfebde2e61ad78f30f64ba30b395d438b))
