/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-function-type */


class CallSite {
  private typeName!: string | null;
  private functionName!: string | null;
  private methodName!: string | null;
  private fileName!: string | null;
  private lineNumber!: number | null;
  private columnNumber!: number | null;
  private native!: boolean | null;
  private function!: Function | null;
  private evalOrigin!: string | null;


  constructor(properties: Record<string, any>) {
    Object.assign(this, properties);
  }


  getTypeName() {
    return this.typeName;
  }

  getFunctionName() {
    return this.functionName;
  }

  getMethodName() {
    return this.methodName;
  }

  getFileName() {
    return this.fileName;
  }

  getLineNumber() {
    return this.lineNumber;
  }

  getColumnNumber() {
    return this.columnNumber;
  }

  getFunction() {
    return this.function;
  }

  getEvalOrigin() {
    return this.evalOrigin;
  }

  isNative() {
    return !!this['native'];
  }


}

export function get(belowFn?: Function) {
  const oldLimit = Error.stackTraceLimit;
  Error.stackTraceLimit = Infinity;

  const dummyObject = {} as { stack: CallSite[] | undefined };

  const v8Handler = Error.prepareStackTrace;
  Error.prepareStackTrace = function (dummyObject, v8StackTrace) {
    return v8StackTrace;
  };
  Error.captureStackTrace(dummyObject, belowFn || get);

  const v8StackTrace = dummyObject.stack;
  Error.prepareStackTrace = v8Handler;
  Error.stackTraceLimit = oldLimit;

  return v8StackTrace;
}

export function parse(err: Error): CallSite[] {
  if (!err.stack) {
    return [];
  }

  const lines = err.stack.split('\n').slice(1);
  return lines
    .map(function (line) {
      if (line.match(/^\s*[-]{4,}$/)) {
        return createParsedCallSite({
          fileName: line,
          lineNumber: null,
          functionName: null,
          typeName: null,
          methodName: null,
          columnNumber: null,
          'native': null,
        });
      }

      const lineMatch = line.match(/at (?:(.+?)\s+\()?(?:(.+?):(\d+)(?::(\d+))?|([^)]+))\)?/);
      if (!lineMatch) {
        return;
      }

      let object = null;
      let method = null;
      let functionName = null;
      let typeName = null;
      let methodName = null;
      const isNative = (lineMatch[5] === 'native');

      if (lineMatch[1]) {
        functionName = lineMatch[1];
        let methodStart = functionName.lastIndexOf('.');
        if (functionName[methodStart - 1] == '.')
          methodStart--;
        if (methodStart > 0) {
          object = functionName.substr(0, methodStart);
          method = functionName.substr(methodStart + 1);
          const objectEnd = object.indexOf('.Module');
          if (objectEnd > 0) {
            functionName = functionName.substr(objectEnd + 1);
            object = object.substr(0, objectEnd);
          }
        }
      }

      if (method) {
        typeName = object;
        methodName = method;
      }

      if (method === '<anonymous>') {
        methodName = null;
        functionName = null;
      }

      const properties = {
        fileName: lineMatch[2] || null,
        lineNumber: parseInt(lineMatch[3], 10) || null,
        functionName: functionName,
        typeName: typeName,
        methodName: methodName,
        columnNumber: parseInt(lineMatch[4], 10) || null,
        'native': isNative,
      };

      return createParsedCallSite(properties);
    })
    .filter(function (callSite) {
      return !!callSite;
    });
}

function createParsedCallSite(properties: Record<string, any>) {
  return new CallSite(properties);
}


export class Stacktrace {
  static get(belowFn?: Function) {
    return get(belowFn);
  }

  static parse(err: Error) {
    return parse(err);
  }
}

/**
 * Captures a structured stack trace from the current execution context.
 *
 * @returns {Array<Object>} An array of call site objects, where each object
 *                          represents a frame in the stack trace and contains
 *                          `function`, `file`, `line`, and `column` properties.
 */
export function stacktrace() {
  const originalPrepareStackTrace = Error.prepareStackTrace;
  try {
    Error.prepareStackTrace = (_, stack) => stack;
    const err = new Error();
    Error.captureStackTrace(err, stacktrace);
    const stack = err.stack as unknown as NodeJS.CallSite[];
    return stack.map((frame) => ({
      function: frame.getFunctionName(),
      file: frame.getFileName(),
      line: frame.getLineNumber(),
      column: frame.getColumnNumber(),
    }));
  } finally {
    Error.prepareStackTrace = originalPrepareStackTrace;
  }
}
