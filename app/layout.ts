import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Rombongan Manager V2 - Booking & Billing',
  description: 'Group Booking & Billing System',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}