export type BodyMode = 'json' | 'urlencoded' | 'formdata' | 'graphql';
export type EditorTab = 'headers' | 'query' | 'body';

export interface KeyValue {
  key: string;
  value: string;
}

export interface FormDataField extends KeyValue {
  type: 'text' | 'file';
  file?: File | null;
}

export interface HistoryEntry {
  id: string;
  ts: number;
  method: string;
  url: string;
  headers: KeyValue[];
  query: KeyValue[];
  bodyMode: BodyMode;
  jsonText: string;
  urlParams: KeyValue[];
  formFields: FormDataField[];
  gqlQuery: string;
  gqlVariablesText: string;
}
