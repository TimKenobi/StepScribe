import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import LockScreen from "@/components/LockScreen";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "StepScribe — One Day at a Time",
  description: "AI-powered recovery journaling companion",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <LockScreen>
          <div className="flex h-screen">
            <Sidebar />
            <main className="flex-1 flex flex-col overflow-hidden">
              {/* Draggable titlebar strip for window movement */}
              <div className="drag-region h-8 shrink-0" />
              <div className="flex-1 overflow-y-auto">
                {children}
              </div>
            </main>
          </div>
        </LockScreen>
      </body>
    </html>
  );
}
