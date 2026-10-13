import type { Metadata } from "next";
import { Outfit, JetBrains_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

// Google Fonts Outfit — Bauhaus geometric sans-serif (circular letterforms & clean geometry)
const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["400", "500", "700", "900"],
  display: "swap",
});

// Google Sans Mono aesthetic for code & PIN tags
const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "GDG On Campus QuizLive — Live Quiz Competition Platform",
    template: "%s · GDG On Campus",
  },
  description:
    "Google Developer Groups on Campus live quiz competition platform. Constructivist Bauhaus speed scoring, instant WebSocket live boards.",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${outfit.variable} ${jetbrainsMono.variable} font-sans antialiased min-h-dvh bg-[#F0F0F0] text-[#121212] selection:bg-[#F9AB00] selection:text-[#121212]`}
      >
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
          {children}
          <Toaster
            position="top-center"
            toastOptions={{
              className: "!border-2 !border-black !bg-white !text-black !shadow-[4px_4px_0px_0px_#121212] !rounded-none !font-sans font-bold",
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
