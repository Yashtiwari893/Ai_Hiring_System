import Link from 'next/link'

export default function HomePage() {
  return (
    <main>
      <div className="container">
        <div className="card hero" style={{ marginTop: 24 }}>
          <div>
            <h1>AI-powered hiring automation for smarter talent sourcing</h1>
            <p>
              Automatically screen resumes, score candidates with AI, and manage your entire
              hiring pipeline — from application to offer — in one place.
            </p>
            <div style={{ marginTop: 20, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <Link href="/apply" className="btn">Apply for a Job</Link>
              <Link href="/admin" className="btn secondary">Recruiter Dashboard</Link>
            </div>
          </div>
        </div>

        <div style={{ marginTop: 24, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
          {[
            { icon: '📄', title: 'Resume Parsing', desc: 'AI extracts skills, experience, and education from any PDF resume.' },
            { icon: '🎯', title: 'Smart Scoring', desc: 'Gemini scores each candidate 0–100 based on role fit.' },
            { icon: '✉️', title: 'Auto Emails', desc: 'Personalized shortlist and rejection emails sent automatically.' },
            { icon: '📊', title: 'Pipeline Tracking', desc: 'Track every candidate from Applied to Hired in one dashboard.' },
          ].map((f) => (
            <div key={f.title} className="card" style={{ padding: 20 }}>
              <div style={{ fontSize: 28, marginBottom: 10 }}>{f.icon}</div>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>{f.title}</div>
              <div style={{ color: '#64748b', fontSize: 14 }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}
