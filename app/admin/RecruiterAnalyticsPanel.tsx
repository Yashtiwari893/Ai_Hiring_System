import type { AnalyticsSummary } from '@/lib/db/types'

type Props = {
  analytics: AnalyticsSummary
}

export default function RecruiterAnalyticsPanel({ analytics }: Props) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Analytics</p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-900">Recruiter insights</h2>
        </div>
        <div className="rounded-full bg-slate-100 px-4 py-2 text-xs uppercase tracking-[0.2em] text-slate-700">Live metrics</div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-3xl bg-slate-50 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Duplicate profiles</p>
          <p className="mt-3 text-3xl font-semibold text-rose-600">{analytics.duplicateCount}</p>
        </div>
        <div className="rounded-3xl bg-slate-50 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Activity notes</p>
          <p className="mt-3 text-3xl font-semibold text-sky-700">{analytics.noteCount}</p>
        </div>
        <div className="rounded-3xl bg-slate-50 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Total candidates</p>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{analytics.total}</p>
        </div>
        <div className="rounded-3xl bg-slate-50 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Manual review</p>
          <p className="mt-3 text-3xl font-semibold text-amber-600">{analytics.manualReview}</p>
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Object.entries(analytics.stageCounts).map(([stage, count]) => (
          <div key={stage} className="rounded-3xl bg-slate-950/5 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{stage}</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{count}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
