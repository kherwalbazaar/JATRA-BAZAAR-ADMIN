import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Jatra Bazaar - Admin Panel',
  description: 'Enterprise ticketing, Box Office POS counters, and gate access management system for Jatra Bazaar cultural festivals.',
  applicationName: 'Jatra Bazaar Admin',
  icons: {
    icon: '/ic_launcher.png',
    apple: '/ic_launcher.png',
  },
};

export const viewport: Viewport = {
  themeColor: '#181d45',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" type="image/png" href="/ic_launcher.png" />
        <link rel="apple-touch-icon" href="/ic_launcher.png" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-[#f4f6fc] text-slate-800 antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
