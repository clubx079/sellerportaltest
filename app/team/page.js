'use client'
import { useState, useEffect } from 'react'
import { Users, Plus, Trash2, X, Mail, Crown, Clock, CheckCircle, Zap } from 'lucide-react'
import { useRouter } from 'next/navigation'

function fmtDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function StatusBadge({ status }) {
  if (status === 'active') return (
    <span className="inline-flex items-center gap-1 px-2 h-5 rounded text-[11px] font-semibold bg-[#DCFCE7] text-[#16A34A]">
      <CheckCircle className="w-2.5 h-2.5" /> Active
    </span>
  )
  return (
    <span className="inline-flex items-center gap-1 px-2 h-5 rounded text-[11px] font-semibold bg-[#FEF3C7] text-[#D97706]">
      <Clock className="w-2.5 h-2.5" /> Pending
    </span>
  )
}

function InviteModal({ onClose, onInvited, hasOrg, defaultOrgName }) {
  const [form, setForm] = useState({ email: '', name: '', orgName: defaultOrgName || '' })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.email) return
    setSubmitting(true)
    setError('')
    try {
      const sellerId = JSON.parse(localStorage.getItem('seller_user') || '{}')?.id
      const res = await fetch('/api/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sellerId}` },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok || data.error) { setError(data.error || 'Failed to send invitation'); return }
      onInvited()
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
      <div className="bg-white rounded w-full max-w-[440px] shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E8E8E4]">
          <h2 className="text-[16px] font-bold text-[#1A1816]">Invite Team Member</h2>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-[#FAFAF8] text-[#737370]">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {!hasOrg && (
            <div>
              <label className="block text-[12px] font-semibold text-[#444441] mb-1.5">Team Name</label>
              <input
                type="text"
                placeholder="e.g. Acme Wholesale"
                value={form.orgName}
                onChange={e => setForm(f => ({ ...f, orgName: e.target.value }))}
                className="w-full h-9 px-3 border border-[#E8E8E4] rounded text-[13px] text-[#1A1816] placeholder:text-[#A8A8A4] focus:outline-none focus:border-[#1A1816]"
              />
            </div>
          )}
          <div>
            <label className="block text-[12px] font-semibold text-[#444441] mb-1.5">Email Address <span className="text-[#D03839]">*</span></label>
            <input
              type="email"
              placeholder="colleague@example.com"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              className="w-full h-9 px-3 border border-[#E8E8E4] rounded text-[13px] text-[#1A1816] placeholder:text-[#A8A8A4] focus:outline-none focus:border-[#1A1816]"
              required
            />
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-[#444441] mb-1.5">Name <span className="text-[#A8A8A4] font-normal">(optional)</span></label>
            <input
              type="text"
              placeholder="Jane Smith"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full h-9 px-3 border border-[#E8E8E4] rounded text-[13px] text-[#1A1816] placeholder:text-[#A8A8A4] focus:outline-none focus:border-[#1A1816]"
            />
          </div>
          {error && <p className="text-[12px] text-[#D03839]">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 h-9 border border-[#E8E8E4] text-[#444441] text-[13px] font-medium rounded hover:border-[#1A1816]">
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !form.email}
              className="flex-1 h-9 bg-[#D03839] hover:bg-[#E0493B] text-white text-[13px] font-semibold rounded disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Sending...' : 'Send Invite'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function TeamPage() {
  const router = useRouter()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [removing, setRemoving] = useState(null)

  useEffect(() => { fetchTeam() }, [])

  function getSellerId() {
    try { return JSON.parse(localStorage.getItem('seller_user') || '{}')?.id } catch { return null }
  }

  async function fetchTeam() {
    setLoading(true)
    try {
      const res = await fetch('/api/team', { headers: { Authorization: `Bearer ${getSellerId()}` } })
      const json = await res.json()
      setData(json)
    } catch {}
    setLoading(false)
  }

  async function removeMember(memberId) {
    setRemoving(memberId)
    try {
      await fetch(`/api/team/${memberId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${getSellerId()}` },
      })
      fetchTeam()
    } catch {}
    setRemoving(null)
  }

  if (loading) {
    return (
      <div className="p-4 lg:p-6 space-y-3 animate-pulse">
        <div className="h-7 bg-[#E8E8E4] rounded w-32" />
        <div className="h-4 bg-[#E8E8E4] rounded w-64" />
        {[1, 2].map(i => <div key={i} className="h-16 bg-[#E8E8E4] rounded" />)}
      </div>
    )
  }

  if (!data?.isEnterprise) {
    return (
      <div className="p-4 lg:p-6">
        <div className="border border-[#E8E8E4] rounded bg-white p-12 text-center max-w-lg mx-auto">
          <div className="w-12 h-12 bg-[#D03839]/10 rounded flex items-center justify-center mx-auto mb-4">
            <Users className="w-6 h-6 text-[#D03839]" />
          </div>
          <h3 className="text-[16px] font-bold text-[#1A1816] mb-2">Enterprise Feature</h3>
          <p className="text-[13px] text-[#737370] leading-relaxed mb-6">
            Team accounts let you invite colleagues to manage listings, messages, and deals together. Upgrade to Enterprise to unlock this feature.
          </p>
          <button
            onClick={() => router.push('/plans')}
            className="inline-flex items-center gap-2 h-9 px-5 bg-[#D03839] hover:bg-[#E0493B] text-white text-[13px] font-semibold rounded"
          >
            <Zap className="w-4 h-4" /> Upgrade to Enterprise
          </button>
        </div>
      </div>
    )
  }

  const { org, members, seller } = data
  const isOwner = org?.is_owner ?? true

  return (
    <div className="p-4 lg:p-6">
      {showModal && (
        <InviteModal
          hasOrg={!!org}
          defaultOrgName={org?.name || ''}
          onClose={() => setShowModal(false)}
          onInvited={() => { setShowModal(false); fetchTeam() }}
        />
      )}

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-[24px] font-bold text-[#1A1816] mb-1">Team</h1>
          {org ? (
            <p className="text-[14px] text-[#737370]">{org.name}</p>
          ) : (
            <p className="text-[14px] text-[#737370]">Invite colleagues to collaborate on your listings.</p>
          )}
        </div>
        {isOwner && (
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 h-9 px-4 bg-[#D03839] hover:bg-[#E0493B] text-white text-[13px] font-semibold rounded shrink-0"
          >
            <Plus className="w-4 h-4" /> Invite Member
          </button>
        )}
      </div>

      <div className="space-y-2">
        {/* Owner row */}
        <div className="bg-white border border-[#E8E8E4] rounded p-4 flex items-center gap-4">
          <div className="w-9 h-9 rounded-full bg-[#1A1816] flex items-center justify-center shrink-0">
            <span className="text-white text-[13px] font-bold">
              {(seller?.contact_person_name || seller?.email || '?')[0].toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[14px] font-semibold text-[#1A1816] truncate">
                {seller?.contact_person_name || seller?.email}
              </span>
              <span className="inline-flex items-center gap-1 px-2 h-5 rounded text-[11px] font-semibold bg-[#F3F3F0] text-[#444441]">
                <Crown className="w-2.5 h-2.5" /> Owner
              </span>
            </div>
            <p className="text-[12px] text-[#737370] truncate">{seller?.email}</p>
          </div>
        </div>

        {/* Members */}
        {members.map(m => (
          <div key={m.id} className="bg-white border border-[#E8E8E4] rounded p-4 flex items-center gap-4">
            <div className="w-9 h-9 rounded-full bg-[#E8E8E4] flex items-center justify-center shrink-0">
              <span className="text-[#444441] text-[13px] font-bold">
                {(m.name || m.email)[0].toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[14px] font-semibold text-[#1A1816] truncate">
                  {m.name || m.email}
                </span>
                <StatusBadge status={m.status} />
              </div>
              <div className="flex items-center gap-3 text-[12px] text-[#737370]">
                <span className="truncate">{m.email}</span>
                <span className="shrink-0">Invited {fmtDate(m.invited_at)}</span>
              </div>
            </div>
            {isOwner && (
              <button
                onClick={() => removeMember(m.id)}
                disabled={removing === m.id}
                className="shrink-0 p-2 rounded hover:bg-[#FEF0EF] text-[#737370] hover:text-[#D03839] disabled:opacity-50 transition-colors"
                title="Remove member"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        ))}

        {members.length === 0 && (
          <div className="border border-dashed border-[#E8E8E4] rounded p-8 text-center">
            <Mail className="w-5 h-5 text-[#A8A8A4] mx-auto mb-2" />
            <p className="text-[13px] text-[#737370]">No team members yet. Invite someone to get started.</p>
          </div>
        )}
      </div>
    </div>
  )
}
