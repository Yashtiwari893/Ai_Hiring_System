import type { Metadata } from 'next'
import Link from 'next/link'
import './globals.css'

export const metadata: Metadata = {
  title: 'HireAI - AI Recruitment Platform',
  description: 'Automate candidate screening with AI-powered resume analysis and scoring',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <div className="container header-inner">
            <Link href="/" className="logo">
              <span className="logo-mark">🤖</span>
              <span className="logo-text">HireAI</span>
            </Link>
            <nav className="nav">
              <Link href="/apply" className="nav-link">Apply Now</Link>
              <Link href="/admin" className="nav-link">Dashboard</Link>
            </nav>
          </div>
        </header>

        <main>{children}</main>

        <footer className="site-footer">
          <div className="container footer-inner">
            <div>© {new Date().getFullYear()} HireAI — AI Recruitment Platform</div>
            <div>Built with AI for smarter hiring</div>
          </div>
        </footer>
      </body>
    </html>
  )
}
