import type { NodeLensClient } from '@cisstech/node-lens-client';
import { LitElement, css, html } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { CollectionGroup, CollectionRequest, RequestEvent, Variable } from '../../../server/types';
import type { RouteInfo, VersioningInfo } from '../../types';
import { RequestHistory } from '../bottom/history';
import type { BodyMode, EditorTab, FormDataField, HistoryEntry, KeyValue } from '../types';
import { applyVariables, applyVariablesToKeyValue, buildFinalUrl, buildRouteUrl, keyValueToRecord } from '../utils';

import '../bottom/collections';
import '../bottom/history';
import '../bottom/variables';

const EXPLORER_ID_HEADER = 'x-node-lens-explorer-id';

// Minimal GraphQL introspection types (client-only)
type GqlTypeRef = { kind?: string; name?: string; ofType?: GqlTypeRef | null };
type IntrospectionArg = { name?: string; type?: GqlTypeRef | null };
type IntrospectionField = { name?: string; args?: IntrospectionArg[] };
type IntrospectionTypeData = { __type?: { name?: string; fields?: IntrospectionField[] } };
type IntrospectionTypeResult = { data?: IntrospectionTypeData };
type IntrospectionRootsData = { __schema?: { queryType?: { name?: string } | null; mutationType?: { name?: string } | null } };
type IntrospectionRootsResult = { data?: IntrospectionRootsData };

@customElement('nl-request-editor')
export class RequestEditor extends LitElement {
  @property({ attribute: false }) client!: NodeLensClient;
  @property({ attribute: false }) requests: RequestEvent[] = [];
  @property({ attribute: false }) route?: RouteInfo;
  @property({ attribute: false }) versioning?: VersioningInfo
  @property({ attribute: false }) collectionsEnabled = false;
  @property({ attribute: false }) variables: Variable[] = [];
  @property({ attribute: false }) collections: CollectionGroup[] = [];

  @state() private method = 'GET';
  @state() private url = '';
  @state() private headerRows: KeyValue[] = [{ key: 'Content-Type', value: 'application/json' }];
  @state() private activeTab: EditorTab = 'body';
  @state() private queryRows: KeyValue[] = [{ key: '', value: '' }];
  @state() private bodyMode: BodyMode = 'json';
  @state() private jsonText = '';
  @state() private urlParams: KeyValue[] = [{ key: '', value: '' }];
  @state() private formFields: FormDataField[] = [{ type: 'text', key: '', value: '' }];
  @state() private gqlQuery = `query Example {\n  __typename\n}`;
  @state() private gqlVariablesText = '{\n  \n}';
  @state() private pending = false;
  @state() private response: string | null = null;
  @state() private status: number | null = null;

  private requestId: string | null = null;
  private matchedEvent: RequestEvent | null = null;
  private cleanUpFns: (() => void)[] = [];
  private lastPreparedKey: string | null = null;

  override connectedCallback(): void {
    super.connectedCallback();
    const applyRequest = this.applyRequest.bind(this);
    this.client.addEventListener('request-replay', applyRequest);
    this.cleanUpFns.push(() => {
      this.client.removeEventListener('request-replay', applyRequest);
    });
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.cleanUpFns.forEach(fn => fn());
    this.cleanUpFns = [];
  }

  override updated(changed: Map<string, unknown>) {
    if (changed.has('route') && this.route) {
      this.method = this.route.method;
      const origin = this.client?.state?.appInfo?.origin ?? '';
      const { url, headers } = buildRouteUrl(origin, this.route, this.route.isGraphql ? undefined : this.versioning);
      this.url = url;
      if (headers) {
        this.headerRows = Object.entries(headers).map(([key, value]) => ({ key, value }));
      }
      if (this.route.isGraphql) {
        this.method = 'POST';
        this.bodyMode = 'graphql';
        this.ensureContentTypeForMode();
        const key = `${this.url}|${this.route.handler ?? ''}`;
        if (this.route.handler) {
          if (this.lastPreparedKey !== key) {
            this.lastPreparedKey = key;
            // Asynchronously prepare a template with args/variables if available
            this.prepareGraphQLTemplate(this.route.handler);
          }
        } else if (!this.gqlQuery || !/\b(query|mutation)\b/.test(this.gqlQuery)) {
          this.gqlQuery = `query Example {\n  __typename\n}`;
          this.gqlVariablesText = '{\n\n}';
          this.lastPreparedKey = key;
        }
      } else if (['POST', 'PUT', 'PATCH'].includes(this.method)) {
        this.bodyMode = 'json';
        this.ensureContentTypeForMode();
      }
    }

    if (this.pending && this.requestId) {
      const evt = this.requests.find(
        (e) => e.request.headers?.[EXPLORER_ID_HEADER] === this.requestId,
      );
      if (evt) {
        this.matchedEvent = evt;
        this.pending = false;
      }
    }
  }

