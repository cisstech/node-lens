import { Variable } from '../../server/types';
import { RouteInfo, VersioningInfo } from '../types';
import { KeyValue } from './types';
import { applyVariables, applyVariablesToKeyValue, buildFinalUrl, buildRouteUrl, keyValueToRecord, resolveVariables } from './utils';

const baseRoute: RouteInfo = {
  method: 'GET',
  path: '/users/:id',
  controller: 'UserController',
  handler: 'getUser',
  module: 'UserModule',
}

describe('buildRouteUrl', () => {
  it('should build simple URL without meta', () => {
    const res = buildRouteUrl('http://localhost:3000', baseRoute)
    expect(res).toEqual({ url: 'http://localhost:3000/users/:id' })
  })

  it('should add global prefix', () => {
    const meta: VersioningInfo = { globalPrefix: 'api' }
    const res = buildRouteUrl('http://localhost:3000', baseRoute, meta)
    expect(res.url).toBe('http://localhost:3000/api/users/:id')
  })

  it('should add version in URI with default version', () => {
    const meta: VersioningInfo = {
      versioning: { enabled: true, type: 'URI', defaultVersion: '1', uriPrefix: 'v' },
    }
    const res = buildRouteUrl('http://localhost:3000', baseRoute, meta)
    expect(res.url).toBe('http://localhost:3000/v1/users/:id')
  })

  it('should add version in URI from route.versions', () => {
    const meta: VersioningInfo = {
      versioning: { enabled: true, type: 'URI', uriPrefix: 'api' },
    }
    const route: RouteInfo = { ...baseRoute, versions: '2' }
    const res = buildRouteUrl('http://localhost:3000', route, meta)
    expect(res.url).toBe('http://localhost:3000/api2/users/:id')
  })

  it('should add both global prefix and version', () => {
    const meta: VersioningInfo = {
      globalPrefix: 'api',
      versioning: { enabled: true, type: 'URI', defaultVersion: '3' },
    }
    const res = buildRouteUrl('http://localhost:3000', baseRoute, meta)
    expect(res.url).toBe('http://localhost:3000/api/v3/users/:id')
  })

  it('should return headers for HEADER versioning', () => {
    const meta: VersioningInfo = {
      versioning: { enabled: true, type: 'HEADER', headerName: 'X-API-Version', defaultVersion: '1' },
    }
    const res = buildRouteUrl('http://localhost:3000', baseRoute, meta)
    expect(res.url).toBe('http://localhost:3000/users/:id')
    expect(res.headers).toEqual({ 'X-API-Version': '1' })
  })

  it('should return Accept header for MEDIA_TYPE versioning', () => {
    const meta: VersioningInfo = {
      versioning: { enabled: true, type: 'MEDIA_TYPE', defaultVersion: '2', mediaTypeKey: 'v' },
    }
    const res = buildRouteUrl('http://localhost:3000', baseRoute, meta)
    expect(res.headers).toEqual({ Accept: 'application/json; v=2' })
  })

  it('should normalize double slashes', () => {
    const route: RouteInfo = { ...baseRoute, path: '//users' }
    const meta: VersioningInfo = { globalPrefix: '/api/' }
    const res = buildRouteUrl('http://localhost:3000/', route, meta)
    expect(res.url).toBe('http://localhost:3000/api/users')
  })
})

describe('buildFinalUrl', () => {
  it('should build final URL with resolved variables and query parameters', () => {
    const baseUrl = 'http://localhost:3000';
    const url = '/users/{{userId}}';
    const queryRows: KeyValue[] = [
      { key: 'filter', value: 'active' },
      { key: 'sort', value: '{{sortOrder}}' },
    ];
    const variables: Variable[] = [
      { key: 'userId', value: '123', type: 'text' },
      { key: 'sortOrder', value: 'asc', type: 'text' },
    ];

    const res = buildFinalUrl(baseUrl, url, queryRows, variables);
    expect(res).toBe('http://localhost:3000/users/123?filter=active&sort=asc');
  });

  it('should handle missing variables gracefully', () => {
    const baseUrl = 'http://localhost:3000';
    const url = '/users/{{userId}}';
    const queryRows: KeyValue[] = [
      { key: 'filter', value: 'active' },
      { key: 'sort', value: '{{sortOrder}}' },
    ];
    const variables: Variable[] = [{ key: 'userId', value: '123', type: 'text' }];

    const res = buildFinalUrl(baseUrl, url, queryRows, variables);
    // Unresolved placeholders remain in the URL; the WHATWG URL serializer
    // percent-encodes the braces in the query string.
    expect(res).toBe('http://localhost:3000/users/123?filter=active&sort=%7B%7BsortOrder%7D%7D');
  });

  it('should return resolved URL even if query parameters are empty', () => {
    const baseUrl = 'http://localhost:3000';
    const url = '/users/{{userId}}';
    const queryRows: KeyValue[] = [];
    const variables: Variable[] = [{ key: 'userId', value: '123', type: 'text' }];

    const res = buildFinalUrl(baseUrl, url, queryRows, variables);
    expect(res).toBe('http://localhost:3000/users/123');
  });

  it('should handle invalid URL construction gracefully', () => {
    const baseUrl = '';
    const url = '/users/{{userId';
    const queryRows: KeyValue[] = [
      { key: 'filter', value: 'active' },
      { key: 'sort', value: '{{sortOrder}}' },
    ];
    const variables: Variable[] = [
      { key: 'userId', value: '123', type: 'text' },
      { key: 'sortOrder', value: 'asc', type: 'text' },
    ];

    const res = buildFinalUrl(baseUrl, url, queryRows, variables);
    expect(res).toBe('/users/{{userId');
  });

  it('should resolve variables in query parameters only', () => {
    const baseUrl = 'http://localhost:3000';
    const url = '/users';
    const queryRows: KeyValue[] = [
      { key: '{{key}}', value: '{{value}}' },
    ];
    const variables: Variable[] = [
      { key: 'key', value: 'filter', type: 'text' },
      { key: 'value', value: 'active', type: 'text' },
    ];

    const res = buildFinalUrl(baseUrl, url, queryRows, variables);
    expect(res).toBe('http://localhost:3000/users?filter=active');
  });
})

