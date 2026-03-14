import type { Metadata } from "next";
import type { StackServerApp } from "@stackframe/stack";
import { IBM_Plex_Mono, Space_Grotesk } from "next/font/google";
import { StackProvider } from "@stackframe/stack";
import "mapbox-gl/dist/mapbox-gl.css";

import "./globals.css";
import { getStackServerApp } from "@/lib/stack/server";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Founder City",
  description: "A live startup ecosystem rendered as a 3D San Francisco skyline.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const stackApp = await getStackServerApp();
  const content = stackApp
    ? <StackProvider app={stackApp as StackServerApp<true>}>{children}</StackProvider>
    : children;

  return (
    <html lang="en">
      <body className={`${spaceGrotesk.variable} ${ibmPlexMono.variable}`}>
        {content}
      </body>
    </html>
  );
}
