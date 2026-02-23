/* eslint-disable @typescript-eslint/no-explicit-any */
import { LitElement, css, html, unsafeCSS } from 'lit'
import { customElement, property, query, state } from 'lit/decorators.js'
import CodeMirror from 'codemirror'
import 'codemirror/mode/sql/sql.js'
import 'codemirror/mode/javascript/javascript.js'
import cmBaseCss from 'codemirror/lib/codemirror.css?inline'
import cmEclipseCss from 'codemirror/theme/eclipse.css?inline'
import cmDraculaCss from 'codemirror/theme/dracula.css?inline'

declare global {
  interface HTMLElementTagNameMap {
    'nl-codemirror-editor': CodemirrorEditor
  }
}

@customElement('nl-codemirror-editor')
export class CodemirrorEditor extends LitElement {
  @property({ type: String }) value = ''
  @property({ type: String }) language: 'sql' | 'json' | 'javascript' = 'sql'
  @property({ type: Boolean }) readOnly = false
  @property({ type: String }) placeholder = 'Start typing…'
  @property({ type: Boolean }) autoHeight = false
  @property({ type: Number }) maxHeight = 420

  @state() private _empty = true
  @query('#editor') private textarea!: HTMLTextAreaElement

  private cm: any

  // --- Lifecycle ---
  override firstUpdated() {
    this.createEditor()
  }

  override disconnectedCallback() {
    super.disconnectedCallback()
    // The `toTextArea` method restores the original textarea and removes the editor.
    this.cm?.toTextArea()
  }

  override updated(changed: Map<string, unknown>) {
    if (this.cm && changed.has('value')) {
      const current = this.getValue()
      // Only update the editor if the value is different to avoid cursor jumps.
      if (this.value !== current) {
        this.cm.setValue(this.value ?? '')
      }
    }
    if (this.cm && changed.has('readOnly')) {
      this.cm.setOption('readOnly', this.readOnly)
    }
    if (this.cm && changed.has('language')) {
      const mode = this.language === 'json' ? 'application/json' : this.language
      this.cm.setOption('mode', mode)
    }
  }

  // --- Public API ---
  getValue() {
    return this.cm ? this.cm.getValue() : this.value ?? ''
  }

  setValue(v: string) {
    if (this.cm) this.cm.setValue(v ?? '')
    else this.value = v ?? ''
  }

  override focus() {
    super.focus()
    this.cm?.focus()
  }

  private createEditor() {
    const mode = this.language === 'json' ? 'application/json' : this.language

    this.cm = CodeMirror.fromTextArea(this.textarea, {
      value: this.value ?? '',
      mode,
      lineNumbers: true,
      theme: this.isDarkTheme() ? 'dracula' : 'eclipse',
      readOnly: this.readOnly,
      extraKeys: {
        'Cmd-Enter': () => this.dispatchEvent(new CustomEvent('execute')),
        'Ctrl-Enter': () => this.dispatchEvent(new CustomEvent('execute')),
      },
    })

    this.cm.setValue(this.value ?? '')
    this._empty = !this.value

    this.cm.on('change', (instance: any) => {
      const val = instance.getValue()
      this._empty = !val
      this.dispatchEvent(new CustomEvent('change', { detail: { value: val } }))
      if (this.autoHeight) this.adjustHeight()
    })

    this.cm.on('blur', (instance: any) => {
      const val = instance.getValue()
      this.dispatchEvent(new CustomEvent('blur', { detail: { value: val } }))
    })


    if (this.autoHeight) {
        // Use a timeout to ensure the editor has rendered before adjusting height.
        setTimeout(() => this.adjustHeight(), 0)
    } else {
      const hostHeight = this.style.height
      if (hostHeight) {
        const wrap = this.cm.getWrapperElement()
        wrap.style.height = hostHeight
        this.cm.refresh()
      }
    }
  }

  private isDarkTheme() {
    return window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: dark)').matches
  }

  private adjustHeight() {
    if (!this.cm) return
    const wrap = this.cm.getWrapperElement()
    // Set height to auto to measure the scroll height correctly.
    wrap.style.height = 'auto'
    const scrollHeight = this.cm.getScrollInfo().height
    const height = Math.min(scrollHeight, this.maxHeight)
    wrap.style.height = `${height}px`
    this.cm.refresh()
  }

  // --- Render ---
  override render() {
    return html`
      <div class="wrapper">
        <textarea id="editor" .value=${this.value}></textarea>
        ${this._empty
          ? html`<div class="placeholder">${this.placeholder}</div>`
          : null}
      </div>
    `
  }

  static override styles = [
    // CodeMirror ships its own CSS; inline it into the shadow root so the editor
    // renders under encapsulation without any network fetch.
    unsafeCSS(cmBaseCss),
    unsafeCSS(cmEclipseCss),
    unsafeCSS(cmDraculaCss),
    css`
    :host {
      display: block;
      width: 100%;
      position: relative;
      font-family: var(--nl-font-family-sans);
      font-size: var(--nl-font-size-base);
      color: var(--nl-text-primary);
    }
    .wrapper {
      position: relative;
    }
    .placeholder {
      position: absolute;
      top: 5px;
      /* 2. ADJUSTED: Account for the line number gutter */
      left: 35px;
      color: var(--nl-text-secondary);
      pointer-events: none;
      font-size: inherit;
      z-index: 10;
    }

    /* 3. MODIFIED: Target CodeMirror elements within the shadow DOM */
    ::slotted(.CodeMirror), .CodeMirror {
      width: 100%;
      min-height: 120px;
      height: 240px;
      border: 1px solid var(--nl-surface-border);
      border-radius: var(--nl-border-radius);
      background: var(--nl-surface-control);
      box-shadow: var(--nl-shadow-sm);
      font-family: var(--nl-font-family-mono);
      font-size: var(--nl-font-size-sm);
    }
  `,
  ]
}
