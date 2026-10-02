import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, DM_Mono, Instrument_Sans } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { InstallPrompt } from "@/components/pwa/install-prompt";
import { RegisterServiceWorker } from "@/components/pwa/register-sw";
import { Toaster } from "@/components/ui/sonner";
import { BRAND } from "@/lib/pwa/icon";
import "./globals.css";

const defaultUrl = process.env.NEXT_PUBLIC_SITE_URL
  ? process.env.NEXT_PUBLIC_SITE_URL
  : process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(defaultUrl),
  title: { default: BRAND.name, template: `%s · ${BRAND.name}` },
  description: "Finance, vehicle, projects, nutrition and fitness in one place.",
  applicationName: BRAND.name,
  // iOS Safari ignores the manifest: these make "Add to Home Screen" open full-screen.
  appleWebApp: { capable: true, title: BRAND.shortName, statusBarStyle: "black-translucent" },
  // Next only emits mobile-web-app-capable; iOS older than 16.4 needs the apple- one to open full-screen.
  other: { "apple-mobile-web-app-capable": "yes" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: BRAND.desk },
    { media: "(prefers-color-scheme: dark)", color: BRAND.night },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover", // lets the UI extend under the notch; use env(safe-area-inset-*) for padding
};

// Display: headings and headline figures. Sans: everything you read. Mono: labels, units and table figures.
const display = Bricolage_Grotesque({ variable: "--font-display", display: "swap", subsets: ["latin"] });
const sans = Instrument_Sans({ variable: "--font-sans", display: "swap", subsets: ["latin"] });
const mono = DM_Mono({ variable: "--font-mono", display: "swap", subsets: ["latin"], weight: ["400", "500"] });

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${display.variable} ${sans.variable} ${mono.variable} antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <InstallPrompt />
          <Toaster />
        </ThemeProvider>
        <RegisterServiceWorker />
      </body>
    </html>
  );
}
