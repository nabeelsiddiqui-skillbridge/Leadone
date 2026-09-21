// Minimal ambient typing for `papaparse` — the package ships no types and
// `@types/papaparse` isn't installed. Only covers the surface this module
// (client-side CSV parsing for contact import) actually uses.
declare module "papaparse" {
  export interface ParseError {
    type: string;
    code: string;
    message: string;
    row?: number;
  }

  export interface ParseMeta {
    delimiter: string;
    linebreak: string;
    aborted: boolean;
    truncated: boolean;
    cursor: number;
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
    dynamicTyping?: boolean;
    complete?: (results: ParseResult<T>) => void;
    error?: (error: Error) => void;
  }

  export function parse<T = Record<string, string>>(
    input: string | File,
    config?: ParseConfig<T>
  ): void;

  const Papa: { parse: typeof parse };
  export default Papa;
}
