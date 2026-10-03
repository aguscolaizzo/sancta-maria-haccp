import { alarms, validateReading, type Reading } from "@/lib/frigo";
import { db, getSettings, ignoredReadingIds, json, readingFromRow, sameOrigin } from "@/lib/server";
import { authorize } from "@/lib/access";
import { canAdministerRegister } from "@/lib/access-types";
export const dynamic="force-dynamic";
export async function GET(request:Request) {
  const auth=await authorize();if("response" in auth)return auth.response;const user=auth.access.ownerId;
  const month=new URL(request.url).searchParams.get("month")??"";
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))return json({error:"Mois invalide."},400);
  try { const rows=await db().prepare("SELECT * FROM readings WHERE owner_id=? AND date>=? AND date<=? ORDER BY date").bind(user,month+"-01",month+"-31").all();const ignored=ignoredReadingIds();return json({readings:rows.results.filter(row=>!ignored.has(String((row as Record<string,unknown>).id))).map(readingFromRow)}); }
  catch {return json({error:"Les relevés ne peuvent pas être chargés. Réessayez."},503);}
}
export async function POST(request:Request) {
  const auth=await authorize();if("response" in auth)return auth.response;const {ownerId:user,userId,role,memberRevision}=auth.access;
  if(!sameOrigin(request))return json({error:"Origine de la demande invalide."},403);
  if(Number(request.headers.get("content-length"))>16000)return json({error:"Relevé trop volumineux."},413);
  let payload:Reading;try{payload=await request.json();}catch{return json({error:"Données invalides."},400);}
  const error=validateReading(payload);if(error)return json({error},400);
  if(!canAdministerRegister(role)&&payload.revision!==0)return json({error:"Seul un administrateur peut corriger un relevé déjà enregistré."},403);
  try {
    const config=await getSettings(user);const thresholds=config.thresholds;
    if(alarms({temperatures:payload.temperatures,thresholds}).length&&!payload.note.trim())return json({error:"Décrivez l’écart et l’action menée avant d’enregistrer."},400);
    const now=new Date().toISOString();let result;
    if(payload.revision===0) {
      // Membership is checked again in the INSERT so an in-flight revocation cannot be bypassed.
      result=await db().prepare("INSERT INTO readings (id,owner_id,date,time,initials,temperatures,thresholds,note,exception,revision,created_at,updated_at,created_by_id,updated_by_id) SELECT ?,?,?,?,?,?,?,?,?,1,?,?,?,? WHERE ?=? OR EXISTS (SELECT 1 FROM register_members WHERE owner_id=? AND user_id=? AND status='active' AND revision=?) ON CONFLICT(owner_id,date) DO NOTHING").bind(crypto.randomUUID(),user,payload.date,payload.time,payload.initials.trim(),JSON.stringify(payload.temperatures),JSON.stringify(thresholds),payload.note.trim(),payload.exception?1:0,now,now,userId,userId,userId,user,user,userId,memberRevision).run();
    } else {
      result=await db().prepare("UPDATE readings SET time=?, initials=?, temperatures=?, thresholds=?, note=?, exception=?, revision=revision+1, updated_at=?, updated_by_id=? WHERE owner_id=? AND date=? AND revision=?").bind(payload.time,payload.initials.trim(),JSON.stringify(payload.temperatures),JSON.stringify(thresholds),payload.note.trim(),payload.exception?1:0,now,userId,user,payload.date,payload.revision).run();
    }
    if(!result.meta.changes){const current=await authorize();if("response" in current)return current.response;return json({error:"Ce relevé a été modifié sur un autre appareil. Rechargez la date avant de réessayer."},409);}
    const row=await db().prepare("SELECT * FROM readings WHERE owner_id=? AND date=?").bind(user,payload.date).first<Record<string,unknown>>();return json({reading:readingFromRow(row!)});
  }catch{return json({error:"L’enregistrement a échoué. Vos valeurs restent affichées : réessayez."},503);}
}
