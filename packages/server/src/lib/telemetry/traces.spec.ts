import { buildSpanTree, TraceData } from './traces'

function span(id: string, parentSpanId?: string, startSec = 0): TraceData {
  return {
    traceId: 't1',
    spanId: id,
    parentSpanId,
    resource: { attributes: {} },
    timestamp: startSec,
    isError: false,
    startTime: [startSec, 0],
    // fields not needed by buildSpanTree
  } as unknown as TraceData
}

describe('buildSpanTree', () => {
  it('nests children under parents and returns roots in start order', () => {
    const spans = [span('root', undefined, 0), span('child', 'root', 1), span('other', undefined, 2)]
    const roots = buildSpanTree(spans)
    expect(roots.map((r) => r.spanId)).toEqual(['root', 'other'])
    expect(roots[0].children?.map((c) => c.spanId)).toEqual(['child'])
  })

  it('treats a span whose parent is absent as a root', () => {
    const roots = buildSpanTree([span('orphan', 'missing-parent', 0)])
    expect(roots.map((r) => r.spanId)).toEqual(['orphan'])
  })

  it('memoizes per batch: same array and args returns the same tree', () => {
    const spans = [span('a', undefined, 0)]
    expect(buildSpanTree(spans, ['resource'])).toBe(buildSpanTree(spans, ['resource']))
  })

  it('does not share trees across different stripProps', () => {
    const spans = [span('a', undefined, 0)]
    expect(buildSpanTree(spans, ['resource'])).not.toBe(buildSpanTree(spans))
  })
})
