import { EQUIPMENT, validWorkbookUrl } from "@/lib/frigo";
import { db, getSettings, json, sameOrigin, workbookSyncEnabled } from "@/lib/server";
import { authorize } from "@/lib/access";
export const dynamic="force-dynamic";
export async function GET() {
  const auth=await authorize();if("response" in auth)return auth.response;
  try{const enabled=workbookSyncEnabled();const settings=await getSettings(auth.access.ownerId);
    return json({settings:{...settings,workbookUrl:auth.access.role==="owner"?settings.workbookUrl:""},sync:{enabled,mode:enabled?"hourly_chatgpt":"configuration_required"}});
  }catch{return json({error:"Les réglages ne sont pas disponibles. Réessayez."},503);}
}
export async function PUT(request:Request) {
  const auth=await authorize(true);if("response" in auth)return auth.response;const user=auth.access.ownerId;
  if(!sameOrigin(request))return json({error:"Origine invalide."},403);
  try {
    const {thresholds,workbookUrl}=await request.json();
    if(typeof workbookUrl!=="string"||workbookUrl.length>3000||!validWorkbookUrl(workbookUrl.trim()))return json({error:"Collez un lien HTTPS OneDrive ou SharePoint valide."},400);
    if(!thresholds||EQUIPMENT.some(e=>typeof thresholds[e.id]!=="number"||!Number.isFinite(thresholds[e.id])||thresholds[e.id]<-80||thresholds[e.id]>60))return json({error:"Vérifiez les seuils des 13 équipements."},400);
    const clean=Object.fromEntries(EQUIPMENT.map(e=>[e.id,thresholds[e.id]]));
    await db().prepare("INSERT INTO settings (owner_id,thresholds,workbook_url,updated_at) VALUES (?,?,?,?) ON CONFLICT(owner_id) DO UPDATE SET thresholds=excluded.thresholds,workbook_url=excluded.workbook_url,updated_at=excluded.updated_at").bind(user,JSON.stringify(clean),workbookUrl.trim(),new Date().toISOString()).run();
    return json({settings:{thresholds:clean,workbookUrl:workbookUrl.trim()}});
  }catch{return json({error:"Les réglages n’ont pas été enregistrés. Réessayez."},503);}
}
