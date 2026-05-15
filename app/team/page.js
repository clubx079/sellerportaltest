'use client'
import { useState, useEffect, useRef } from 'react'
import { Users, Plus, Trash2, X, Mail, Crown, Clock, CheckCircle, Zap, AlertTriangle, ChevronDown, Shield, User } from 'lucide-react'
import { useRouter } from 'next/navigation'

function fmtDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function StatusBadge({ status }) {
  if (status === 'active') return (
    <span className="inline-flex items-center gap-1 px-2 h-5 rounded text-[11px] font-semibold bg-[#E4F5EC] text-[#0F6E56] border border-[#9FDBB8]">
      <CheckCircle className="w-2.5 h-2.5" /> Active
    </span>
  )
  return (
    <span className="inline-flex items-center gap-1 px-2 h-5 rounded text-[11px] font-semibold bg-[#FEF3E2] text-[#B5620A] border border-[#F5D9A0]">
      <Clock className="w-2.5 h-2.5" /> Pending
    </span>
  )
}

function RoleBadge({ role }) {
  if (role === 'admin') return (
    <span className="inline-flex items-center gap-1 px-2 h-5 rounded text-[11px] font-semibold bg-[#EBF3FC] text-[#4A90E2] border border-[#C5DDF8]">
      <Shield className="w-2.5 h-2.5" /> Admin
    </span>
  )
  return (
    <span className="inline-flex items-center gap-1 px-2 h-5 rounded text-[11px] font-semibold bg-[#F3F3F0] text-[#737370] border border-[#E8E8E4]">
      <User className="w-2.5 h-2.5" /> Member
    </span>
  )
}

