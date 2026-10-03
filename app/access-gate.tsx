"use client";

import { useState } from "react";
import { Check, LoaderCircle, LockKeyhole, UserRoundPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PublicAccess } from "@/lib/access-types";

export default function AccessGate({ access, signInPath, signOutPath }:{ access:PublicAccess; signInPath:string; signOutPath:string }) {
  const [status,setStatus]=useState(access.status);
  const [error,setError]=useState("");
  const [sending,setSending]=useState(false);

  async function requestAccess() {
    setSending(true);setError("");
    try {
      const response=await fetch("/api/access",{method:"POST",cache:"no-store"});
      const data=await response.json();
      if(!response.ok)throw new Error(data.error??"La demande n’a pas pu être envoyée.");
      setStatus(data.status);
    } catch (caught) {setError(caught instanceof Error?caught.message:"La demande n’a pas pu être envoyée.");}
    finally {setSending(false);}
  }

  return <div className="access-shell"><main className="access-card">
    <div className="access-brand"><div className="brand-mark brand-logo" aria-hidden="true"/><div><div className="brand-name">Sancta Maria <span>1187</span></div><div className="brand-sub">REGISTRE HACCP</div></div></div>
    <div className="access-icon"><LockKeyhole size={30}/></div>
    {status==="anonymous"?<><h1>Accès au registre</h1><p>Connectez-vous avec votre compte ChatGPT pour demander l’autorisation d’ajouter les relevés quotidiens.</p><a className="button primary wide" href={signInPath} target="_top">Se connecter avec ChatGPT</a></>:status==="none"?<><h1>Demander l’accès</h1><p>Votre compte <strong>{access.email}</strong> sera transmis au responsable du registre. Il pourra accepter ou refuser la demande.</p>{error&&<div className="notice error" role="alert">{error}</div>}<Button className="button primary wide" onClick={requestAccess} disabled={sending}>{sending?<LoaderCircle className="spinner" size={18}/>:<UserRoundPlus size={18}/>}Envoyer ma demande</Button><a className="access-secondary" href={signOutPath} target="_top">Utiliser un autre compte</a></>:status==="pending"?<><div className="access-icon pending"><LoaderCircle size={30}/></div><h1>Demande envoyée</h1><p>Votre demande attend l’accord du responsable. Rechargez cette page après son acceptation.</p><Button className="button wide" onClick={()=>location.reload()}>Vérifier mon accès</Button><a className="access-secondary" href={signOutPath} target="_top">Se déconnecter</a></>:status==="revoked"?<><h1>Accès retiré</h1><p>Ce compte n’est plus autorisé à consulter ou compléter le registre. Vous pouvez envoyer une nouvelle demande au responsable.</p>{error&&<div className="notice error" role="alert">{error}</div>}<Button className="button primary wide" onClick={requestAccess} disabled={sending}>{sending?<LoaderCircle className="spinner" size={18}/>:<UserRoundPlus size={18}/>}Redemander l’accès</Button><a className="access-secondary" href={signOutPath} target="_top">Se déconnecter</a></>:<><div className="access-icon success"><Check size={30}/></div><h1>Accès disponible</h1><p>Votre autorisation est active. Rechargez la page pour ouvrir le registre.</p><Button className="button primary wide" onClick={()=>location.reload()}>Ouvrir le registre</Button></>}
  </main></div>;
}