describe('keyValueToRecord', () => {
  it('should convert key-value pairs to a record', () => {
    const rows: KeyValue[] = [
      { key: 'name', value: 'John' },
      { key: 'age', value: '30' },
    ];
    const res = keyValueToRecord(rows);
    expect(res).toEqual({ name: 'John', age: '30' });
  });

  it('should handle duplicate keys case-insensitively by keeping the last occurrence', () => {
    const rows: KeyValue[] = [
      { key: 'Name', value: 'John' },
      { key: 'name', value: 'Doe' },
    ];
    const res = keyValueToRecord(rows);
    expect(res).toEqual({ name: 'Doe' });
  });

  it('should skip rows with empty keys', () => {
    const rows: KeyValue[] = [
      { key: '', value: 'NoKey' },
      { key: 'validKey', value: 'ValidValue' },
    ];
    const res = keyValueToRecord(rows);
    expect(res).toEqual({ validKey: 'ValidValue' });
  });

  it('should set value to an empty string if value is undefined', () => {
    const rows: KeyValue[] = [
      { key: 'key1', value: undefined as unknown as string },
      { key: 'key2', value: 'value2' },
    ];
    const res = keyValueToRecord(rows);
    expect(res).toEqual({ key1: '', key2: 'value2' });
  });

  it('should handle an empty array gracefully', () => {
    const rows: KeyValue[] = [];
    const res = keyValueToRecord(rows);
    expect(res).toEqual({});
  });
});

describe('applyVariables', () => {
  it('should replace variables in the string with their resolved values', () => {
    const str = 'Hello, {{name}}!';
    const variables: Variable[] = [
      { key: 'name', value: 'John', type: 'text' },
    ];
    const res = applyVariables(str, variables);
    expect(res).toBe('Hello, John!');
  });

  it('should leave unresolved variables as-is', () => {
    const str = 'Hello, {{name}}!';
    const variables: Variable[] = [];
    const res = applyVariables(str, variables);
    expect(res).toBe('Hello, {{name}}!');
  });

  it('should handle an empty string gracefully', () => {
    const str = '';
    const variables: Variable[] = [
      { key: 'name', value: 'John', type: 'text' },
    ];
    const res = applyVariables(str, variables);
    expect(res).toBe('');
  });

  it('should handle multiple variables in the string', () => {
    const str = 'Hello, {{firstName}} {{lastName}}!';
    const variables: Variable[] = [
      { key: 'firstName', value: 'John', type: 'text' },
      { key: 'lastName', value: 'Doe', type: 'text' },
    ];
    const res = applyVariables(str, variables);
    expect(res).toBe('Hello, John Doe!');
  });
});

describe('applyVariablesToKeyValue', () => {
  it('should apply variables to both keys and values in key-value pairs', () => {
    const rows: KeyValue[] = [
      { key: '{{key1}}', value: '{{value1}}' },
      { key: '{{key2}}', value: '{{value2}}' },
    ];
    const variables: Variable[] = [
      { key: 'key1', value: 'name', type: 'text' },
      { key: 'value1', value: 'John', type: 'text' },
      { key: 'key2', value: 'age', type: 'text' },
      { key: 'value2', value: '30', type: 'text' },
    ];
    const res = applyVariablesToKeyValue(rows, variables);
    expect(res).toEqual([
      { key: 'name', value: 'John' },
      { key: 'age', value: '30' },
    ]);
  });

  it('should leave unresolved variables as-is', () => {
    const rows: KeyValue[] = [
      { key: '{{key1}}', value: '{{value1}}' },
    ];
    const variables: Variable[] = [];
    const res = applyVariablesToKeyValue(rows, variables);
    expect(res).toEqual([
      { key: '{{key1}}', value: '{{value1}}' },
    ]);
  });

  it('should handle an empty array gracefully', () => {
    const rows: KeyValue[] = [];
    const variables: Variable[] = [
      { key: 'key1', value: 'name', type: 'text' },
    ];
    const res = applyVariablesToKeyValue(rows, variables);
    expect(res).toEqual([]);
  });
});

describe('resolveVariables', () => {
  it('should resolve text variables into a record', () => {
    const variables: Variable[] = [
      { key: 'name', value: 'John', type: 'text' },
      { key: 'age', value: '30', type: 'text' },
    ];
    const res = resolveVariables(variables);
    expect(res).toEqual({ name: 'John', age: '30' });
  });

  it('should evaluate function variables and resolve them', () => {
    const variables: Variable[] = [
      { key: 'dynamicValue', value: '() => 42', type: 'function' },
    ];
    const res = resolveVariables(variables);
    expect(res).toEqual({ dynamicValue: '42' });
  });

  it('should handle errors in function variables gracefully', () => {
    const variables: Variable[] = [
      { key: 'invalidFunction', value: '() => { throw new Error("Test error") }', type: 'function' },
    ];
    const res = resolveVariables(variables);
    expect(res.invalidFunction).toContain('Error:');
  });

  it('should skip variables without keys', () => {
    const variables: Variable[] = [
      { key: '', value: 'NoKey', type: 'text' },
      { key: 'validKey', value: 'ValidValue', type: 'text' },
    ];
    const res = resolveVariables(variables);
    expect(res).toEqual({ validKey: 'ValidValue' });
  });
});
