import { connectDevtools, connectLocalDevtools } from '@pmndrs/devtools/client'
import type { DevtoolsConnection, UiNode } from '@pmndrs/devtools'
import { controlsTool } from '@pmndrs/devtools-controls'
import { performanceTool } from '@pmndrs/devtools-performance'

// Minimal, Leva-adjacent: tight rows, monospace labels, no chrome beyond a
// thin border. Deliberately not the previous dashboard look.
const CSS = /* css */ `
*{box-sizing:border-box}

.shell{
  --accent:#5ec9ff;
  --bg:#111114;
  --bg-soft:#15151a;
  --line:#232329;
  --line-soft:#1a1a1f;
  --text:#c9c9d2;
  --muted:#696974;
  color:var(--text);
  background:var(--bg);
  font:11px/1.5 ui-monospace,Menlo,Consolas,monospace;
  color-scheme:dark;
}

.shell.full{
  min-height:100vh;
  padding-bottom:28px;
}

.shell.float{
  position:fixed;
  top:12px;
  right:12px;
  width:280px;
  max-height:calc(100vh - 24px);
  overflow:auto;
  border:1px solid var(--line);
  border-radius:9px;
  box-shadow:0 12px 40px #0008;
  z-index:2147483647;
}

.header{
  display:flex;
  align-items:center;
  justify-content:space-between;
  padding:10px 12px;
  border-bottom:1px solid var(--line);
}

.shell.full .header{
  max-width:760px;
  margin:0 auto;
  padding:14px 4px 11px;
}

.brand{
  font-weight:600;
  font-size:10px;
  letter-spacing:.08em;
  text-transform:uppercase;
  color:#9696a1;
}

.transport{
  font-size:9px;
  color:#54545c;
  text-transform:uppercase;
  letter-spacing:.08em;
}

.tabs{
  display:flex;
  gap:2px;
  padding:6px 8px 0;
}

.shell.full .tabs{
  max-width:760px;
  margin:0 auto;
  padding:10px 0 0;
}

.tab{
  border:0;
  background:none;
  color:#5c5c66;
  padding:5px 8px;
  font:inherit;
  font-size:10px;
  letter-spacing:.04em;
  cursor:pointer;
  border-radius:4px;
}

.tab:hover{
  color:#c9c9d2;
  background:#18181d;
}

.tab[data-active=true]{
  color:#fff;
  background:#1c1c22;
}

.content{
  padding:10px;
}

.shell.full .content{
  width:min(760px,calc(100vw - 32px));
  max-width:none;
  margin:0 auto;
  padding:16px 0 0;
}

.stack{
  display:grid;
  gap:8px;
}

.muted{
  color:#54545c;
  font-size:9px;
  text-transform:uppercase;
  letter-spacing:.07em;
  margin-top:2px;
}

.row{
  display:grid;
  grid-template-columns:1fr auto;
  align-items:center;
  gap:6px;
  padding:4px 0 7px;
  border-bottom:1px solid var(--line-soft);
}

.row>label{
  color:#a2a2ac;
  font-size:10.5px;
}

.row input[type=range]{
  grid-column:1/-1;
  width:100%;
  accent-color:var(--accent);
  height:2px;
  cursor:pointer;
}

.row input[type=color]{
  width:22px;
  height:22px;
  border-radius:5px;
  border:1px solid var(--line);
  padding:0;
  background:none;
  cursor:pointer;
}

.row input[type=checkbox]{
  width:13px;
  height:13px;
  accent-color:var(--accent);
  cursor:pointer;
}

.readout{
  color:#62626d;
  font-variant-numeric:tabular-nums;
  font-size:10px;
}

.metric{
  background:var(--bg-soft);
  border:1px solid var(--line);
  border-radius:8px;
  padding:11px 12px;
}

.metric-label{
  color:#5d5d67;
  text-transform:uppercase;
  font-size:9px;
  letter-spacing:.08em;
}

.metric-value{
  font-size:22px;
  line-height:1.4;
  font-variant-numeric:tabular-nums;
  color:#fff;
}

.metric-detail{
  color:#4d4d56;
  font-size:9px;
  margin-top:2px;
}

.shell.full .metric{
  max-width:420px;
}

@media(max-width:600px){
  .shell.full .header,
  .shell.full .tabs{
    padding-left:16px;
    padding-right:16px;
  }

  .shell.full .content{
    width:calc(100vw - 32px);
  }
}
`

interface MountedNode {
  element: HTMLElement
  update: (node: UiNode) => void
  destroy: () => void
}

