export type OcrFields={productName:string;supplierName:string;supplierLot:string;deadlineDate:string;deadlineType:'dlc'|'ddm'|'';quantity:string;deliveryNote:string};
export const emptyOcrFields=():OcrFields=>({productName:'',supplierName:'',supplierLot:'',deadlineDate:'',deadlineType:'',quantity:'',deliveryNote:''});
function explicitDate(value:string){
  const iso=value.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/),fr=value.match(/\b(\d{1,2})[/.\-](\d{1,2})[/.\-](20\d{2})\b/);if(!iso&&!fr)return '';
  const y=Number(iso?.[1]??fr![3]),m=Number(iso?.[2]??fr![2]),d=Number(iso?.[3]??fr![1]),date=new Date(Date.UTC(y,m-1,d));
  return date.getUTCFullYear()===y&&date.getUTCMonth()===m-1&&date.getUTCDate()===d?`${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`:'';
}
// Conservative suggestions: never invent dates or choose between conflicting lots.
export function extractOcrFields(text:string):OcrFields {
  const result=emptyOcrFields(),lines=text.split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
  const field=(re:RegExp,max:number)=>{const values=[...new Set(lines.map(l=>l.match(re)?.[1]?.trim()??'').filter(Boolean))];return values.length===1?values[0].slice(0,max):'';};
  result.productName=field(/^(?:produit|d[eé]signation)\s*[:：]\s*(.+)$/i,80);
  result.supplierName=field(/^fournisseur\s*[:：]\s*(.+)$/i,80);
  result.supplierLot=field(/^(?:n[°o]\s*(?:de\s*)?)?lot(?:\s*(?:n[°o]|fournisseur))?\s*[:#：]?\s+([a-z0-9][a-z0-9 ._/-]*)$/i,80);
  result.quantity=field(/^(?:quantit[eé]|poids\s*net|qt[eé])\s*[:：]\s*(.+)$/i,40);
  result.deliveryNote=field(/^(?:bon\s*de\s*livraison|BL)(?:\s*n[°o])?\s*[:#：]?\s+([a-z0-9][a-z0-9._/-]*)$/i,80);
  const dates=lines.flatMap(l=>{const type=/\b(?:DDM|DLUO)\b|de\s*pr[eé]f[eé]rence/i.test(l)?'ddm':/\bDLC\b|(?:consommer|utiliser)\s*jusqu/i.test(l)?'dlc':'',date=type?explicitDate(l):'';return date?[{type,date}]:[];});
  if(new Set(dates.map(d=>d.type+':'+d.date)).size===1){result.deadlineDate=dates[0].date;result.deadlineType=dates[0].type as 'dlc'|'ddm';}return result;
}
