import { env } from "cloudflare:workers";
import { DEFAULT_SETTINGS, type Reading, type Settings } from "./frigo";
export function db() { if(!env.DB)throw new Error("Database unavailable");return env.DB; }
export function media() { if(!env.MEDIA)throw new Error("Media storage unavailable");return env.MEDIA; }
export function json(value:unknown,status=200) { return Response.json(value,{status,headers:{"Cache-Control":"private, no-store","Vary":"Cookie"}}); }
export function sameOrigin(request:Request) { const origin=request.headers.get("origin");if(!origin)return false;try{return new URL(origin).origin===new URL(request.url).origin;}catch{return false;} }
export function configuredWorkbookUrl() { return typeof env.WORKBOOK_URL==="string"?env.WORKBOOK_URL.trim():""; }
export function workbookSyncEnabled() { return env.WORKBOOK_SYNC_ACTIVE==="true"&&Boolean(configuredWorkbookUrl()); }
export function ignoredReadingIds() { return new Set((env.IGNORED_READING_IDS??"").split(",").map(id=>id.trim()).filter(Boolean)); }
export async function getSettings(ownerId:string):Promise<Settings> {
  const row=await db().prepare("SELECT thresholds, workbook_url FROM settings WHERE owner_id=?").bind(ownerId).first<{thresholds:string;workbook_url:string}>();
  const workbookUrl=configuredWorkbookUrl();
  return row?{thresholds:JSON.parse(row.thresholds),workbookUrl:row.workbook_url||workbookUrl}:{...DEFAULT_SETTINGS,workbookUrl};
}
export function readingFromRow(r:Record<string,unknown>):Reading { return {id:String(r.id),date:String(r.date),time:String(r.time),initials:String(r.initials),temperatures:JSON.parse(String(r.temperatures)),thresholds:JSON.parse(String(r.thresholds)),note:String(r.note),exception:Boolean(r.exception),revision:Number(r.revision),createdAt:String(r.created_at),updatedAt:String(r.updated_at)}; }
