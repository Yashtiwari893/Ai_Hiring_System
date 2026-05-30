import CandidateTableClient from './CandidateTableClient'
import RecruiterAnalyticsPanel from './RecruiterAnalyticsPanel'
import TopCandidatesPanel from './TopCandidatesPanel'
import { fetchCandidates, getCandidateCounts, getRecruiterAnalytics, getTopCandidates } from '@/lib/db/helpers'
import type { CandidateCounts } from '@/lib/db/types'

export const dynamic = 'force-dynamic'  // har request pe fresh data fetch karo
export const revalidate = 0             // c

const PAGE_SIZE = 10

export default async function Page() {
  const [counts, analytics, leaderboard, pageData] = await Promise.all([
    getCandidateCounts(),
    getRecruiterAnalytics(),
    getTopCandidates(6),
    fetchCandidates({ page: 1, limit: PAGE_SIZE }),
  ])

  return (
    <div className="min-h-screen bg-slate-50 py-10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8 space-y-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-sky-600">Recruiter dashboard</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">Candidate pipeline overview</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Review resumes, identify top talent, and manage your shortlist with clear status tracking and fast candidate search.
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Total candidates</p>
            <p className="mt-4 text-3xl font-semibold text-slate-900">{counts.total}</p>
            <p className="mt-2 text-sm text-slate-500">Applicants in the current queue.</p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Shortlisted</p>
            <p className="mt-4 text-3xl font-semibold text-emerald-700">{counts.shortlisted}</p>
            <p className="mt-2 text-sm text-slate-500">Candidates ready for next-stage review.</p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Manual review</p>
            <p className="mt-4 text-3xl font-semibold text-amber-600">{counts.manualReview}</p>
            <p className="mt-2 text-sm text-slate-500">Applications needing recruiter attention.</p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Rejected</p>
            <p className="mt-4 text-3xl font-semibold text-rose-600">{counts.rejected}</p>
            <p className="mt-2 text-sm text-slate-500">Candidates not advancing further.</p>
          </div>
        </div>

        <div className="mt-8 grid gap-6 xl:grid-cols-[1.4fr,0.95fr]">
          <RecruiterAnalyticsPanel analytics={analytics} />
          <TopCandidatesPanel candidates={leaderboard} />
        </div>

        <div className="mt-8 rounded-3xl border border-slate-200 bg-white px-6 py-6 shadow-sm">
          <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Candidate table</h2>
              <p className="mt-1 text-sm text-slate-500">Search by name, email, or role. Sort through resume scores and candidate status quickly.</p>
            </div>
            <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">Showing page 1 of {Math.max(1, Math.ceil(pageData.total / PAGE_SIZE))}</div>
          </div>

          <CandidateTableClient
            initialCandidates={pageData.candidates}
            initialCounts={counts}
            initialTotal={pageData.total}
            initialPage={pageData.page}
            initialLimit={pageData.limit}
          />
        </div>
      </div>
    </div>
  )
}
