import { formatConsoleArgs, formatNestLogger, formatPinoArgs } from './formatters';

describe('log formatters', () => {
  it('formats console %s placeholders', () => {
    const { message } = formatConsoleArgs(['hello %s %d', 'world', 42]);
    expect(message).toBe('hello world 42');
  });

  it('formats console objects', () => {
    const obj = { foo: 'bar' };
    const { message } = formatConsoleArgs(['object:', obj]);
    expect(message).toContain('object:');
  });

  it('formats nestjs logs', () => {
    const { message, attributes } = formatNestLogger('log', 'user %s', ['alice']);
    expect(message).toBe('user alice');
    expect(attributes.logger).toBe('nestjs');
  });

  it('formats pino with context object', () => {
    const { message, attributes } = formatPinoArgs([{ user: 'bob' }, 'logged in %d times', 3]);
    expect(message).toBe('logged in 3 times');
    expect(attributes.user).toBe('bob');
  });

  it('formats pino with string only', () => {
    const { message } = formatPinoArgs(['simple %s', 'msg']);
    expect(message).toBe('simple msg');
  });
});
