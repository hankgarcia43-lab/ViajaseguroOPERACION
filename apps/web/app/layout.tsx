import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { TopNav } from '@/components/top-nav';
import './globals.css';

export const metadata: Metadata = {
  title: 'Viaja Seguro',
  description: 'Comunidad de rutas compartidas con personas verificadas, puntos visibles y coordinacion segura.'
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body>
        <TopNav />
        <main className="vs-shell">{children}</main>
      </body>
    </html>
  );
}
