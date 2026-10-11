import "./globals.css";
import StudioProvider from "@/components/StudioProvider";
import RegisterSW from "@/components/RegisterSW";

export const metadata = {
  title: { default: "Digitorium Studio", template: "%s · Digitorium Studio" },
  description: "Admin for digitorium.in: leads, media and team.",
  robots: { index: false, follow: false, nocache: true },
  appleWebApp: { capable: true, title: "Studio", statusBarStyle: "default" },
};

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
