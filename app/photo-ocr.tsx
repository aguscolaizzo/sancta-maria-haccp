"use client";
import {useEffect,useRef,useState} from 'react';
import {Camera,ScanText,LoaderCircle,X} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Textarea} from '@/components/ui/textarea';
import {emptyOcrFields,extractOcrFields,type OcrFields} from '@/lib/photo-ocr';
import type {Worker} from 'tesseract.js';
const captions:Record<keyof OcrFields,string>={productName:'Produit',supplierName:'Fournisseur',supplierLot:'Lot fournisseur',deadlineDate:'Date lue sur la photo',deadlineType:'Type de date',quantity:'Quantité / poids',deliveryNote:'N° de bon de livraison'};
export type EvidencePhotoDraft={blob:Blob;name:string;mimeType:string;byteSize:number};
const blobFromCanvas=(canvas:HTMLCanvasElement,type:string,quality:number)=>new Promise<Blob>((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error('La photo ne peut pas être compressée.')),type,quality));
async function compressEvidence(bitmap:ImageBitmap){
 let maximum=1600,quality=.8,last:Blob|null=null;
 for(let attempt=0;attempt<4;attempt++){
  const scale=Math.min(1,maximum/Math.max(bitmap.width,bitmap.height)),canvas=document.createElement('canvas');
  canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
  const ctx=canvas.getContext('2d');if(!ctx)throw new Error('La photo ne peut pas être préparée sur ce téléphone.');
  ctx.fillStyle='white';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
  last=await blobFromCanvas(canvas,'image/webp',quality);
  if(last.size<=1_500_000)return last;
  maximum=Math.round(maximum*.78);quality=Math.max(.55,quality-.08);
 }
 if(last&&last.size<=1_500_000)return last;
 throw new Error('La photo reste trop volumineuse. Rapprochez-vous de l’étiquette et recommencez.');
}
export default function PhotoOcr({onApply,fields,disabled=false,archivePhoto=false,onPhotoChange}:{onApply:(v:OcrFields)=>void;fields:(keyof OcrFields)[];disabled?:boolean;archivePhoto?:boolean;onPhotoChange?:(photo:EvidencePhotoDraft|null)=>void}){
 const [busy,setBusy]=useState(false),[progress,setProgress]=useState(''),[error,setError]=useState(''),[text,setText]=useState(''),[draft,setDraft]=useState(emptyOcrFields),[ready,setReady]=useState(false),[preview,setPreview]=useState(''),[reviewed,setReviewed]=useState(false),[retained,setRetained]=useState(false),[retainedBytes,setRetainedBytes]=useState(0);
 const worker=useRef<Worker|null>(null),run=useRef(0),input=useRef<HTMLInputElement>(null),camera=useRef<HTMLInputElement>(null);
 useEffect(()=>()=>{run.current++;void worker.current?.terminate();},[]);useEffect(()=>()=>{if(preview)URL.revokeObjectURL(preview);},[preview]);
 async function read(file?:File){if(!file)return;setError('');setReady(false);setReviewed(false);setText('');
  if(!/^image\/(jpeg|png|webp)$/.test(file.type)||file.size>20*1024*1024){setError('Choisissez une photo JPG, PNG ou WebP de moins de 20 Mo.');return;}
  const job=++run.current;setPreview(URL.createObjectURL(file));setBusy(true);setProgress('Chargement du lecteur français…');
  let instance:Worker|null=null,timeout:ReturnType<typeof setTimeout>|undefined;
  try{const bitmap=await createImageBitmap(file),scale=Math.min(1,2400/Math.max(bitmap.width,bitmap.height)),canvas=document.createElement('canvas');canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);const ctx=canvas.getContext('2d')!;ctx.fillStyle='white';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
   if(archivePhoto&&onPhotoChange){setProgress('Compression de la preuve photographique…');const evidence=await compressEvidence(bitmap),name=(file.name.replace(/\.[^.]+$/,'')||'preuve-fournisseur')+'.webp';onPhotoChange({blob:evidence,name,mimeType:evidence.type||'image/webp',byteSize:evidence.size});setRetained(true);setRetainedBytes(evidence.size);}
   bitmap.close();
   const {createWorker}=await import('tesseract.js');
   const task=(async()=>{instance=await createWorker('fra',1,{workerPath:'/ocr-v7/worker.min.js',corePath:'/ocr-v7/core',langPath:'/ocr-v7/lang',workerBlobURL:false,logger:m=>{if(job===run.current&&m.status==='recognizing text')setProgress(`Lecture de la photo · ${Math.round(m.progress*100)} %`);}});if(job!==run.current){await instance.terminate();return null;}worker.current=instance;return instance.recognize(canvas);})();
   const result=await Promise.race([task,new Promise<never>((_,reject)=>{timeout=setTimeout(()=>reject(new Error('Lecture trop longue. Recadrez la photo ou saisissez les champs manuellement.')),90000);})]);
   if(job!==run.current||!result)return;const extracted=result.data.text.trim();if(!extracted)throw new Error('Aucun texte lisible. Reprenez la photo de face, bien éclairée et plus près.');setText(extracted);setDraft(extractOcrFields(extracted));setReady(true);
  }catch(e){if(job===run.current)setError(e instanceof Error?e.message:'Lecture indisponible. Saisissez les champs manuellement.');}
  finally{if(timeout)clearTimeout(timeout);if(job===run.current){run.current++;setBusy(false);}await(instance as Worker|null)?.terminate();if(worker.current===instance)worker.current=null;}
 }
 function removeRetained(){onPhotoChange?.(null);setRetained(false);setRetainedBytes(0);setReady(false);setText('');setPreview('');setReviewed(false);setError('');}
 return <div className="ocr-reader"><div className="label-row-actions"><Button type="button" className="button" variant="outline" disabled={busy||disabled} onClick={()=>camera.current?.click()}><Camera size={18}/> Photographier et lire</Button><Button type="button" className="button" variant="outline" disabled={busy||disabled} onClick={()=>input.current?.click()}><ScanText size={18}/> Lire une photo</Button>{busy&&<Button type="button" className="button" variant="outline" onClick={()=>{run.current++;void worker.current?.terminate();worker.current=null;setBusy(false);}}><X size={16}/> Annuler</Button>}<input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={busy||disabled} onChange={e=>{void read(e.target.files?.[0]);e.target.value='';}}/><input ref={camera} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="sr-only" disabled={busy||disabled} onChange={e=>{void read(e.target.files?.[0]);e.target.value='';}}/></div>
  <p className="ocr-help">Photo de l’étiquette fournisseur ou du bon. Lecture sur ce téléphone, sans service OCR externe. {archivePhoto?'Une copie compressée sera jointe à la fiche HACCP après enregistrement.':'La photo n’est pas archivée ici.'}</p>{busy&&<p role="status"><LoaderCircle size={16}/> {progress}</p>}{error&&<p role="alert" className="notice danger">{error}</p>}
  {retained&&!ready&&preview&&<div className="ocr-retained"><img src={preview} alt="Preuve photographique à joindre"/><span><strong>Photo prête à joindre</strong><small>{Math.max(1,Math.round(retainedBytes/1024))} Ko · visible uniquement par les utilisateurs autorisés</small></span><Button type="button" variant="outline" className="button" onClick={removeRetained} disabled={disabled}><X size={16}/> Retirer</Button></div>}
  {ready&&<div className="ocr-review"><img src={preview} alt="Photo à comparer avec les valeurs reconnues"/><h4>Vérifier avant de remplir</h4><p>Les champs ambigus restent vides. Rien n’est validé automatiquement ; comparez les dates et le lot avec la photo.</p><details><summary>Texte reconnu (copiable)</summary><Textarea className="input" readOnly value={text} rows={6}/></details><div className="label-form-grid">{fields.map(key=><label className="field" key={key}>{captions[key]}{key==='deadlineType'?<select className="input" value={draft[key]} onChange={e=>{setDraft({...draft,deadlineType:e.target.value as OcrFields['deadlineType']});setReviewed(false);}}><option value="">À préciser</option><option value="dlc">DLC</option><option value="ddm">DDM</option></select>:<Input className="input" type={key==='deadlineDate'?'date':'text'} value={draft[key]} maxLength={key==='quantity'?40:80} onChange={e=>{setDraft({...draft,[key]:e.target.value});setReviewed(false);}}/>}</label>)}</div><label className="ocr-confirm"><input type="checkbox" checked={reviewed} onChange={e=>setReviewed(e.target.checked)}/> J’ai vérifié les valeurs sur la photo. Seuls les champs renseignés remplaceront ceux du formulaire.</label><div className="label-row-actions"><Button type="button" className="button primary" disabled={!reviewed||disabled||!fields.some(key=>draft[key])||!!draft.deadlineDate&&!draft.deadlineType} onClick={()=>{onApply(draft);setReady(false);}}>Utiliser les valeurs vérifiées</Button>{archivePhoto&&<Button type="button" variant="outline" className="button" onClick={removeRetained} disabled={disabled}><X size={16}/> Retirer la photo</Button>}</div></div>}
 </div>;
}