function RoleDropdown({ memberId, currentRole, onChanged }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  async function changeRole(newRole) {
    if (newRole === currentRole) { setOpen(false); return }
    setLoading(true)
    setOpen(false)
    try {
      const sellerId = JSON.parse(localStorage.getItem('seller_user') || '{}')?.id
      await fetch(`/api/team/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sellerId}` },
        body: JSON.stringify({ role: newRole }),
      })
      onChanged()
    } catch {}
    setLoading(false)
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        disabled={loading}
        className="flex items-center gap-1.5 h-7 px-2.5 border border-[#E8E8E4] rounded text-[12px] font-medium text-[#444441] hover:border-[#1A1816] transition-colors disabled:opacity-50"
      >
        {currentRole === 'admin' ? <Shield className="w-3 h-3 text-[#4A90E2]" /> : <User className="w-3 h-3 text-[#737370]" />}
        {currentRole === 'admin' ? 'Admin' : 'Member'}
        <ChevronDown className="w-3 h-3 text-[#A8A8A4]" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-36 bg-white border border-[#E8E8E4] rounded shadow-lg z-20 overflow-hidden">
          {['admin', 'member'].map(r => (
            <button
              key={r}
              onClick={() => changeRole(r)}
              className={`w-full flex items-center gap-2 px-3 py-2 text-[13px] hover:bg-[#FAFAF8] transition-colors ${currentRole === r ? 'text-[#1A1816] font-semibold' : 'text-[#444441]'}`}
            >
              {r === 'admin' ? <Shield className="w-3.5 h-3.5 text-[#4A90E2]" /> : <User className="w-3.5 h-3.5 text-[#737370]" />}
              <span className="capitalize">{r}</span>
              {currentRole === r && <CheckCircle className="w-3 h-3 text-[#0F6E56] ml-auto" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function InviteModal({ onClose, onInvited, hasOrg, defaultOrgName }) {
  const [form, setForm] = useState({ email: '', name: '', orgName: defaultOrgName || '', role: 'member' })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [isTrialBlock, setIsTrialBlock] = useState(false)
  const router = useRouter()

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.email) return
    setSubmitting(true)
    setError('')
    setIsTrialBlock(false)
    try {
      const sellerId = JSON.parse(localStorage.getItem('seller_user') || '{}')?.id
      const res = await fetch('/api/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sellerId}` },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (data.error === 'TRIAL_ACTIVE') { setIsTrialBlock(true); setSubmitting(false); return }
      if (data.error === 'MEMBER_LIMIT') { setError('Team limit reached. Enterprise plans allow up to 3 team members.'); setSubmitting(false); return }
      if (!res.ok || data.error) { setError(data.error || 'Failed to send invitation'); setSubmitting(false); return }
      onInvited()
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (isTrialBlock) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
        <div className="bg-white rounded w-full max-w-[420px] shadow-xl">
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#E8E8E4]">
            <h2 className="text-[16px] font-bold text-[#1A1816]">Trial Active</h2>
            <button onClick={onClose} className="p-1.5 rounded hover:bg-[#FAFAF8] text-[#737370]"><X className="w-4 h-4" /></button>
          </div>
          <div className="px-6 py-6">
            <div className="w-10 h-10 bg-[#FEF3E2] rounded flex items-center justify-center mb-4">
              <AlertTriangle className="w-5 h-5 text-[#B5620A]" />
            </div>
            <p className="text-[14px] text-[#1A1816] font-semibold mb-2">Your trial is still active</p>
            <p className="text-[13px] text-[#737370] leading-relaxed mb-6">
              Team members can only be invited after your trial ends and your subscription is active.
            </p>
            <div className="flex gap-2">
              <button onClick={onClose} className="flex-1 h-9 border border-[#E8E8E4] text-[#444441] text-[13px] font-medium rounded hover:border-[#1A1816]">Cancel</button>
              <button onClick={() => router.push('/plans')} className="flex-1 h-9 bg-[#D03839] hover:bg-[#E0493B] text-white text-[13px] font-semibold rounded">Go to Plans</button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
      <div className="bg-white rounded w-full max-w-[440px] shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E8E8E4]">
          <h2 className="text-[16px] font-bold text-[#1A1816]">Invite Team Member</h2>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-[#FAFAF8] text-[#737370]"><X className="w-4 h-4" /></button>
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
          <div>
            <label className="block text-[12px] font-semibold text-[#444441] mb-1.5">Role</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { value: 'member', label: 'Member', icon: <User className="w-4 h-4" />, desc: 'Can manage listings & messages' },
                { value: 'admin', label: 'Admin', icon: <Shield className="w-4 h-4" />, desc: 'Full access including billing & offers' },
              ].map(r => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, role: r.value }))}
                  className={`flex flex-col items-start gap-1.5 p-3 rounded border text-left transition-colors ${
                    form.role === r.value
                      ? 'border-[#1A1816] bg-[#FAFAF8]'
                      : 'border-[#E8E8E4] hover:border-[#A8A8A4]'
                  }`}
                >
                  <div className={`flex items-center gap-1.5 text-[13px] font-semibold ${form.role === r.value ? 'text-[#1A1816]' : 'text-[#444441]'}`}>
                    {r.icon}
                    {r.label}
                  </div>
                  <p className="text-[11px] text-[#737370] leading-snug">{r.desc}</p>
                </button>
              ))}
            </div>
          </div>
          {error && <p className="text-[12px] text-[#D03839]">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 h-9 border border-[#E8E8E4] text-[#444441] text-[13px] font-medium rounded hover:border-[#1A1816]">Cancel</button>
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
  const [switchingOrg, setSwitchingOrg] = useState(false)

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
      await fetch(`/api/team/${memberId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${getSellerId()}` } })
      fetchTeam()
    } catch {}
    setRemoving(null)
  }

  async function switchOrg(orgId) {
    setSwitchingOrg(true)
    try {
      await fetch('/api/team', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getSellerId()}` },
        body: JSON.stringify({ orgId }),
      })
      fetchTeam()
    } catch {}
    setSwitchingOrg(false)
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

  const { org, members, memberOrgs = [], isEnterprise, isTrialing, seller } = data || {}
  const isOwner = isEnterprise || (org?.is_owner ?? false)
  const isMemberOfAnyOrg = memberOrgs.length > 0 || (org && !isEnterprise)

  if (!isEnterprise && !isMemberOfAnyOrg) {
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

      {isOwner && isTrialing && (
        <div className="flex items-start gap-3 p-4 bg-[#FEF3E2] border border-[#F5D9A0] rounded mb-5">
          <AlertTriangle className="w-4 h-4 text-[#B5620A] shrink-0 mt-0.5" />
          <div>
            <p className="text-[13px] font-semibold text-[#B5620A]">Trial period active</p>
            <p className="text-[12px] text-[#B5620A] mt-0.5">You can't invite team members while on trial. <button onClick={() => router.push('/plans')} className="underline font-medium">End your trial</button> to activate your subscription first.</p>
          </div>
        </div>
      )}

      {!isOwner && memberOrgs.length > 1 && (
        <div className="mb-5">
          <label className="block text-[11px] font-semibold text-[#A8A8A4] uppercase tracking-[1px] mb-2">Active Workspace</label>
          <div className="flex gap-2 flex-wrap">
            {memberOrgs.map(o => (
              <button
                key={o.id}
                onClick={() => o.id !== org?.id && switchOrg(o.id)}
                disabled={switchingOrg}
                className={`flex items-center gap-2 px-4 h-9 rounded border text-[13px] font-medium transition-colors ${
                  o.id === org?.id
                    ? 'bg-[#1A1816] border-[#1A1816] text-white'
                    : 'bg-white border-[#E8E8E4] text-[#444441] hover:border-[#1A1816]'
                }`}
              >
                {o.name}
                {o.id === org?.id && <CheckCircle className="w-3.5 h-3.5" />}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-[24px] font-bold text-[#1A1816] mb-1">Team</h1>
          {org ? (
            <p className="text-[14px] text-[#737370]">
              {isOwner ? org.name : `You're a member of ${org.name}`}
            </p>
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

      {/* Role legend */}
      <div className="flex items-center gap-4 mb-4 px-1">
        <div className="flex items-center gap-1.5 text-[12px] text-[#737370]">
          <Shield className="w-3.5 h-3.5 text-[#4A90E2]" />
          <span><strong className="text-[#1A1816]">Admin</strong> — billing, offers, promotions, team management</span>
        </div>
        <div className="flex items-center gap-1.5 text-[12px] text-[#737370]">
          <User className="w-3.5 h-3.5 text-[#737370]" />
          <span><strong className="text-[#1A1816]">Member</strong> — listings, messages, contracts, analytics</span>
        </div>
      </div>

      <div className="space-y-2">
        {/* Owner row */}
        {org && (
          <div className="bg-white border border-[#E8E8E4] rounded p-4 flex items-center gap-4">
            <div className="w-9 h-9 rounded-full bg-[#1A1816] flex items-center justify-center shrink-0">
              <span className="text-white text-[13px] font-bold">
                {(isOwner ? seller?.contact_person_name : org.owner?.contact_person_name || org.name)?.[0]?.toUpperCase() || '?'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[14px] font-semibold text-[#1A1816] truncate">
                  {isOwner ? (seller?.contact_person_name || seller?.email) : (org.owner?.contact_person_name || org.owner?.email || 'Owner')}
                </span>
                <span className="inline-flex items-center gap-1 px-2 h-5 rounded text-[11px] font-semibold bg-[#F3F3F0] text-[#444441] border border-[#E8E8E4]">
                  <Crown className="w-2.5 h-2.5" /> Owner
                </span>
              </div>
              <p className="text-[12px] text-[#737370] truncate">
                {isOwner ? seller?.email : (org.owner?.email || '')}
              </p>
            </div>
          </div>
        )}

        {/* Members */}
        {members?.map(m => (
          <div key={m.id} className="bg-white border border-[#E8E8E4] rounded p-4 flex items-center gap-4">
            <div className="w-9 h-9 rounded-full bg-[#E8E8E4] flex items-center justify-center shrink-0">
              <span className="text-[#444441] text-[13px] font-bold">
                {(m.name || m.email)[0].toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                <span className="text-[14px] font-semibold text-[#1A1816] truncate">{m.name || m.email}</span>
                <StatusBadge status={m.status} />
                <RoleBadge role={m.role || 'member'} />
              </div>
              <div className="flex items-center gap-3 text-[12px] text-[#737370]">
                <span className="truncate">{m.email}</span>
                <span className="shrink-0">Invited {fmtDate(m.invited_at)}</span>
              </div>
            </div>
            {isOwner && (
              <div className="flex items-center gap-2 shrink-0">
                <RoleDropdown
                  memberId={m.id}
                  currentRole={m.role || 'member'}
                  onChanged={fetchTeam}
                />
                <button
                  onClick={() => removeMember(m.id)}
                  disabled={removing === m.id}
                  className="p-2 rounded hover:bg-[#FEF0EF] text-[#737370] hover:text-[#D03839] disabled:opacity-50 transition-colors"
                  title="Remove member"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        ))}

        {(!members || members.length === 0) && isOwner && (
          <div className="border border-dashed border-[#E8E8E4] rounded p-8 text-center">
            <Mail className="w-5 h-5 text-[#A8A8A4] mx-auto mb-2" />
            <p className="text-[13px] text-[#737370]">No team members yet. Invite someone to get started.</p>
          </div>
        )}
      </div>
    </div>
  )
}
