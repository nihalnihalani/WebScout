import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Watch and Learn',
  description: 'Interactive browser automation with AI agent',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  )
}