  // --- GraphQL helpers ---
  private buildAbsoluteUrl(endpoint: string): string {
    if (/^https?:\/\//i.test(endpoint)) return endpoint;
    const base = (this.client?.state?.appInfo?.origin ?? '').replace(/\/$/, '');
    const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    return `${base}${path}`;
  }

  private typeRefToString(type: GqlTypeRef | undefined | null): string {
    if (!type) return 'Unknown';
    if (type.kind === 'NON_NULL') return `${this.typeRefToString(type.ofType ?? null)}!`;
    if (type.kind === 'LIST') return `[${this.typeRefToString(type.ofType ?? null)}]`;
    return type.name ?? 'Unknown';
  }

  private async prepareGraphQLTemplate(opName: string): Promise<void> {
    try {
      const endpoint = this.buildAbsoluteUrl(this.url);
      // Step 1: get root type names
      const rootsQuery = `query IntrospectRoots {\n  __schema { queryType { name } mutationType { name } }\n}`;
      const rootsRes = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: rootsQuery })
      });
      const rootsJson: IntrospectionRootsResult = await rootsRes.json();
      const queryTypeName = rootsJson?.data?.__schema?.queryType?.name ?? null;
      const mutationTypeName = rootsJson?.data?.__schema?.mutationType?.name ?? null;

      // Helper to fetch fields for a type
      const fetchFields = async (typeName: string): Promise<IntrospectionTypeResult | null> => {
        const q = `query IntrospectFields($name: String!) { __type(name: $name) { name fields { name args { name type { kind name ofType { kind name ofType { kind name ofType { kind name } } } } } } } }`;
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: q, variables: { name: typeName } })
        });
        return res.ok ? (await res.json() as IntrospectionTypeResult) : null;
      };

      let opType: 'query' | 'mutation' = 'query';
      let args: IntrospectionArg[] = [];

      // Try query root
      if (queryTypeName) {
        const t = await fetchFields(queryTypeName);
  const field = t?.data?.__type?.fields?.find((f: IntrospectionField | undefined) => f?.name === opName) || null;
        if (field) {
          opType = 'query';
          args = field.args ?? [];
        }
      }
      // If not found in query, try mutation root
      if (!args.length && mutationTypeName) {
        const t = await fetchFields(mutationTypeName);
  const field = t?.data?.__type?.fields?.find((f: IntrospectionField | undefined) => f?.name === opName) || null;
        if (field) {
          opType = 'mutation';
          args = field.args ?? [];
        }
      }

      // Build variables and template
      const sigParts: string[] = [];
      const callParts: string[] = [];
      const vars: Record<string, unknown> = {};
      for (const a of args) {
        if (!a?.name) continue;
        const t = this.typeRefToString(a.type ?? null);
        sigParts.push(`$${a.name}: ${t}`);
        callParts.push(`${a.name}: $${a.name}`);
        vars[a.name] = null; // MVP: null placeholders
      }
      const sig = sigParts.length ? `(${sigParts.join(', ')})` : '';
      const call = callParts.length ? `(${callParts.join(', ')})` : '';
      const header = `${opType} ${opName}${sig}`;
      const body = `${opName}${call}`;
      this.gqlQuery = `${header} {\n  ${body}\n}`;
      this.gqlVariablesText = JSON.stringify(vars, null, 2) || '{\n\n}';
  } catch {
      // Fall back to simple template if introspection fails
      this.gqlQuery = `query ${opName} {\n  ${opName}\n}`;
      this.gqlVariablesText = '{\n\n}';
    }
  }

  // --- GraphQL types for minimal introspection ---

  override render() {
    return html`
      <nl-split direction="vertical">
        <!-- TOP : Request Editor -->
        <div slot="start" class="editor-pane">
          ${this.renderEditor()}
        </div>

        <!-- BOTTOM : Vars / Collections Tabs -->
        <div slot="end" class="extras-pane">
          <nl-tabs variant="underline" activeKey="vars">
            <nl-tab key="vars" slot="tabs">Variables</nl-tab>
            <nl-tab key="collections" slot="tabs">Collections</nl-tab>
            <nl-tab key="history" slot="tabs">
              History
            </nl-tab>

            <nl-tab-panel key="vars" slot="panels">
              <nl-request-variables .variables=${this.variables}></nl-request-variables>
            </nl-tab-panel>

            <nl-tab-panel key="collections" slot="panels">
              <nl-request-collections
                .collections=${this.collections}
                @apply-collection=${(e: CustomEvent<CollectionRequest>) => { this.applyCollection(e.detail); }}
              ></nl-request-collections>
            </nl-tab-panel>

            <nl-tab-panel key="history" slot="panels">
               <nl-request-history
                @apply-history=${(e: CustomEvent<HistoryEntry>) => { this.applyHistory(e.detail); }}
              ></nl-request-history>
            </nl-tab-panel>
          </nl-tabs>
        </div>
      </nl-split>
    `;
  }

  applyRequest(e: Event) {
    e.preventDefault();
    e.stopPropagation();

    const event = (e as CustomEvent<RequestEvent>).detail;
    this.method = event.request.method;
    this.url = event.request.url;
    this.headerRows = Object.entries(event.request.headers ?? {}).map(([key, value]) => ({
      key,
      value: Array.isArray(value) ? value.join(', ') : String(value),
    }));
    this.queryRows = event.request.query
      ? Object.entries(event.request.query).map(([key, value]) => ({
        key,
        value: Array.isArray(value) ? value.join(', ') : String(value),
      }))
      : [];
    if (event.request.body) {
      if (typeof event.request.body === 'string') {
        this.bodyMode = 'json';
        this.jsonText = event.request.body;
      } else if (event.request.headers?.['content-type']?.includes('application/x-www-form-urlencoded')) {
        this.bodyMode = 'urlencoded';
        try {
          const params = new URLSearchParams(event.request.body as string);
          this.urlParams = Array.from(params.entries()).map(([key, value]) => ({ key, value }));
        } catch {
          this.urlParams = [];
        }
      } else {
        this.bodyMode = 'json';
        this.jsonText = JSON.stringify(event.request.body, null, 2);
      }
    } else {
      this.bodyMode = 'json';
      this.jsonText = '';
    }
    this.sendRequest()
  }

  private applyVariablesToRecord(rows: KeyValue[]): KeyValue[] {
    return applyVariablesToKeyValue(rows, this.variables);
  }

  private applyHistory(entry: HistoryEntry) {
    this.method = entry.method;
    this.url = entry.url;
    this.headerRows = [...entry.headers];
    this.queryRows = [...entry.query];
    this.bodyMode = entry.bodyMode;
    this.jsonText = entry.jsonText;
    this.urlParams = [...entry.urlParams];
    this.formFields = [...entry.formFields];
    this.gqlQuery = entry.gqlQuery;
    this.gqlVariablesText = entry.gqlVariablesText;
  }

  private applyCollection(req: CollectionRequest) {
    this.method = req.method;
    this.url = req.url;
    this.headerRows = [...(req.headers ?? [])];
    this.queryRows = [...(req.query ?? [])];
    this.bodyMode = req.bodyMode || 'json';
    this.jsonText = req.jsonText ?? '';
    this.urlParams = [...(req.urlParams ?? [])];
    this.gqlQuery = req.gqlQuery ?? '';
    this.gqlVariablesText = req.gqlVariablesText ?? '';
  }

  private isBodyAllowed(): boolean {
    const m = this.method.toUpperCase();
    return !['GET', 'HEAD'].includes(m);
  }

  private setHeader(name: string, value?: string) {
    const normalizedName = name.toLowerCase();
    let updated = false;
    let rows = this.headerRows.map(row => {
      if (row.key.toLowerCase() === normalizedName) {
        updated = true;
        return value == null || value === '' ? null : { key: name, value };
      }
      return row;
    }).filter(Boolean) as KeyValue[];

    if (!updated && value != null && value !== '') {
      rows = [...rows, { key: name, value }];
    }
    this.headerRows = rows;
  }

  private ensureContentTypeForMode() {
    if (!this.isBodyAllowed()) return;
    switch (this.bodyMode) {
      case 'json':
      case 'graphql':
        this.setHeader('Content-Type', 'application/json');
        break;
      case 'urlencoded':
        this.setHeader('Content-Type', 'application/x-www-form-urlencoded;charset=UTF-8');
        break;
      case 'formdata':
        this.setHeader('Content-Type', undefined);
        break;
    }
  }

  private buildRequestUrl(): string {
    const base = this.client?.state?.appInfo?.origin ?? window.location.origin;
    return buildFinalUrl(base, this.url, this.queryRows, this.variables);
  }

  private buildBody(): BodyInit | undefined {
    if (!this.isBodyAllowed()) return undefined;

    switch (this.bodyMode) {
      case 'json':
        return applyVariables(this.jsonText, this.variables) || '';
      case 'urlencoded': {
        const params = new URLSearchParams();
        for (const row of this.urlParams) {
          if (row.key) {
            params.append(
              applyVariables(row.key, this.variables),
              applyVariables(row.value ?? '', this.variables)
            );
          }
        }
        return params.toString();
      }
      case 'formdata': {
        const fd = new FormData();
        for (const field of this.formFields) {
          if (!field.key) continue;
          if (field.type === 'text') {
            fd.append(
              applyVariables(field.key, this.variables),
              applyVariables(field.value ?? '', this.variables)
            );
          } else if (field.type === 'file' && field.file) {
            fd.append(applyVariables(field.key, this.variables), field.file, field.file.name);
          }
        }
        return fd;
      }
      case 'graphql': {
        let variables: unknown = {};
        try {
          variables = this.gqlVariablesText
            ? JSON.parse(applyVariables(this.gqlVariablesText, this.variables))
            : {};
        } catch {
          variables = {};
        }
        return JSON.stringify({
          query: applyVariables(this.gqlQuery, this.variables),
          variables,
        });
      }
    }
  }

  private onBodyModeChange(e: CustomEvent) {
    this.bodyMode = e.detail.value as BodyMode;
    this.ensureContentTypeForMode();
  }

  private addQueryRow() {
    this.queryRows = [...this.queryRows, { key: '', value: '' }];
  }

  private removeQueryRow(i: number) {
    this.queryRows = this.queryRows.filter((_, idx) => idx !== i);
  }

  private setQueryRow(i: number, field: 'key' | 'value', value: string) {
    this.queryRows = this.queryRows.map((row, idx) =>
      idx === i ? { ...row, [field]: value } : row
    );
  }

  private addHeaderRow() {
    this.headerRows = [...this.headerRows, { key: '', value: '' }];
  }

  private removeHeaderRow(i: number) {
    this.headerRows = this.headerRows.filter((_, idx) => idx !== i);
  }

  private setHeaderRow(i: number, field: 'key' | 'value', value: string) {
    this.headerRows = this.headerRows.map((row, idx) =>
      idx === i ? { ...row, [field]: value } : row
    );
  }

  private addUrlParam() {
    this.urlParams = [...this.urlParams, { key: '', value: '' }];
  }

  private removeUrlParam(i: number) {
    this.urlParams = this.urlParams.filter((_, idx) => idx !== i);
  }

  private setUrlParam(i: number, field: 'key' | 'value', value: string) {
    this.urlParams = this.urlParams.map((row, idx) =>
      idx === i ? { ...row, [field]: value } : row
    );
  }

  private addFormField(type: 'text' | 'file') {
    this.formFields = [
      ...this.formFields,
      type === 'text'
        ? { type: 'text', key: '', value: '' }
        : { type: 'file', key: '', value: '', file: null },
    ];
  }

  private removeFormField(i: number) {
    this.formFields = this.formFields.filter((_, idx) => idx !== i);
  }

  private setFormFieldKey(i: number, key: string) {
    this.formFields = this.formFields.map((row, idx) =>
      idx === i ? { ...row, key } : row
    );
  }

  private setFormFieldValue(i: number, value: string) {
    this.formFields = this.formFields.map((row, idx) =>
      idx === i ? { ...row, value } : row
    );
  }

  private setFormFieldFile(i: number, file: File | null) {
    this.formFields = this.formFields.map((row, idx) =>
      idx === i ? { ...row, file } : row
    );
  }

  private selectTab(e: CustomEvent<{ key: EditorTab }>) {
    this.activeTab = e.detail.key;
  }

  private renderHeadersTab() {
    return html`
      <div class="box">
        <div class="box-title">
          Headers
          <div class="box-actions">
            <nl-button variant="ghost" @click=${this.addHeaderRow}>+ Add header</nl-button>
          </div>
        </div>
        <div class="kv">
          ${this.headerRows.map((row, i) => html`
            <div class="kv-row">
              <nl-input
                placeholder="Header name"
                .value=${row.key}
                @input=${(e: InputEvent) => this.setHeaderRow(i, 'key', (e.target as HTMLInputElement).value)}
              ></nl-input>
              <nl-input
                placeholder="Header value"
                .value=${row.value}
                @input=${(e: InputEvent) => this.setHeaderRow(i, 'value', (e.target as HTMLInputElement).value)}
              ></nl-input>
              <nl-button variant="ghost" title="Remove" @click=${() => this.removeHeaderRow(i)}>
                <nl-codicon icon="trash"></nl-codicon>
              </nl-button>
            </div>
          `)}
          <div class="muted tip">
            Content-Type is auto-managed based on body mode (JSON / URL-Encoded / FormData / GraphQL).
          </div>
        </div>
      </div>
    `;
  }

  private renderQueryTab() {
    return html`
      <div class="box">
        <div class="box-title">
          Query Params
          <div class="box-actions">
            <nl-button variant="ghost" @click=${this.addQueryRow}>+ Add param</nl-button>
          </div>
        </div>
        <div class="kv">
          ${this.queryRows.map((row, i) => html`
            <div class="kv-row">
              <nl-input
                placeholder="key"
                .value=${row.key}
                @input=${(e: InputEvent) => this.setQueryRow(i, 'key', (e.target as HTMLInputElement).value)}
              ></nl-input>
              <nl-input
                placeholder="value"
                .value=${row.value}
                @input=${(e: InputEvent) => this.setQueryRow(i, 'value', (e.target as HTMLInputElement).value)}
              ></nl-input>
              <nl-button variant="ghost" title="Remove" @click=${() => this.removeQueryRow(i)}>
                <nl-codicon icon="trash"></nl-codicon>
              </nl-button>
            </div>
          `)}
          <div class="muted tip">These params are merged with the URL’s query string. Same keys are replaced.</div>
        </div>
      </div>
    `;
  }

  private renderBodyTab() {
    if (!this.isBodyAllowed()) {
      return html`<div class="muted">No body for ${this.method} requests.</div>`;
    }

    return html`
      <div class="form-inline">
        <nl-select
          style="width:260px"
          .value=${this.bodyMode}
          .options=${[
        { value: 'json', label: 'Body: JSON' },
        { value: 'urlencoded', label: 'Body: Form URL Encoded' },
        { value: 'formdata', label: 'Body: Multipart Form Data' },
        { value: 'graphql', label: 'Body: GraphQL' },
      ]}
          @change=${this.onBodyModeChange}
        ></nl-select>
      </div>

      ${this.bodyMode === 'json' ? html`
        <div class="box">
          <div class="box-title">Body (JSON)</div>
          <textarea
            placeholder='{"hello":"world"}'
            .value=${this.jsonText}
            @input=${(e: InputEvent) => (this.jsonText = (e.target as HTMLTextAreaElement).value)}
          ></textarea>
        </div>
      ` : this.bodyMode === 'urlencoded' ? html`
        <div class="box">
          <div class="box-title">
            Body (x-www-form-urlencoded)
            <div class="box-actions">
              <nl-button variant="ghost" @click=${this.addUrlParam}>+ Add field</nl-button>
            </div>
          </div>
          <div class="kv">
            ${this.urlParams.map((row, i) => html`
              <div class="kv-row">
                <nl-input
                  placeholder="key"
                  .value=${row.key}
                  @input=${(e: InputEvent) => this.setUrlParam(i, 'key', (e.target as HTMLInputElement).value)}
                ></nl-input>
                <nl-input
                  placeholder="value"
                  .value=${row.value}
                  @input=${(e: InputEvent) => this.setUrlParam(i, 'value', (e.target as HTMLInputElement).value)}
                ></nl-input>
                <nl-button variant="ghost" @click=${() => this.removeUrlParam(i)}>
                  <nl-codicon icon="trash"></nl-codicon>
                </nl-button>
              </div>
            `)}
          </div>
        </div>
      ` : this.bodyMode === 'formdata' ? html`
        <div class="box">
          <div class="box-title">
            Body (multipart/form-data)
            <div class="box-actions">
              <nl-button variant="ghost" @click=${() => this.addFormField('text')}>+ Text</nl-button>
              <nl-button variant="ghost" @click=${() => this.addFormField('file')}>+ File</nl-button>
            </div>
          </div>
          <div class="fd">
            ${this.formFields.map((row, i) => html`
              <div class="fd-row">
                <nl-input
                  placeholder="field name"
                  .value=${row.key}
                  @input=${(e: InputEvent) => this.setFormFieldKey(i, (e.target as HTMLInputElement).value)}
                ></nl-input>

                ${row.type === 'text' ? html`
                  <nl-input
                    placeholder="value"
                    .value=${row.value}
                    @input=${(e: InputEvent) => this.setFormFieldValue(i, (e.target as HTMLInputElement).value)}
                  ></nl-input>
                ` : html`
                  <input
                    class="file"
                    type="file"
                    @change=${(e: Event) => {
            const f = (e.target as HTMLInputElement).files?.[0] ?? null;
            this.setFormFieldFile(i, f);
          }}
                  />
                `}
                <nl-button variant="ghost" @click=${() => this.removeFormField(i)}>
                  <nl-codicon icon="trash"></nl-codicon>
                </nl-button>
              </div>
            `)}
            <div class="muted tip">Content-Type is set automatically (boundary handled by the browser).</div>
          </div>
        </div>
      ` : html`
        <div class="box">
          <div class="box-title">GraphQL</div>
          <div class="gql">
            <div class="col">
              <div class="sub">Query</div>
              <textarea
                class="gql-text"
                .value=${this.gqlQuery}
                @input=${(e: InputEvent) => (this.gqlQuery = (e.target as HTMLTextAreaElement).value)}
              ></textarea>
            </div>
            <div class="col">
              <div class="sub">Variables (JSON)</div>
              <textarea
                class="gql-text"
                .value=${this.gqlVariablesText}
                @input=${(e: InputEvent) => (this.gqlVariablesText = (e.target as HTMLTextAreaElement).value)}
              ></textarea>
            </div>
          </div>
        </div>
      `}
    `;
  }

  private renderEditor() {
    return html`
      <div class="form">
        <nl-select
          .value=${this.method}
          .options=${['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'].map(m => ({ value: m, label: m }))}
          @change=${(e: CustomEvent) => (this.method = e.detail.value)}
        >
          <nl-codicon slot="icon" icon="symbol-method"></nl-codicon>
        </nl-select>

        <nl-input
          style="flex:1;"
          placeholder="/api/resource"
          .value=${this.url}
          @input=${(e: InputEvent) => (this.url = (e.target as HTMLInputElement).value)}
        ></nl-input>

        <nl-button variant="primary" ?disabled=${this.pending} @click=${this.sendRequest}>
          ${this.pending ? html`<nl-spinner></nl-spinner>` : 'Send'}
        </nl-button>
      </div>

      <nl-tabs variant="underline" .activeKey=${this.activeTab} @tab-click=${this.selectTab.bind(this)}>
        <nl-tab key="headers" slot="tabs">Headers</nl-tab>
        <nl-tab key="query" slot="tabs">Query</nl-tab>
        <nl-tab key="body" slot="tabs">Body</nl-tab>

        <nl-tab-panel key="headers" slot="panels">
          ${this.renderHeadersTab()}
        </nl-tab-panel>
        <nl-tab-panel key="query" slot="panels">
          ${this.renderQueryTab()}
        </nl-tab-panel>
        <nl-tab-panel key="body" slot="panels">
          ${this.renderBodyTab()}
        </nl-tab-panel>
      </nl-tabs>

      <div class="response">
        ${this.pending
        ? html`<div class="muted">
          <nl-spinner></nl-spinner>
          Waiting for response...
        </div>`
        : this.matchedEvent
          ? html`<nl-request-details
              .event=${this.matchedEvent}
              @request-replay=${this.applyRequest.bind(this)}>
            </nl-request-details>`
          : this.response !== null
            ? html`<div class="status">Status: ${this.status ?? '—'}</div><pre>${this.response}</pre>`
            : html`<div class="muted">No response yet.</div>`}
      </div>
    `;
  }

  private async sendRequest() {
    if (!this.url) return;
    this.pending = true;
    this.response = null;
    this.status = null;
    this.matchedEvent = null;
    this.requestId = null;

    this.ensureContentTypeForMode();

    const headers = keyValueToRecord(this.applyVariablesToRecord(this.headerRows));
    if (this.bodyMode === 'formdata') {
      for (const key of Object.keys(headers)) {
        if (key.toLowerCase() === 'content-type') delete headers[key];
      }
    }

    const finalUrl = this.buildRequestUrl();
    const origin = this.client?.state?.appInfo?.origin ?? '';

    const isInternal = finalUrl.startsWith(origin);
    if (isInternal) {
      this.requestId = crypto.randomUUID();
      headers[EXPLORER_ID_HEADER] = this.requestId;
    }

    try {
      const res = await fetch(finalUrl, {
        method: this.method,
        headers,
        body: this.buildBody(),
      });
      if (!isInternal) {
        this.status = res.status;
        this.response = await res.text();
        this.pending = false;
      }

      const entry: HistoryEntry = {
        id: crypto.randomUUID(),
        ts: Date.now(),
        method: this.method,
        url: this.url,
        headers: this.headerRows,
        query: this.queryRows,
        bodyMode: this.bodyMode,
        jsonText: this.jsonText,
        urlParams: this.urlParams,
        formFields: this.formFields,
        gqlQuery: this.gqlQuery,
        gqlVariablesText: this.gqlVariablesText,
      };

      const historyEl = this.renderRoot.querySelector<RequestHistory>('nl-request-history');
      historyEl?.add(entry);
    } catch (err) {
      this.response = `Error: ${err}`;
      this.status = 0;
      this.pending = false;
    }
  }

  static override styles = css`
    :host {
      display: block;
      height: 100%;
      font-family: var(--nl-font-family-sans);
      font-size: var(--nl-font-size-base);
      color: var(--nl-text-primary);
    }
    nl-split {
      height: 100%;
    }
    .editor-pane {
      overflow-y: auto;
      height: 100%;
    }
    .extras-pane {
      overflow-y: auto;
      height: 100%;
      border-top: 1px solid var(--nl-surface-border);
    }

    nl-tabs {
      height: auto;
    }
    .form {
      display: flex;
      gap: var(--nl-spacing-md);
      align-items: center;
      margin-bottom: var(--nl-spacing-md);
      flex-wrap: wrap;
    }

    .form nl-select {
      width: 120px;
    }

    .form-inline {
      margin-bottom: var(--nl-spacing-sm);
    }

    .box {
      border: 1px solid var(--nl-surface-border);
      border-radius: var(--nl-border-radius);
      overflow: hidden;
      margin-bottom: var(--nl-spacing-md);
      background: var(--nl-surface-control);
    }
    .box-title {
      padding: 6px 8px;
      border-bottom: 1px solid var(--nl-surface-border);
      background: var(--nl-surface-popover);
      font-weight: 600;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }
    .box-actions {
      display: flex;
      gap: 6px;
    }

    textarea {
      width: 100%;
      min-height: 120px;
      font-family: ui-monospace, monospace;
      font-size: 13px;
      padding: var(--nl-spacing-sm);
      border: 0;
      outline: none;
      background: var(--nl-surface-app);
      color: var(--nl-text-primary);
    }

    .kv,
    .fd {
      padding: var(--nl-spacing-md);
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .kv-row,
    .fd-row {
      display: grid;
      grid-template-columns: 1fr 1fr 36px;
      gap: 8px;
      align-items: center;
    }
    .fd-row .file {
      height: 28px;
      align-self: stretch;
    }

    .gql {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: var(--nl-spacing-md);
      padding: var(--nl-spacing-md);
    }
    .gql .sub {
      font-size: 12px;
      color: var(--nl-text-secondary);
      margin-bottom: 4px;
    }

    .response {
      margin-top: var(--nl-spacing-md);
      font-size: 13px;
    }

    .status {
      font-weight: 600;
      margin-bottom: 6px;
    }

    .muted {
      display: flex;
      align-items: center;
      gap: 6px;
      color: var(--nl-text-secondary);
      font-style: italic;
    }
  `;
}
