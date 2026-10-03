import { importConfiguredReading } from "@/lib/import-reading";
import { json, sameOrigin } from "@/lib/server";
import { authorize } from "@/lib/access";
export const dynamic="force-dynamic";

export async function POST(request:Request) {
  const auth=await authorize();if("response" in auth)return auth.response;
  if(!sameOrigin(request))return json({error:"Origine invalide."},403);
  if(auth.access.role!=="owner")return json({status:"none"});
  try {return json(await importConfiguredReading(auth.access.ownerId));}
  catch {return json({error:"L’import depuis Excel est indisponible. Réessayez en rechargeant la page."},503);}
}
