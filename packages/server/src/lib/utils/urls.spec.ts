import { joinUrlSegments } from './urls';

describe('joinUrlSegments', () => {
  it('should join segments without adding extra slashes', () => {
    expect(joinUrlSegments('http://example.com', 'path', 'to', 'resource')).toBe('http://example.com/path/to/resource');
  });

  it('should handle leading slashes in middle segments', () => {
    expect(joinUrlSegments('http://example.com', '/path', '/to/', '/resource')).toBe('http://example.com/path/to/resource');
  });

  it('should handle trailing slashes in the first segment', () => {
    expect(joinUrlSegments('http://example.com/', 'path', 'to', 'resource')).toBe('http://example.com/path/to/resource');
  });

  it('should handle leading slashes in the last segment', () => {
    expect(joinUrlSegments('http://example.com', 'path', 'to', '/resource')).toBe('http://example.com/path/to/resource');
  });

  it('should handle empty segments', () => {
    expect(joinUrlSegments('http://example.com', '', 'path', '', 'to', 'resource')).toBe('http://example.com/path/to/resource');
  });

  it('should return an empty string if no segments are provided', () => {
    expect(joinUrlSegments()).toBe('');
  });

  it('should handle a single segment', () => {
    expect(joinUrlSegments('http://example.com/')).toBe('http://example.com');
  });

  it('should handle segments with only slashes', () => {
    expect(joinUrlSegments('http://example.com', '/', '/')).toBe('http://example.com');
  });
});
