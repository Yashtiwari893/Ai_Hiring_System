"use client"

import React, { useState } from 'react'
import { createClient } from '@supabase/supabase-js'

// Requires a Supabase storage bucket named 'resumes' with public access enabled

const supabase =
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    ? createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL as string,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string
      )
    : null

const ROLES = [
  'Frontend Developer',
  'Backend Developer',
  'Full Stack Developer',
  'AI/ML Engineer',
  'Data Analyst',
  'UI/UX Designer',
  'Product Manager',
  'DevOps Engineer',
]

export default function ApplyPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [city, setCity] = useState('')
  const [college, setCollege] = useState('')
  const [role, setRole] = useState('')
  const [resumeFile, setResumeFile] = useState<File | null>(null)

  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  function resetForm() {
    setName(''); setEmail(''); setPhone(''); setCity('')
    setCollege(''); setRole(''); setResumeFile(null)
    setError(null); setSuccess(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    if (!resumeFile) {
      setError('Please upload your resume as a PDF file.')
      return
    }
    if (!supabase) {
      setError('Storage is not configured. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.')
      return
    }
    if (resumeFile.type !== 'application/pdf' && !resumeFile.name.endsWith('.pdf')) {
      setError('Only PDF files are allowed.')
      return
    }

    setUploading(true)
    try {
      const timestamp = Date.now()
      const safeName = `${timestamp}_${resumeFile.name.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`
      const { error: uploadError } = await supabase.storage
        .from('resumes')
        .upload(safeName, resumeFile, { upsert: true })

      if (uploadError) throw uploadError

      const { data: publicData } = supabase.storage.from('resumes').getPublicUrl(safeName)
      const resumeUrl = publicData?.publicUrl
      if (!resumeUrl) throw new Error('Failed to get public URL for the uploaded file.')

      setUploading(false)
      setSubmitting(true)

      const res = await fetch('/api/process-application', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, phone, city, college, role_applied: role, resume_url: resumeUrl }),
      })

      const result = await res.json()
      if (!res.ok) throw new Error(result?.error || 'Submission failed.')

      setSuccess('Thank you! Your application has been submitted successfully. We will review your resume and get back to you.')
      resetForm()
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.')
    } finally {
      setUploading(false)
      setSubmitting(false)
    }
  }

  const isLoading = uploading || submitting

  return (
    <div className="container" style={{ maxWidth: 600, paddingTop: 32, paddingBottom: 48 }}>
      <div className="card">
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Apply for a Position</h1>
        <p style={{ color: '#64748b', fontSize: 14, marginBottom: 28 }}>
          Fill in your details and upload your resume. Our AI will review your application automatically.
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="form-row">
            <label>Full Name *</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} required placeholder="John Doe" />
          </div>

          <div className="form-row">
            <label>Email Address *</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="john@example.com" />
          </div>

          <div className="form-row">
            <label>Phone Number</label>
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98765 43210" />
          </div>

          <div className="form-row">
            <label>City</label>
            <input type="text" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Mumbai" />
          </div>

          <div className="form-row">
            <label>College / University</label>
            <input type="text" value={college} onChange={(e) => setCollege(e.target.value)} placeholder="IIT Delhi" />
          </div>

          <div className="form-row">
            <label>Role Applied For *</label>
            <select value={role} onChange={(e) => setRole(e.target.value)} required>
              <option value="">Select a role</option>
              {ROLES.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          <div className="form-row">
            <label>Upload Resume (PDF) *</label>
            <input
              type="file"
              accept="application/pdf"
              onChange={(e) => setResumeFile(e.target.files ? e.target.files[0] : null)}
              required
            />
            <span style={{ fontSize: 12, color: '#94a3b8' }}>Upload your resume as a PDF file (max 10MB)</span>
          </div>

          {error && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '12px 16px', borderRadius: 8, fontSize: 14 }}>
              {error}
            </div>
          )}
          {success && (
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#16a34a', padding: '12px 16px', borderRadius: 8, fontSize: 14 }}>
              {success}
            </div>
          )}

          <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
            <button type="submit" className="btn" disabled={isLoading}>
              {uploading ? 'Uploading resume...' : submitting ? 'Submitting...' : 'Submit Application'}
            </button>
            <button type="button" className="btn secondary" onClick={resetForm} disabled={isLoading}>
              Reset
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