function mountNode(
  doc: Document,
  node: UiNode,
  action: (name: string, payload: unknown) => void,
): MountedNode {
  if (node.type === 'stack') {
    const wrapper = doc.createElement('div')
    wrapper.className = 'stack'
    let children = node.children.map((child) => mountNode(doc, child, action))
    children.forEach((child) => wrapper.append(child.element))
    return {
      element: wrapper,
      update(next) {
        if (next.type !== 'stack') return
        if (next.children.length !== children.length) {
          children.forEach((child) => child.destroy())
          children = next.children.map((child) => mountNode(doc, child, action))
          wrapper.replaceChildren(...children.map((child) => child.element))
          return
        }
        next.children.forEach((child, index) => children[index]?.update(child))
      },
      destroy() {
        children.forEach((child) => child.destroy())
      },
    }
  }

  if (node.type === 'text') {
    const element = doc.createElement('div')
    element.className = 'muted'
    element.textContent = node.text
    return {
      element,
      update(next) {
        if (next.type === 'text') element.textContent = next.text
      },
      destroy() {},
    }
  }

  if (node.type === 'number') {
    const row = doc.createElement('div')
    row.className = 'row'
    const label = doc.createElement('label')
    const input = doc.createElement('input')
    input.type = 'range'
    const readout = doc.createElement('div')
    readout.className = 'readout'
    input.oninput = () => {
      const value = Number(input.value)
      readout.textContent = String(value)
      action(`set:${node.path}`, value)
    }
    row.append(label, input, readout)
    const update = (next: UiNode) => {
      if (next.type !== 'number') return
      label.textContent = next.label
      input.min = String(next.min)
      input.max = String(next.max)
      input.step = String(next.step)
      if (doc.activeElement !== input) input.value = String(next.value)
      readout.textContent = String(next.value)
    }
    update(node)
    return {
      element: row,
      update,
      destroy() {
        input.oninput = null
      },
    }
  }

  if (node.type === 'boolean') {
    const row = doc.createElement('div')
    row.className = 'row'
    const label = doc.createElement('label')
    const input = doc.createElement('input')
    input.type = 'checkbox'
    input.oninput = () => action(`set:${node.path}`, input.checked)
    row.append(label, input, doc.createElement('span'))
    const update = (next: UiNode) => {
      if (next.type !== 'boolean') return
      label.textContent = next.label
      if (doc.activeElement !== input) input.checked = next.value
    }
    update(node)
    return {
      element: row,
      update,
      destroy() {
        input.oninput = null
      },
    }
  }

  if (node.type === 'color') {
    const row = doc.createElement('div')
    row.className = 'row'
    const label = doc.createElement('label')
    const input = doc.createElement('input')
    input.type = 'color'
    input.oninput = () => action(`set:${node.path}`, input.value)
    row.append(label, input, doc.createElement('span'))
    const update = (next: UiNode) => {
      if (next.type !== 'color') return
      label.textContent = next.label
      if (doc.activeElement !== input) input.value = next.value
    }
    update(node)
    return {
      element: row,
      update,
      destroy() {
        input.oninput = null
      },
    }
  }

  const element = doc.createElement('div')
  element.className = 'metric'
  const left = doc.createElement('div')
  const label = doc.createElement('div')
  label.className = 'metric-label'
  const value = doc.createElement('div')
  value.className = 'metric-value'
  left.append(label, value)
  const detail = doc.createElement('div')
  detail.className = 'metric-detail'
  element.append(left, detail)
  const update = (next: UiNode) => {
    if (next.type !== 'metric') return
    label.textContent = next.label
    value.textContent = next.value
    detail.textContent = next.detail ?? ''
  }
  update(node)
  return { element, update, destroy() {} }
}

function addStyles() {
  if (document.querySelector('style[data-pmndrs-devtools]')) return
  const style = document.createElement('style')
  style.dataset.pmndrsDevtools = 'true'
  style.textContent = CSS
  document.head.append(style)
}

/**
 * One shell builder for BOTH entry points below, so `?debug` (floating,
 * same document) and `?devtools` (full page, separate document) are
 * guaranteed to show the exact same tools in the exact same order,
 * reacting to the exact same connection updates. The only difference is
 * the `mode` class and which `connection` is passed in.
 */
function mountShell(
  target: HTMLElement,
  connection: DevtoolsConnection,
  mode: 'full' | 'float',
): () => void {
  addStyles()
  const doc = target.ownerDocument
  const tools = [controlsTool(connection), performanceTool(connection)]
  let active = tools[0]!

  const shell = doc.createElement('div')
  shell.className = `shell ${mode}`
  const header = doc.createElement('div')
  header.className = 'header'
  const brand = doc.createElement('div')
  brand.className = 'brand'
  brand.textContent = 'DevTools'
  const transport = doc.createElement('div')
  transport.className = 'transport'
  transport.textContent = connection.transport
  header.append(brand, transport)

  const tabs = doc.createElement('div')
  tabs.className = 'tabs'
  const content = doc.createElement('main')
  content.className = 'content'
  shell.append(header, tabs, content)

  if (mode === 'float') target.append(shell)
  else target.replaceChildren(shell)

  let mounted: MountedNode | undefined

  const drawTabs = () => {
    tabs.replaceChildren(
      ...tools.map((tool) => {
        const button = doc.createElement('button')
        button.className = 'tab'
        button.dataset.active = String(tool === active)
        button.textContent = tool.title
        button.onclick = () => {
          active = tool
          renderActive()
        }
        return button
      }),
    )
  }

  const renderActive = () => {
    mounted?.destroy()
    mounted = mountNode(doc, active.render(), (name, payload) =>
      active.action(name, payload),
    )
    content.replaceChildren(mounted.element)
    connection.setPerformanceEnabled(active.id === 'performance')
    drawTabs()
  }

  const off = connection.subscribe(() => {
    transport.textContent = connection.transport
    mounted?.update(active.render())
  })
  renderActive()

  return () => {
    off()
    mounted?.destroy()
    connection.dispose()
    shell.remove()
  }
}

export async function mountDevtools(target: HTMLElement): Promise<() => void> {
  const connection = await connectDevtools()
  return mountShell(target, connection, 'full')
}

export async function mountInlineControls(
  target: HTMLElement,
): Promise<() => void> {
  const connection = await connectLocalDevtools()
  return mountShell(target, connection, 'float')
}
