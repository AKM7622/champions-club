import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "The Champions Club | Unified Sports Club Management Platform",
  description: "The digital backbone for courts, pro shop, cafeteria & bar, CRM, and financial aggregator.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="bg-slate-950 text-slate-100 min-h-screen antialiased selection:bg-emerald-500 selection:text-white">
        {children}
      </body>
    </html>
  );
}
