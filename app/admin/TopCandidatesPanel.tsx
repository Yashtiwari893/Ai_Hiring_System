import type { LeaderboardCandidate } from '@/lib/db/types'

type Props = {
  candidates: LeaderboardCandidate[]
}

export default function TopCandidatesPanel({ candidates }: Props) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Top candidates</p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-900">Candidate leaderboard</h2>
        </div>
        <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">Top {candidates.length}</span>
      </div>

      {candidates.length === 0 ? (
        <div className="mt-6 rounded-3xl bg-slate-50 p-8 text-center text-sm text-slate-500">No top candidates are available yet.</div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-left text-sm text-slate-700">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Ranking</th>
                <th className="px-4 py-3">Score</th>
                <th className="px-4 py-3">Stage</th>
              </tr>
            </thead>
            <tbody>
              {candidates.map((candidate) => (
                <tr key={candidate.id} className="border-t border-slate-200 hover:bg-slate-50">
                  <td className="px-4 py-4 font-medium text-slate-900">{candidate.name || 'Unknown'}</td>
                  <td className="px-4 py-4 text-slate-600">{candidate.role_applied || '—'}</td>
                  <td className="px-4 py-4 text-slate-600">{candidate.ranking_score ?? '—'}</td>
                  <td className="px-4 py-4 text-slate-600">{candidate.match_score ?? '—'}</td>
                  <td className="px-4 py-4">
                    <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{candidate.current_stage || 'Unknown'}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
