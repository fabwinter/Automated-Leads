import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Outreach Engine",
  description: "Discover, audit, and pitch website redesigns to local businesses",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-background text-foreground">
        <div className="min-h-screen flex flex-col">
          <header className="border-b bg-card">
            <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="text-xl font-bold text-primary">
                  Outreach Engine
                </div>
                <div className="text-xs text-muted-foreground">Phase 1</div>
              </div>
              <div className="flex items-center gap-4">
                <nav className="text-sm text-muted-foreground space-x-4">
                  <a href="/" className="hover:text-foreground">
                    Dashboard
                  </a>
                </nav>
              </div>
            </div>
          </header>
          <main className="flex-1">{children}</main>
        </div>
      </body>
    </html>
  );
}
