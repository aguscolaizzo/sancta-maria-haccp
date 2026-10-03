import { env } from "cloudflare:workers";
import { EQUIPMENT, validateReading, type Reading } from "./frigo";
import { db } from "./server";

type PendingImport = {
  id: string;
  ownerId: string;
  reading: Pick<Reading,"date"|"time"|"initials"|"temperatures"|"thresholds"|"note"|"exception">;
  replace: {id:string;revision:number;time:string;initials:string;temperaturesJson:string;note:string};
};

// A user-requested, server-configured import. The browser cannot supply its data
// or target owner. Repeated requests never overwrite an already imported record.
export async function importConfiguredReading(user:string) {
  if(!env.READING_IMPORT_JSON)return {status:"none" as const};
  const config=JSON.parse(env.READING_IMPORT_JSON) as PendingImport;
  if(!config||typeof config!=="object"||typeof config.ownerId!=="string")throw new Error("Invalid configured import");
  if(config.ownerId!==user)return {status:"none" as const};
  const r=config.reading;
  if(typeof config.id!=="string"||!config.id||config.id===config.replace?.id||
    validateReading({...r,revision:0})||
    !r.thresholds||EQUIPMENT.some(e=>typeof r.thresholds[e.id]!=="number"||!Number.isFinite(r.thresholds[e.id])||r.thresholds[e.id]<-80||r.thresholds[e.id]>60)||
    typeof config.replace?.id!=="string"||!config.replace.id||!Number.isInteger(config.replace.revision)||config.replace.revision<1||
    typeof config.replace.time!=="string"||typeof config.replace.initials!=="string"||typeof config.replace.temperaturesJson!=="string"||typeof config.replace.note!=="string") {
    throw new Error("Invalid configured import");
  }
  const existing=await db().prepare("SELECT id FROM readings WHERE owner_id=? AND date=?").bind(user,r.date).first<{id:string}>();
  if(existing?.id===config.id)return {status:"already_imported" as const,date:r.date};
  const now=new Date().toISOString();
  const result=await db().prepare(`
    INSERT INTO readings (id,owner_id,date,time,initials,temperatures,thresholds,note,exception,revision,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,1,?,?)
    ON CONFLICT(owner_id,date) DO UPDATE SET
      id=excluded.id,time=excluded.time,initials=excluded.initials,temperatures=excluded.temperatures,
      thresholds=excluded.thresholds,note=excluded.note,exception=excluded.exception,
      revision=readings.revision+1,created_at=excluded.created_at,updated_at=excluded.updated_at
    WHERE readings.id=? AND readings.revision=? AND readings.time=? AND readings.initials=?
      AND readings.temperatures=? AND readings.note=?
  `).bind(config.id,user,r.date,r.time,r.initials,JSON.stringify(r.temperatures),JSON.stringify(r.thresholds),r.note,r.exception?1:0,now,now,
    config.replace.id,config.replace.revision,config.replace.time,config.replace.initials,config.replace.temperaturesJson,config.replace.note).run();
  if(result.meta.changes)return {status:"imported" as const,date:r.date};
  const current=await db().prepare("SELECT id FROM readings WHERE owner_id=? AND date=?").bind(user,r.date).first<{id:string}>();
  return {status:current?.id===config.id?"already_imported" as const:"conflict" as const,date:r.date};
}
