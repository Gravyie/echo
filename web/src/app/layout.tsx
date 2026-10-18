import type { Metadata } from "next";
import { Geist, Geist_Mono, Newsreader } from "next/font/google";
import "./globals.css";

const display = Newsreader({ variable: "--font-newsreader", subsets: ["latin"], style: ["normal", "italic"], weight: ["300", "400", "500"] });
const sans = Geist({ variable: "--font-geist", subsets: ["latin"] });
const mono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Echo: agent memory that counts origins, not mentions",
  description:
    "Echo is an agent memory layer on FalkorDB. It traces every belief back to where it came from, so five copies of one planted post count as one source.",
  openGraph: {
    title: "Echo: five sources, one origin",
    description: "Agent memory on FalkorDB that knows when repetition is not corroboration.",
  },
};

// Apply the stored theme before first paint (no flash). One choice for the whole site.
const THEME_SCRIPT = `try{var t=localStorage.getItem("echo.theme");if(t==="dark"||t==="light")document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} ${mono.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="grain flex min-h-full flex-col">{children}</body>
    </html>
  );
}
