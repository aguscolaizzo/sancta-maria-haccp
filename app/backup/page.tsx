import { requireChatGPTUser } from "@/app/chatgpt-auth";
import { authorize } from "@/lib/access";

export const dynamic = "force-dynamic";

export default async function BackupPage() {
  await requireChatGPTUser("/backup");
  const access = await authorize(true);
  if ("response" in access) return <main className="main"><section className="panel" style={{ padding: 24 }}><h1>Sauvegarde réservée au propriétaire</h1><p>Connectez-vous avec le compte propriétaire du registre.</p><a className="button" href="/">Retour au registre</a></section></main>;
  return <main className="main" style={{ maxWidth: 720, paddingTop: 40 }}><section className="panel" style={{ padding: 28 }}>
    <p className="eyebrow">Sancta Maria 1187 · HACCP</p>
    <h1>Sauvegarde complète</h1>
    <p>Le fichier ZIP contient le code de l’application, les relevés, les étiquettes, les réceptions, les signatures, les photos, les historiques et un guide de restauration.</p>
    <p>Les données sont copiées au moment du téléchargement. Évitez de modifier le registre pendant sa préparation.</p>
    <p><a className="button primary" href="/api/backup" download>Télécharger la sauvegarde complète</a></p>
    <p className="muted-note">La préparation peut prendre quelques secondes. Le fichier contient des données privées : conservez-le dans un endroit sûr. L’imprimante devra être reconnectée après une restauration.</p>
    <a href="/">Retour au registre</a>
  </section></main>;
}
