import type { Metadata } from "next";
import { Fredoka, Lilita_One } from "next/font/google";
import { MotionConfig } from "motion/react";
import { ThemeProvider } from "next-themes";
import { Suspense } from "react";
import { AppShell } from "@/components/app-shell";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { GameProvider } from "@/lib/game-data";
import { StoreProvider } from "@/lib/store";
import "./globals.css";

const fredoka = Fredoka({
  subsets: ["latin"],
  variable: "--font-fredoka",
  weight: ["400", "500", "600", "700"],
});

const lilita = Lilita_One({
  subsets: ["latin"],
  variable: "--font-lilita",
  weight: "400",
});

export const metadata: Metadata = {
  title: "Zombie Walk Home",
  description:
    "Zombie Walk Home turns movement exercises into a projected night-garden game. A camera scores every step, and Maya, the AI therapist, reviews each walk.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${fredoka.variable} ${lilita.variable} dark h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full bg-background text-foreground">
        <ThemeProvider attribute="class" defaultTheme="dark" forcedTheme="dark" enableSystem={false} disableTransitionOnChange>
          <TooltipProvider delay={300}>
            <MotionConfig reducedMotion="user">
              <StoreProvider>
                <GameProvider>
                  <Suspense fallback={null}>
                    <AppShell>{children}</AppShell>
                  </Suspense>
                </GameProvider>
              </StoreProvider>
            </MotionConfig>
            <Toaster position="top-center" />
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
