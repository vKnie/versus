import "./globals.css";
import { AuthProvider } from "./providers/AuthProvider";
import ErrorBoundary from "./error-boundary";

export default function RootLayout({ children, }: Readonly<{ children: React.ReactNode; }>) {
  return (
    <html lang="fr">
      <body className="bg-zinc-950" suppressHydrationWarning>
        <ErrorBoundary>
          <AuthProvider>
            {children}
          </AuthProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
