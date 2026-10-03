import FrigoApp from "./frigo-app";
import AccessGate from "./access-gate";
import { chatGPTSignInPath, chatGPTSignOutPath } from "./chatgpt-auth";
import { getAccessContext, publicAccess } from "@/lib/access";
export const dynamic = "force-dynamic";
export default async function Home() {
  const context=await getAccessContext();
  if(context.status!=="active"||!context.identity||!context.role) return <AccessGate access={publicAccess(context)} signInPath={chatGPTSignInPath("/")} signOutPath={chatGPTSignOutPath("/")}/>;
  return <FrigoApp session={{role:context.role,email:context.identity.email,displayName:context.identity.displayName}}/>;
}
