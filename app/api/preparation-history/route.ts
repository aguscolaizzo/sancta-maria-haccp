import {authorize} from '@/lib/access';
import {findPrevious,searchPrevious} from '@/lib/preparation-history-server';
import {json} from '@/lib/server';
import {validUuid} from '@/lib/supply';
export const dynamic='force-dynamic';
export async function GET(request:Request){const auth=await authorize();if('response'in auth)return auth.response;const p=new URL(request.url).searchParams;try{const id=p.get('id'),kind=p.get('kind');if(id){if(!validUuid(id)||(kind!=='classic'&&kind!=='quick'))return json({error:'Fiche invalide.'},400);const preparation=await findPrevious(auth.access.ownerId,kind,id);return preparation?json({item:preparation}):json({error:'Fiche introuvable dans ce registre.'},404);}return json({items:await searchPrevious(auth.access.ownerId,(p.get('q')??'').slice(0,80))});}catch(e){console.error('preparation history failed',e);return json({error:'Historique indisponible. Votre saisie est conservée.'},503);}}
