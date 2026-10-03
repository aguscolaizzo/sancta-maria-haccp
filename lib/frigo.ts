export const EQUIPMENT = [
  {id:"cong_ch_1",name:"Congélateur chambre 1",short:"Cong. ch. 1",group:"freezer",max:-18},
  {id:"cong_ch_2",name:"Congélateur chambre 2",short:"Cong. ch. 2",group:"freezer",max:-18},
  {id:"cong_bar_1",name:"Congélateur bar 1",short:"Cong. bar 1",group:"freezer",max:-18},
  {id:"cong_bar_2",name:"Congélateur bar 2",short:"Cong. bar 2",group:"freezer",max:-18},
  {id:"arm_bar",name:"Armoire réfrigérée bar",short:"Arm. bar",group:"fridge",max:4},
  {id:"cf_bar",name:"Chambre froide bar",short:"Ch. froide bar",group:"fridge",max:4},
  {id:"cf_cuis_1",name:"Chambre froide cuisine 1",short:"Ch. froide cuis. 1",group:"fridge",max:4},
  {id:"cf_cuis_2",name:"Chambre froide cuisine 2",short:"Ch. froide cuis. 2",group:"fridge",max:4},
  {id:"arm_cuis_1",name:"Armoire réfrigérée cuisine 1",short:"Arm. cuis. 1",group:"fridge",max:4},
  {id:"arm_cuis_2",name:"Armoire réfrigérée cuisine 2",short:"Arm. cuis. 2",group:"fridge",max:4},
  {id:"arm_salle_1",name:"Armoire réfrigérée salle 1",short:"Arm. salle 1",group:"fridge",max:4},
  {id:"arm_salle_2",name:"Armoire réfrigérée salle 2",short:"Arm. salle 2",group:"fridge",max:4},
  {id:"frigo_pers",name:"Réfrigérateur personnel",short:"Frigo pers.",group:"fridge",max:4},
] as const;
export type Temperatures = Record<string,number>;
export type Settings = {thresholds:Record<string,number>;workbookUrl:string};
export type Reading = {id:string;date:string;time:string;initials:string;temperatures:Temperatures;thresholds:Record<string,number>;note:string;exception:boolean;revision:number;createdAt:string;updatedAt:string};
export const DEFAULT_THRESHOLDS=Object.fromEntries(EQUIPMENT.map(e=>[e.id,e.max]));
export const DEFAULT_SETTINGS:Settings={thresholds:DEFAULT_THRESHOLDS,workbookUrl:""};
export function todayParis(now=new Date()) { return new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Paris",year:"numeric",month:"2-digit",day:"2-digit"}).format(now); }
export function timeParis(now=new Date()) { return new Intl.DateTimeFormat("fr-FR",{timeZone:"Europe/Paris",hour:"2-digit",minute:"2-digit",hour12:false}).format(now); }
export function isValidDate(date:string) { if(!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false; const d=new Date(date+"T12:00:00Z");return !Number.isNaN(d.getTime())&&d.toISOString().slice(0,10)===date; }
export function isClosed(date:string) { const day=new Date(date+"T12:00:00Z").getUTCDay();return day===1||day===2; }
export function parseTemperature(raw:string) { if(!/^[+-]?\d+(?:[.,]\d+)?$/.test(raw.trim())) return null;const n=Number(raw.trim().replace(",","."));return Number.isFinite(n)&&n>=-80&&n<=60?n:null; }
export function displayTemp(n:number) { return n.toLocaleString("fr-FR",{minimumFractionDigits:1,maximumFractionDigits:5}); }
export function alarms(r:Pick<Reading,"temperatures"|"thresholds">) { return EQUIPMENT.filter(e=>typeof r.temperatures[e.id]==="number"&&r.temperatures[e.id]>r.thresholds[e.id]); }
export function daysOfMonth(month:string) { const [y,m]=month.split("-").map(Number); const count=new Date(Date.UTC(y,m,0)).getUTCDate();return Array.from({length:count},(_,i)=>`${month}-${String(i+1).padStart(2,"0")}`); }
export function validWorkbookUrl(value:string) { if(!value)return true;try { const u=new URL(value);return u.protocol==="https:"&&!u.username&&!u.password&&(u.hostname==="1drv.ms"||u.hostname==="onedrive.live.com"||u.hostname==="onedrive.com"||u.hostname.endsWith(".sharepoint.com")||u.hostname==="my.microsoftpersonalcontent.com"); }catch{return false;} }
export function validateReading(value:unknown):string|null {
  if(!value||typeof value!=="object")return "Relevé invalide.";
  const v=value as Record<string,unknown>;
  if(typeof v.date!=="string"||!isValidDate(v.date)||v.date>todayParis())return "Choisissez une date valide, aujourd’hui ou avant.";
  if(typeof v.time!=="string"||!/^([01]\d|2[0-3]):[0-5]\d$/.test(v.time))return "Renseignez l’heure du relevé.";
  if(typeof v.initials!=="string"||!v.initials.trim()||v.initials.length>12)return "Renseignez les initiales du responsable (12 caractères maximum).";
  if(typeof v.note!=="string"||v.note.length>2000)return "La note doit contenir au maximum 2 000 caractères.";
  if(typeof v.exception!=="boolean")return "Statut de fermeture invalide.";
  if(isClosed(v.date)&&!v.exception)return "Activez le relevé exceptionnel pour un lundi ou mardi.";
  if(!Number.isInteger(v.revision)||Number(v.revision)<0)return "Version du relevé invalide.";
  const temps=v.temperatures as Record<string,unknown>;
  if(!temps||typeof temps!=="object"||EQUIPMENT.some(e=>typeof temps[e.id]!=="number"||!Number.isFinite(temps[e.id])||Number(temps[e.id])< -80||Number(temps[e.id])>60))return "Renseignez une température valide pour chacun des 13 équipements.";
  return null;
}
export function csvForMonth(month:string,records:Reading[]) {
  const byDate=new Map(records.map(r=>[r.date,r]));
  const quote=(value:string|number)=>'"'+String(value).replace(/^([\s]*[=+@-])/u,"'$1").replaceAll('"','""')+'"';
  const numeric=(value:number)=>String(value).replace(".",",");
  const lines=[ ["Date","Heure",...EQUIPMENT.map(e=>e.short),"Init.","Écart / action","Statut"].map(quote).join(";") ];
  for(const date of daysOfMonth(month)) {
    const r=byDate.get(date);const [y,m,d]=date.split("-");
    const status=r?(alarms(r).length?"Écart signalé":"Sans dépassement"):(isClosed(date)?"Fermé":date<todayParis()?"Non relevé":"À relever");
    lines.push([quote(`${d}/${m}/${y}`),quote(r?.time??""),...EQUIPMENT.map(e=>r?numeric(r.temperatures[e.id]):""),quote(r?.initials??""),quote(r?.note??""),quote(status)].join(";"));
  }
  return "\uFEFF"+lines.join("\r\n");
}
