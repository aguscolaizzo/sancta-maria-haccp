import type { Metadata, Viewport } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "HACCP · Sancta Maria 1187",
  description: "Températures, traçabilité des préparations et étiquettes QR de Sancta Maria 1187.",
  icons: { icon:"/sancta-maria-1187-logo.jpg", shortcut:"/sancta-maria-1187-logo.jpg", apple:"/sancta-maria-1187-logo.jpg" },
  appleWebApp: { capable:true, title:"Sancta HACCP", statusBarStyle:"default" },
};
export const viewport: Viewport = { width:"device-width", initialScale:1, themeColor:"#4a1420" };
export default function RootLayout({children}:{children:React.ReactNode}) {
  return <html lang="fr"><body>{children}</body></html>;
}
