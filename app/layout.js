import "./globals.css";
import StudioProvider from "@/components/StudioProvider";
import RegisterSW from "@/components/RegisterSW";
import { headers } from "next/headers";
import { CLIENTS, clientForHost } from "@/lib/clients";

export async function generateMetadata() {
  /* on a client's portal address the tab reads as that client's CMS */
  const c = CLIENTS[clientForHost((await headers()).get("host"))];
  const name = c ? c.name + " CMS" : "Digitorium Studio";
  return {
    title: { default: name, template: "%s · " + name },
    description: c ? "Edit the " + c.name + " website." : "Admin for digitorium.in: leads, media and team.",
    robots: { index: false, follow: false, nocache: true },
    appleWebApp: { capable: true, title: c ? c.short + " CMS" : "Studio", statusBarStyle: "default" },
    ...(c ? { icons: { icon: c.icon, apple: c.icon } } : {}),
  };
}

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#ffffff",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en-IN">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" />
      </head>
      <body>
        <StudioProvider>{children}</StudioProvider>
        <RegisterSW />
      </body>
    </html>
  );
}
