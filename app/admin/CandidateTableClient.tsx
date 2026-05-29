"use client"

import React, { useEffect, useMemo, useState } from 'react'
import type { Candidate, CandidateCounts } from '@/lib/db/types'

type CandidateTableClientProps = {
  initialCandidates: Candidate[]
  initialCounts: CandidateCounts
  initialTotal: number
  initialPage: number
  initialLimit: number
}

type ApiResponse = {
  ok: boolean
  candidates: Candidate[]
  total: number
  page: number
  limit: number
  totalPages: number
  error?: string
}

const STATUS_OPTIONS = ['All', 'Shortlisted', 'Manual Review', 'Rejected']

function getStatusPillClasses(status?: string) {
  if (status === 'Shortlisted') return 'bg-emerald-100 text-emerald-800'
  if (status === 'Rejected') return 'bg-rose-100 text-rose-800'
  if (status === 'Manual Review') return 'bg-amber-100 text-amber-800'
  return 'bg-slate-100 text-slate-700'
}

function renderSkills(candidate: Candidate) {
  const skills = candidate.parsed_json?.skills
  if (Array.isArray(skills) && skills.length > 0) {
    return skills.slice(0, 3).join(', ')
  }
  if (typeof skills === 'string' && skills.trim().length > 0) {
    return skills.split(/\n|,|;/).slice(0, 3).join(', ')
  }
  return '-'
}

export default function CandidateTableClient({
  initialCandidates,
  initialCounts,
  initialTotal,
  initialPage,
  initialLimit,
}: CandidateTableClientProps) {
  const [selected, setSelected] = useState<Candidate | null>(null)
  const [filter, setFilter] = useState<string>('All')
  const [search, setSearch] = useState<string>('')
  const [candidates, setCandidates] = useState<Candidate[]>(initialCandidates)
  const [total, setTotal] = useState<number>(initialTotal)
  const [page, setPage] = useState<number>(initialPage)
  const [limit] = useState<number>(initialLimit)
  const [totalPages, setTotalPages] = useState<number>(Math.max(1, Math.ceil(initialTotal / initialLimit)))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      setLoading(true)
      setError(null)

      try {
        const params = new URLSearchParams()
        params.set('page', String(page))
        params.set('limit', String(limit))
        params.set('filter', filter)
        params.set('search', search.trim())

        const response = await fetch(`/api/admin/candidates?${params.toString()}`, {
          cache: 'no-store',
          signal: controller.signal,
        })

        const data: ApiResponse = await response.json()
        if (!response.ok || !data.ok) {
          throw new Error(data.error || 'Failed to load candidates')
        }

        setCandidates(data.candidates)
        setTotal(data.total)
        setTotalPages(data.totalPages)
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          setError(err.message || 'Unable to load candidate data.')
        }
      } finally {
        setLoading(false)
      }
    }, 250)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [page, filter, search, limit])

  const handleSearchChange = (value: string) => {
    setSearch(value)
    setPage(1)
  }

  const handleFilterChange = (value: string) => {
    setFilter(value)
    setPage(1)
  }

  const visibleCount = candidates.length

  const pageSummary = useMemo(() => {
    if (loading) return 'Loading candidates...'
    if (error) return 'Unable to display candidates.'
    if (visibleCount === 0) return 'No candidates match this filter.'
    return `Showing ${visibleCount} of ${total} candidates`
  }, [loading, error, visibleCount, total])

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-[1.6fr,0.9fr]">
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm font-semibold text-slate-700">Status filter</label>
          <div className="flex flex-wrap gap-2">
            {STATUS_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => handleFilterChange(option)}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${filter === option ? 'bg-slate-900 text-white shadow-sm' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
              >
                {option}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <label htmlFor="candidate-search" className="sr-only">Search candidates</label>
          <input
            id="candidate-search"
            type="search"
            value={search}
            onChange={(event) => handleSearchChange(event.target.value)}
            placeholder="Search by name, email, or role"
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-slate-400 focus:bg-white"
          />
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-slate-900/5 p-4 text-sm text-slate-500">{pageSummary}</div>

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
            <thead className="bg-slate-50 text-slate-700">
              <tr>
                <th className="px-6 py-4 uppercase tracking-[0.16em]">Name</th>
                <th className="px-6 py-4 uppercase tracking-[0.16em]">Email</th>
                <th className="px-6 py-4 uppercase tracking-[0.16em]">Role</th>
                <th className="px-6 py-4 uppercase tracking-[0.16em]">Skills</th>
                <th className="px-6 py-4 uppercase tracking-[0.16em]">Ranking</th>
                <th className="px-6 py-4 uppercase tracking-[0.16em]">Score</th>
                <th className="px-6 py-4 uppercase tracking-[0.16em]">Stage</th>
                <th className="px-6 py-4 uppercase tracking-[0.16em]">Status</th>
                <th className="px-6 py-4 uppercase tracking-[0.16em]">Resume</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {loading ? (
                Array.from({ length: 5 }).map((_, index) => (
                  <tr key={index} className="animate-pulse">
                    <td className="px-6 py-5" colSpan={7}>
                      <div className="h-4 rounded-full bg-slate-200" />
                    </td>
                  </tr>
                ))
              ) : error ? (
                <tr>
                  <td colSpan={7} className="p-10 text-center text-sm text-rose-600">
                    {error}
                  </td>
                </tr>
              ) : candidates.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-10 text-center text-sm text-slate-600">
                    No candidates found. Adjust your filter or search query to see more results.
                  </td>
                </tr>
              ) : (
                candidates.map((candidate) => {
                  const score = candidate.match_score ?? 0
                  return (
                    <tr key={candidate.id} className="group hover:bg-slate-50">
                      <td className="px-6 py-4 align-top">
                        <div className="text-sm font-semibold text-slate-900">{candidate.name || '—'}</div>
                        <div className="mt-1 text-xs text-slate-500">{candidate.city || 'No city'}</div>
                      </td>
                      <td className="px-6 py-4 align-top text-sm text-slate-600">{candidate.email || '—'}</td>
                      <td className="px-6 py-4 align-top text-sm text-slate-600">{candidate.role_applied || '—'}</td>
                      <td className="px-6 py-4 align-top text-sm text-slate-600">{renderSkills(candidate)}</td>
                      <td className="px-6 py-4 align-top text-sm text-slate-600">{candidate.ranking_score ?? '—'}</td>
                      <td className="px-6 py-4 align-top">
                        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${score >= 80 ? 'bg-emerald-100 text-emerald-800' : score >= 50 ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'}`}>
                          {score}
                        </span>
                      </td>
                      <td className="px-6 py-4 align-top text-sm text-slate-600">{candidate.current_stage || '—'}</td>
                      <td className="px-6 py-4 align-top">
                        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getStatusPillClasses(candidate.status)}`}>
                          {candidate.status || 'Unknown'}
                        </span>
                      </td>
                      <td className="px-6 py-4 align-top text-sm">
                        {candidate.resume_url ? (
                          <a href={candidate.resume_url} target="_blank" rel="noreferrer" className="font-medium text-sky-600 hover:text-sky-700">
                            View
                          </a>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-col gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-slate-600">Page {page} of {totalPages}</div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            disabled={page <= 1 || loading}
            className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Previous
          </button>
          <button
            type="button"
            onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
            disabled={page >= totalPages || loading}
            className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  )
}
