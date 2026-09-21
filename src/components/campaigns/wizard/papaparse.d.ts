// Minimal ambient typings for the `papaparse` runtime dependency (no published
// @types package is installed). Scoped to the campaigns wizard, which is the
// only place in this module that parses CSVs client-side.
declare module "papaparse" {
  export interface ParseError {
    type: string;
    code: string;
    message: string;
    row: number;
  }

  export interface ParseMeta {
    fields?: string[];
  }

  export interface ParseResult<T> {
    data: T[];
    errors: ParseError[];
    meta: ParseMeta;
  }

  export interface ParseConfig<T> {
    header?: boolean;
    skipEmptyLines?: boolean | "greedy";
    complete?: (results: ParseResult<T>) => void;
    error?: (error: Error) => void;
  }

  interface Papa {
    parse<T = Record<string, string>>(input: File | string, config?: ParseConfig<T>): void;
  }

  const Papa: Papa;
  export default Papa;
}
