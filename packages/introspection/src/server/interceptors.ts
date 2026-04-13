/* eslint-disable @typescript-eslint/no-explicit-any */
import { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common';
import { trace } from '@opentelemetry/api';
import { Observable } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';

export class NestTraceInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const tracer = trace.getTracer('node-lens-introspection');

    const handler = context.getHandler();
    const controller = context.getClass();

    const spanName = `${controller?.name || 'Controller'}.${handler?.name || 'method'}()`;

    return new Observable((subscriber) => {
      tracer.startActiveSpan(spanName, (span) => {
        next
          .handle()
          .pipe(
            tap(() => span.end()),
            catchError((err) => {
              span.recordException(err);
              span.setStatus({ code: 2 }); // ERROR
              span.end();
              throw err;
            }),
          )
          .subscribe(subscriber);
      });
    });
  }
}
