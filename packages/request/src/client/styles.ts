import { css } from "lit";

export const httpMethodStyles = css`
  .method {
    font-size: 11px;
    font-weight: 600;
    padding: 2px 6px;
    border-radius: var(--nl-border-radius);
  }

  .method.get {
    background: #dcfce7;
    color: #166534;
  }

  .method.post {
    background: #dbeafe;
    color: #1e40af;
  }

  .method.put {
    background: #e0e7ff;
    color: #3730a3;
  }

  .method.patch {
    background: #f3e8ff;
    color: #581c87;
  }

  .method.delete {
    background: #e5e7eb;
    color: #374151;
  }

  .method.head {
    background: #cffafe;
    color: #0e7490;
  }

  .method.options {
    background: #fce7f3;
    color: #9d174d;
  }

  .method.trace {
    background: #f1f5f9;
    color: #475569;
  }

  /* Special method for GraphQL */
  .method.query {
    background: #fef3c7;
    color: #92400e;
  }

  .method.mutation {
    background: #fee2e2;
    color: #991b1b;
  }

  .method.subscription {
    background: #ede9fe;
    color: #5b21b6;
  }

  .path {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 12px;
    color: var(--nl-text-secondary);
  }
`
