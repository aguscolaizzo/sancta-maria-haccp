// Minimal interfaces for the platform bindings used by this application.
// Sites supplies the actual D1 database and asset service at runtime.
interface D1Meta {
  changes:number;
  last_row_id:number;
  duration:number;
  rows_read:number;
  rows_written:number;
  size_after:number;
  changed_db:boolean;
}
interface D1Result<T=Record<string,unknown>> { results:T[]; success:boolean; meta:D1Meta; }
interface D1PreparedStatement {
  bind(...values:unknown[]):D1PreparedStatement;
  first<T=Record<string,unknown>>(columnName?:string):Promise<T|null>;
  all<T=Record<string,unknown>>():Promise<D1Result<T>>;
  run<T=Record<string,unknown>>():Promise<D1Result<T>>;
  raw<T=unknown[]>():Promise<T[]>;
}
interface D1Database {
  prepare(sql:string):D1PreparedStatement;
  batch<T=Record<string,unknown>>(statements:D1PreparedStatement[]):Promise<D1Result<T>[]>;
  exec(sql:string):Promise<{count:number;duration:number}>;
  dump():Promise<ArrayBuffer>;
}
interface Fetcher { fetch(input:Request|string,init?:RequestInit):Promise<Response>; }
interface R2ObjectBody {
  key:string;
  etag:string;
  body:ReadableStream;
  size:number;
  httpMetadata?:{contentType?:string};
  customMetadata?:Record<string,string>;
  arrayBuffer():Promise<ArrayBuffer>;
}
interface R2Bucket {
  list(options?:{cursor?:string;include?:string[]}):Promise<{objects:Array<{key:string;etag:string;size:number;httpMetadata?:{contentType?:string};customMetadata?:Record<string,string>}>;truncated:boolean;cursor?:string}>;
  put(key:string,value:ArrayBuffer|ArrayBufferView|ReadableStream|Blob|string,options?:{httpMetadata?:{contentType?:string};customMetadata?:Record<string,string>}):Promise<unknown>;
  get(key:string):Promise<R2ObjectBody|null>;
  delete(key:string):Promise<void>;
}
declare module "cloudflare:workers" { export const env:{DB?:D1Database;MEDIA?:R2Bucket;WORKBOOK_URL?:string;WORKBOOK_SYNC_ACTIVE?:string;IGNORED_READING_IDS?:string;READING_IMPORT_JSON?:string;REGISTER_OWNER_ID?:string}; }
