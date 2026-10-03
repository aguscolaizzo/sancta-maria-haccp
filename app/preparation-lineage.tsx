import Link from 'next/link';
import {Link2} from 'lucide-react';
import {lineageFor} from '@/lib/preparation-history-server';
import type {PreparationKind,PreviousPreparation} from '@/lib/preparation-history';
import {shortDateTime} from '@/lib/labels';
export default async function PreparationLineage({ownerId,kind,id}:{ownerId:string;kind:PreparationKind;id:string}){
 const rows=await lineageFor(ownerId,kind,id);if(!rows.length)return null;
 return <section className="detail-section"><h2><Link2 size={18}/> Préparations liées</h2>{rows.map(r=>{const s=JSON.parse(String(r.source_snapshot)) as PreviousPreparation,outgoing=s.kind===kind&&s.id===id;return <div className="detail-source" key={String(r.id)}><strong>{outgoing?'Nouvelle étiquette':'Étiquette d’origine'} · {r.relation==='frozen'?'Congélation':'Lien de traçabilité'}</strong><p><Link href={outgoing?`/preparations/${r.target_label_id}`:s.href}>{outgoing?String(r.target_name):s.name} · {outgoing?String(r.target_reference):s.reference}</Link></p><p>Préparation d’origine : {shortDateTime(s.preparedAt)} · DLC d’origine : {shortDateTime(s.expiresAt)}</p>{r.relation==='frozen'&&<p>{r.scope==='all'?'Total restant transformé':'Transformation partielle : reliquat conservé sur la fiche d’origine'}</p>}<small>{String(r.created_by_name)} · {new Date(String(r.created_at)).toLocaleString('fr-FR',{timeZone:'Europe/Paris'})}{r.reason?` · ${r.reason}`:''}</small></div>;})}</section>;
}
