export type PreparationKind='classic'|'quick';
export type PreviousPreparation={
 id:string;
 kind:PreparationKind;
 name:string;
 shortName:string;
 reference:string;
 href:string;
 preparedAt:string;
 expiresAt:string;
 operation:string;
 storageMode:string;
 storageTemperature:number|null;
 status:string;
 quantity:string;
 supplierName:string;
 supplierLot:string;
 supplierDeadline:string;
 receivedAt:string;
 sourceLotIds:string[];
 revision:number;
 controlStatus:string;
 operatorInitials:string;
 createdByName:string;
 lifecycleUpdatedAt:string;
 lifecycleUpdatedByName:string;
 labelCount:number;
 printedCount:number;
 errorCount:number;
};
export function parisNow(date=new Date()){const parts=new Intl.DateTimeFormat('fr-CA',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(date),p=Object.fromEntries(parts.map(v=>[v.type,v.value]));return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;}
export function freezeSourceProblem(s:PreviousPreparation,at:string,now=parisNow()):string|null{
 if(!['active','prepared'].includes(s.status))return 'Cette préparation a déjà été clôturée.';
 if(s.expiresAt<=now||at>=s.expiresAt)return 'La DLC d’origine est dépassée : congélation liée bloquée.';
 if(at<s.preparedAt||at>now)return 'La congélation doit suivre la préparation d’origine et ne peut pas être datée dans le futur.';
 if(s.storageMode!=='refrigerated'||['thawed','frozen_in_house','supplier_frozen'].includes(s.operation))return 'Ce produit est déjà congelé ou décongelé. Ce raccourci ne permet pas la recongélation en l’état.';
 if(s.controlStatus==='non_compliant')return 'Le contrôle d’origine présente une non-conformité. Vérifiez le dossier avant toute transformation.';return null;
}
export const HISTORY_STATUS:Record<string,string>={active:'Active',prepared:'Active',consumed:'Utilisée',discarded:'Jetée',transformed_frozen:'Transformée / congelée',expired:'Expirée'};
