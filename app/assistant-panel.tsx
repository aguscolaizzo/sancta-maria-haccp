"use client";
import { useState, type FormEvent } from "react";
import { Bot, Mic, Send, X, LoaderCircle, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
type Action = {type:"prepare_labels";quantity:number;product:string}|{type:"navigate";href:string};
type Message = {role:"user"|"assistant";text:string;action?:Action};
type SpeechResult = {results: ArrayLike<ArrayLike<{transcript:string}>>};
type SpeechRecognizer = {lang:string;onresult:((e:SpeechResult)=>void)|null;onerror:(()=>void)|null;start:()=>void};
export default function AssistantPanel({onNavigate}:{onNavigate?:(tab:string)=>void}) {
 const [open,setOpen]=useState(false),[message,setMessage]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const [messages,setMessages]=useState<Message[]>([{role:"assistant",text:"Bonjour ! Soy el asistente HACCP de Sancta Maria. Podés escribirme o dictarme órdenes. Toda modificación requiere tu confirmación."}]);
 async function send(event?:FormEvent) {
  event?.preventDefault(); const value=message.trim(); if(!value||busy)return; setMessage("");setBusy(true);setError("");
  setMessages(prev=>[...prev,{role:"user",text:value}]);
  try { const res=await fetch("/api/assistant",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({message:value})});
   const data=await res.json();if(!res.ok)throw Error(data.error??"Erreur de connexion.");
   setMessages(prev=>[...prev,{role:"assistant",text:data.reply,action:data.action}]);
  } catch(e){setError(e instanceof Error?e.message:"Une erreur est survenue.");}
  finally {setBusy(false);}
 }
 function dictate(){
  const w=window as Window & {SpeechRecognition?:new()=>SpeechRecognizer;webkitSpeechRecognition?:new()=>SpeechRecognizer};
  const Engine=w.SpeechRecognition??w.webkitSpeechRecognition;
  if(!Engine){setError("Dictée indisponible sur ce navigateur. Utilisez le microphone du clavier ou écrivez votre message.");return;}
  const recorder=new Engine();recorder.lang="es-ES";recorder.onresult=(e)=>{setMessage(prev=>[prev,e.results[0][0].transcript].filter(Boolean).join(" "));};recorder.onerror=()=>setError("Le microphone est indisponible. Vérifiez les permissions.");recorder.start();
 }
 function navigate(href:string){const tab=new URL(href,window.location.origin).searchParams.get("tab");if(tab&&onNavigate)onNavigate(tab);else window.location.assign(href);setOpen(false);}
 return <div className="no-print" style={{position:"fixed",right:16,bottom:16,zIndex:80,maxWidth:"calc(100vw - 32px)"}}>
 {open&&<section aria-label="Assistant HACCP" style={{width:360,maxWidth:"100%",background:"white",border:"1px solid #e6dbe0",borderRadius:18,boxShadow:"0 12px 35px #27121b25",overflow:"hidden",marginBottom:10}}>
  <div style={{padding:14,background:"#4a1420",color:"white",display:"flex",alignItems:"center",justifyContent:"space-between"}}><strong>Assistant HACCP · Sancta Maria</strong><button onClick={()=>setOpen(false)} aria-label="Fermer" style={{color:"white",background:"none",border:0}}><X size={20}/></button></div>
  <div aria-live="polite" style={{padding:12,height:340,overflowY:"auto",display:"flex",flexDirection:"column",gap:12}}>
   {messages.map((item,index)=><div key={index} style={{padding:10,borderRadius:12,background:item.role==="assistant"?"#f6f1f3":"#eaf4ef",alignSelf:item.role==="assistant"?"flex-start":"flex-end",maxWidth:"96%",whiteSpace:"pre-wrap",overflowWrap:"anywhere",color:"#321f26"}}>
    {item.text}
    {item.action?.type==="navigate"&&<div style={{marginTop:8}}><Button size="sm" variant="outline" onClick={()=>navigate(item.action!.type==="navigate"?item.action.href:"/")}>Ouvrir <ExternalLink size={14}/></Button></div>}
    {item.action?.type==="prepare_labels"&&<div style={{marginTop:8,display:"flex",flexDirection:"column",gap:6}}>
      <strong>Confirmation nécessaire</strong>
      <Button size="sm" onClick={()=>navigate("/?tab=labels")}>Vérifier le lot et préparer les étiquettes</Button>
      <small>La validation et la création se font dans Étiquettes. Aucune écriture n'a encore eu lieu.</small>
    </div>}
   </div>)}
   {busy&&<span><LoaderCircle size={16}/> Analyse…</span>}
  </div>
  {error&&<p role="alert" style={{padding:"0 12px",color:"#ad273b"}}>{error}</p>}
  <form onSubmit={send} style={{display:"flex",gap:6,padding:10,borderTop:"1px solid #eee"}}>
    <button type="button" onClick={dictate} title="Dictée vocale" aria-label="Dictée vocale" style={{padding:8}}><Mic size={20}/></button>
    <input value={message} onChange={e=>setMessage(e.target.value)} maxLength={1500} placeholder="Votre message…" aria-label="Message à l'assistant" style={{flex:1,minWidth:0,border:"1px solid #ddd",borderRadius:8,padding:8,fontSize:16}}/>
    <button disabled={busy||!message.trim()} aria-label="Envoyer" type="submit" style={{padding:8}}><Send size={20}/></button>
  </form>
 </section>}
 <Button style={{background:"#4a1420",color:"white",boxShadow:"0 5px 20px #0002",borderRadius:30}} onClick={()=>setOpen(value=>!value)}><Bot size={21}/> {open?"Fermer":"Assistant IA"}</Button>
 </div>;
}