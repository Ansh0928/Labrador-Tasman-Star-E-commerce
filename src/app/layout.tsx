import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tasman Star Seafoods — Fresh Seafood, Daily Catch",
  description: "Join the Tasman Star Seafoods crew for exclusive daily specials, fresh catch alerts, and premium seafood updates delivered straight to your phone.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
