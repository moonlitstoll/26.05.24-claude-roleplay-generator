import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RealTalk Roleplay Generator",
  description: "Generate native-level roleplay conversations with AI",
  icons: {
    icon: "/favicon.ico",
    apple: "/icon-192.png",
  },
  appleWebApp: {
    capable: true,
    title: "RealTalk",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#f8fafc",
};

// Runs before the first paint so dark-mode users never see a white flash.
// Same rule as resolveTheme in utils/theme.ts; change both together.
const THEME_BOOT = `(function () {
  try {
    var p = localStorage.getItem('roleplay_theme');
    var dark = p === 'dark' || (p !== 'light' && !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches));
    var el = document.documentElement;
    if (dark) el.classList.add('dark');
    el.style.colorScheme = dark ? 'dark' : 'light';
  } catch (e) {}
})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // suppressHydrationWarning: the boot script changes <html> before React attaches.
    <html lang="ko" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
