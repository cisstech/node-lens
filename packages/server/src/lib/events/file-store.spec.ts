import * as fs from 'fs/promises';
import { FileEventStore } from './file-store';
import { HistoryQuery } from './store';

const BASE_DIR = '/tmp/nl-test-events';

beforeEach(async () => {
  await fs.rm(BASE_DIR, { recursive: true, force: true });
});

describe('FileEventStore', () => {
  it('should append and list events', async () => {
    const store = new FileEventStore({ baseDir: BASE_DIR });
    await store.append('scope1', 'evtA', { foo: 1 });
    await store.append('scope1', 'evtA', { foo: 2 });

    const res = await store.list('scope1');
    expect(res.totalCount).toBe(2);
    expect(res.events[0].data).toEqual({ foo: 1 });
  });

  it('should paginate results', async () => {
    const store = new FileEventStore({ baseDir: BASE_DIR });
    for (let i = 0; i < 10; i++) {
      await store.append('scope1', 'evtA', { i });
    }

    const res = await store.list('scope1', { limit: 5, offset: 5 });
    expect(res.events).toHaveLength(5);
    expect(res.totalCount).toBe(10);
  });

  it('should enforce max per event type', async () => {
    const store = new FileEventStore({
      baseDir: BASE_DIR,
      maxEventsOverrides: { 'scope1:evtA': 3 },
    });
    for (let i = 0; i < 5; i++) {
      await store.append('scope1', 'evtA', { i });
    }

    const res = await store.list('scope1', { eventType: 'evtA' });
    expect(res.totalCount).toBe(3);
    expect(res.events[0].data).toEqual({ i: 2 });
    expect(res.events[1].data).toEqual({ i: 3 });
    expect(res.events[2].data).toEqual({ i: 4 });
  });

  it('should clear all events of a scope', async () => {
    const store = new FileEventStore({ baseDir: BASE_DIR });
    await store.append('scope1', 'evtA', { x: 1 });
    await store.append('scope1', 'evtB', { y: 2 });

    await store.clear('scope1');

    const res = await store.list('scope1');
    expect(res.totalCount).toBe(0);
  });

  it('should clear only one event type', async () => {
    const store = new FileEventStore({ baseDir: BASE_DIR });
    await store.append('scope1', 'evtA', { x: 1 });
    await store.append('scope1', 'evtB', { y: 2 });

    await store.clear('scope1', 'evtA');

    const resA = await store.list('scope1', { eventType: 'evtA' });
    const resB = await store.list('scope1', { eventType: 'evtB' });

    expect(resA.totalCount).toBe(0);
    expect(resB.totalCount).toBe(1);
  });

  it('should support filters on data fields', async () => {
    const store = new FileEventStore({ baseDir: BASE_DIR });
    await store.append('test', 'metric', { value: 1 });
    await store.append('test', 'metric', { value: 5 });
    await store.append('test', 'metric', { value: 10 });

    const q: HistoryQuery = {
      eventType: 'metric',
      filters: [{ field: 'value', op: 'gt', value: 4 }],
    };
    const res = await store.list('test', q);
    expect(res.totalCount).toBe(2);
    expect(res.events.map(e => e.data.value)).toEqual([5, 10]);
  });

  it('should support contains filter', async () => {
    const store = new FileEventStore({ baseDir: BASE_DIR });
    await store.append('test', 'msg', { text: 'hello world' });
    await store.append('test', 'msg', { text: 'foo' });

    const res = await store.list('test', {
      eventType: 'msg',
      filters: [{ field: 'text', op: 'contains', value: 'hello' }],
    });
    expect(res.totalCount).toBe(1);
    expect(res.events[0].data.text).toContain('hello');
  });

  it('should support sorting by data field (asc & desc)', async () => {
    const store = new FileEventStore({ baseDir: BASE_DIR });
    await store.append('test', 'metric', { value: 3 });
    await store.append('test', 'metric', { value: 1 });
    await store.append('test', 'metric', { value: 2 });

    const resAsc = await store.list('test', {
      eventType: 'metric',
      sort: ['value:asc'],
    });
    expect(resAsc.events.map(e => e.data.value)).toEqual([1, 2, 3]);

    const resDesc = await store.list('test', {
      eventType: 'metric',
      sort: ['value:desc'],
    });
    expect(resDesc.events.map(e => e.data.value)).toEqual([3, 2, 1]);
  });

  it('should support AND/OR filters', async () => {
    const store = new FileEventStore({ baseDir: BASE_DIR });
    await store.append('test', 'req', { status: 200, duration: 100 });
    await store.append('test', 'req', { status: 404, duration: 50 });
    await store.append('test', 'req', { status: 500, duration: 600 });

    const q: HistoryQuery = {
      eventType: 'req',
      filters: [
        {
          or: [
            { field: 'status', op: 'eq', value: 404 },
            {
              and: [
                { field: 'status', op: 'gte', value: 500 },
                { field: 'duration', op: 'gt', value: 200 },
              ],
            },
          ],
        },
      ],
    };
    const res = await store.list('test', q);
    expect(res.totalCount).toBe(2); // 404 and 500 match
    expect(res.events[0].data.status).toBe(404);
    expect(res.events[1].data.status).toBe(500);
  });

  it('should start a fresh session on reset()', async () => {
    const store = new FileEventStore({ baseDir: BASE_DIR });
    await store.append('scope1', 'evtA', { x: 1 });
    await store.append('scope2', 'evtB', { y: 2 });
    await store.flushNow();

    await store.reset();

    expect((await store.list('scope1')).totalCount).toBe(0);
    expect((await store.list('scope2')).totalCount).toBe(0);

    // A new store pointed at the same dir sees nothing persisted either.
    const fresh = new FileEventStore({ baseDir: BASE_DIR });
    expect((await fresh.list('scope1')).totalCount).toBe(0);
  });

  it('should persist buffered events to disk on flushNow()', async () => {
    const store = new FileEventStore({ baseDir: BASE_DIR });
    await store.append('scope1', 'evtA', { foo: 42 });
    await store.flushNow();

    // A second store instance reads the flushed file from disk.
    const reopened = new FileEventStore({ baseDir: BASE_DIR });
    const res = await reopened.list('scope1');
    expect(res.totalCount).toBe(1);
    expect(res.events[0].data).toEqual({ foo: 42 });
  });

  it('should handle concurrent appends safely', async () => {
    const store = new FileEventStore({ baseDir: BASE_DIR });

    await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        store.append('scope1', 'evtA', { i })
      )
    );

    const res = await store.list('scope1', { eventType: 'evtA' });
    expect(res.totalCount).toBe(20);

    const seqs = res.events.map(e => e.sequence);
    for (let i = 1; i < seqs.length; i++) {
      expect(seqs[i]).toBeGreaterThan(seqs[i - 1]);
    }
  });
});
