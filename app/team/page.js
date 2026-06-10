'use client'
import { useState, useEffect, useRef } from 'react'
import { Users, Plus, Trash2, X, Mail, Crown, Clock, CheckCircle, Check, Zap, AlertTriangle, Shield, Settings2, Phone, RefreshCw, Pencil } from 'lucide-react'
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

const PERMISSION_GROUPS = [
  {
    group: 'Listings',
    items: [
      { key: 'listings_create', label: 'Create listings' },
      { key: 'listings_update', label: 'Edit listings' },
      { key: 'listings_delete', label: 'Delete listings' },
    ]
  },
  {
    group: 'Analytics',
    items: [
      { key: 'analytics_view', label: 'View analytics' },
    ]
  },
  {
    group: 'Contracts',
    items: [
      { key: 'contracts_create', label: 'Create contracts' },
      { key: 'contracts_update', label: 'Edit contracts' },
      { key: 'contracts_delete', label: 'Delete contracts' },
    ]
  },
  {
    group: 'Offers',
    items: [
      { key: 'offers_create', label: 'Create offers' },
    ]
  },
  {
    group: 'Inbox',
    items: [
      { key: 'inbox_access', label: 'Access messages' },
    ]
  },
  {
    group: 'Add-ons',
    items: [
      { key: 'addons_buy', label: 'Purchase add-ons' },
    ]
  },
]

const ALL_PERMISSION_KEYS = PERMISSION_GROUPS.flatMap(g => g.items.map(i => i.key))
const TOTAL_PERMISSIONS = ALL_PERMISSION_KEYS.length

function getPermissionCount(perms) {
  if (!perms) return 0
  return ALL_PERMISSION_KEYS.filter(k => perms[k]).length
}

function derivePermissionsFromRole(role) {
  const allTrue = Object.fromEntries(ALL_PERMISSION_KEYS.map(k => [k, true]))
  const allFalse = Object.fromEntries(ALL_PERMISSION_KEYS.map(k => [k, false]))
  return role === 'admin' ? allTrue : allFalse
}

function PermissionToggles({ permissions, onChange }) {
  const allSelected = ALL_PERMISSION_KEYS.every(k => permissions[k])
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-[#E8E8E4]">
        <span className="text-[12px] font-semibold text-[#1A1816]">All permissions</span>
        <button
          type="button"
          onClick={() => {
            const next = !allSelected
            onChange(Object.fromEntries(ALL_PERMISSION_KEYS.map(k => [k, next])))
          }}
          className="text-[11px] text-[#D03839] hover:underline font-semibold"
        >
          {allSelected ? 'Clear all' : 'Select all'}
        </button>
      </div>
      {PERMISSION_GROUPS.map(group => {
        const allOn = group.items.every(i => permissions[i.key])
        return (
          <div key={group.group}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold text-[#A8A8A4] uppercase tracking-wider">{group.group}</span>
              <button
                type="button"
                onClick={() => {
                  const newPerms = { ...permissions }
                  group.items.forEach(i => { newPerms[i.key] = !allOn })
                  onChange(newPerms)
                }}
                className="text-[11px] text-[#D03839] hover:underline font-medium"
              >
                {allOn ? 'Remove all' : 'Select all'}
              </button>
            </div>
            <div className="space-y-2">
              {group.items.map(item => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => onChange({ ...permissions, [item.key]: !permissions[item.key] })}
                  className="flex items-center gap-2.5 w-full text-left group"
                >
                  <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
                    permissions[item.key]
                      ? 'bg-[#1A1816] border-[#1A1816]'
                      : 'border-[#E8E8E4] group-hover:border-[#A8A8A4]'
                  }`}>
                    {permissions[item.key] && <Check className="w-2.5 h-2.5 text-white" />}
                  </div>
                  <span className="text-[13px] text-[#444441] group-hover:text-[#1A1816]">{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function PermissionsPopup({ memberId, currentPermissions, memberRole, onChanged, onToast }) {
  const [open, setOpen] = useState(false)
  const [perms, setPerms] = useState(() => currentPermissions || derivePermissionsFromRole(memberRole))
  const [saving, setSaving] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    setPerms(currentPermissions || derivePermissionsFromRole(memberRole))
  }, [currentPermissions, memberRole])

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  async function save() {
    setSaving(true)
    try {
      const sellerId = JSON.parse(localStorage.getItem('seller_user') || '{}')?.id
      const res = await fetch(`/api/team/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sellerId}` },
        body: JSON.stringify({ permissions: perms }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        onToast?.(data.error || 'Failed to update access', 'error')
        setSaving(false)
        return
      }
      onChanged()
      onToast?.('Access updated')
      setOpen(false)
    } catch {
      onToast?.('Failed to update access', 'error')
    }
    setSaving(false)
  }

  const count = getPermissionCount(perms)

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-1.5 h-7 px-2.5 border rounded text-[12px] font-medium transition-colors ${
          open
            ? 'border-[#1A1816] bg-[#FAFAF8] text-[#1A1816]'
            : 'border-[#E8E8E4] text-[#444441] hover:border-[#1A1816]'
        }`}
      >
        <Settings2 className="w-3 h-3" />
        {count}/{TOTAL_PERMISSIONS} access
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-72 bg-white border border-[#E8E8E4] rounded shadow-xl z-30 overflow-hidden">
          <div className="px-4 py-3 border-b border-[#E8E8E4] flex items-center justify-between">
            <span className="text-[13px] font-semibold text-[#1A1816]">Manage Access</span>
            <button onClick={() => setOpen(false)} className="p-1 rounded hover:bg-[#FAFAF8]">
              <X className="w-3.5 h-3.5 text-[#737370]" />
            </button>
          </div>
          <div className="p-4 max-h-80 overflow-y-auto">
            <PermissionToggles permissions={perms} onChange={setPerms} />
          </div>
          <div className="px-4 py-3 border-t border-[#E8E8E4] flex gap-2">
            <button
              onClick={() => { setPerms(currentPermissions || derivePermissionsFromRole(memberRole)); setOpen(false) }}
              className="flex-1 h-8 border border-[#E8E8E4] text-[#444441] text-[12px] font-medium rounded hover:border-[#1A1816]"
            >
              Cancel
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="flex-1 h-8 bg-[#D03839] hover:bg-[#E0493B] text-white text-[12px] font-semibold rounded disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function InviteModal({ onClose, onInvited, hasOrg, defaultOrgName }) {
  const DEFAULT_PERMS = Object.fromEntries(ALL_PERMISSION_KEYS.map(k => [k, false]))
  const [form, setForm] = useState({ email: '', name: '', orgName: defaultOrgName || '' })
  const [permissions, setPermissions] = useState(DEFAULT_PERMS)
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
        body: JSON.stringify({ ...form, permissions }),
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
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
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

  const permCount = getPermissionCount(permissions)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="bg-white rounded w-full max-w-[480px] shadow-xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E8E8E4] shrink-0">
          <h2 className="text-[16px] font-bold text-[#1A1816]">Invite Team Member</h2>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-[#FAFAF8] text-[#737370]"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1">
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
              <div className="flex items-center justify-between mb-3">
                <label className="text-[12px] font-semibold text-[#444441]">Permissions</label>
                <span className="text-[11px] text-[#737370]">{permCount} of {TOTAL_PERMISSIONS} selected</span>
              </div>
              <div className="border border-[#E8E8E4] rounded p-4">
                <PermissionToggles permissions={permissions} onChange={setPermissions} />
              </div>
            </div>
            {error && <p className="text-[12px] text-[#D03839]">{error}</p>}
          </div>
          <div className="flex gap-2 px-6 py-4 border-t border-[#E8E8E4] shrink-0">
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

function MemberPhoneField({ memberId, initialPhone, onChanged }) {
  const [value, setValue] = useState(initialPhone || '')
  const [savedValue, setSavedValue] = useState(initialPhone || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setValue(initialPhone || '')
    setSavedValue(initialPhone || '')
  }, [initialPhone])

  async function save() {
    const next = value.trim()
    if (next === savedValue.trim()) return
    setSaving(true)
    setError('')
    try {
      const sellerId = JSON.parse(localStorage.getItem('seller_user') || '{}')?.id
      const res = await fetch(`/api/team/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sellerId}` },
        body: JSON.stringify({ phone: next }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to save')
        setSaving(false)
        return
      }
      if (data.phoneSkipped) {
        setError('Phone number could not be saved. Please try again.')
      } else {
        setSavedValue(next)
        if (onChanged) onChanged()
      }
    } catch {
      setError('Failed to save')
    }
    setSaving(false)
  }

  return (
    <div className="flex items-center gap-1.5 mt-1">
      <Phone className="w-3 h-3 text-[#A8A8A4] shrink-0" />
      <input
        type="tel"
        value={value}
        onChange={e => setValue(e.target.value)}
        onBlur={save}
        onKeyDown={e => { if (e.key === 'Enter') { e.currentTarget.blur() } }}
        placeholder="Add phone number"
        className="flex-1 max-w-[200px] h-7 px-2 border border-[#E8E8E4] rounded text-[12px] text-[#1A1816] placeholder:text-[#A8A8A4] focus:outline-none focus:border-[#1A1816] transition-colors"
      />
      {saving && <span className="text-[11px] text-[#737370]">Saving…</span>}
      {error && <span className="text-[11px] text-[#D03839]">{error}</span>}
    </div>
  )
}

export default function TeamPage() {
  const router = useRouter()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [removing, setRemoving] = useState(null)
  const [resending, setResending] = useState(null)
  const [confirmRemove, setConfirmRemove] = useState(null)
  const [toast, setToast] = useState(null)
  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const [savingName, setSavingName] = useState(false)

  useEffect(() => { fetchTeam() }, [])

  async function saveTeamName() {
    const next = nameDraft.trim()
    if (!next) { showToast('Team name is required', 'error'); return }
    setSavingName(true)
    try {
      const res = await fetch('/api/team', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getSellerId()}` },
        body: JSON.stringify({ name: next }),
      })
      const result = await res.json().catch(() => ({}))
      if (!res.ok) {
        showToast(result.error || 'Failed to update team name', 'error')
      } else {
        setData(prev => prev ? { ...prev, org: prev.org ? { ...prev.org, name: next } : prev.org } : prev)
        setEditingName(false)
        showToast('Team name updated')
      }
    } catch {
      showToast('Failed to update team name', 'error')
    }
    setSavingName(false)
  }

  function showToast(text, kind = 'success') {
    setToast({ text, kind })
    setTimeout(() => setToast(null), 3000)
  }

  function getSellerId() {
    try { return JSON.parse(localStorage.getItem('seller_user') || '{}')?.id } catch { return null }
  }

  async function fetchTeam() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/team', { headers: { Authorization: `Bearer ${getSellerId()}` } })
      const json = await res.json()
      if (!res.ok) { setError(json.error || 'Failed to load your team'); setData(null) }
      else setData(json)
    } catch {
      setError('Failed to load your team. Please try again.')
    }
    setLoading(false)
  }

  async function removeMember(member) {
    setRemoving(member.id)
    const pending = member.status !== 'active'
    try {
      const res = await fetch(`/api/team/${member.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${getSellerId()}` } })
      const result = await res.json().catch(() => ({}))
      if (!res.ok) {
        showToast(result.error || 'Failed to remove member', 'error')
      } else {
        showToast(pending ? 'Invitation revoked' : 'Member removed')
        setConfirmRemove(null)
        await fetchTeam()
      }
    } catch {
      showToast('Failed to remove member', 'error')
    }
    setRemoving(null)
  }

  async function resendInvite(member) {
    setResending(member.id)
    try {
      const res = await fetch(`/api/team/${member.id}/resend`, { method: 'POST', headers: { Authorization: `Bearer ${getSellerId()}` } })
      const result = await res.json().catch(() => ({}))
      if (!res.ok) showToast(result.error || 'Failed to resend invite', 'error')
      else showToast('Invitation resent')
    } catch {
      showToast('Failed to resend invite', 'error')
    }
    setResending(null)
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

  if (error && !data) {
    return (
      <div className="p-4 lg:p-6">
        <div className="border border-[#F5C6C2] bg-[#FEF0EF] rounded p-8 text-center max-w-lg mx-auto">
          <div className="w-12 h-12 bg-[#D03839]/10 rounded flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-6 h-6 text-[#D03839]" />
          </div>
          <h3 className="text-[16px] font-bold text-[#1A1816] mb-2">Couldn&apos;t load your team</h3>
          <p className="text-[13px] text-[#737370] leading-relaxed mb-6">{error}</p>
          <button
            onClick={fetchTeam}
            className="inline-flex items-center gap-2 h-9 px-5 bg-[#D03839] hover:bg-[#E0493B] text-white text-[13px] font-semibold rounded"
          >
            <RefreshCw className="w-4 h-4" /> Try again
          </button>
        </div>
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

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-[24px] font-bold text-[#1A1816] mb-1">Team</h1>
          {org ? (
            isOwner ? (
              editingName ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    autoFocus
                    value={nameDraft}
                    onChange={e => setNameDraft(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') saveTeamName()
                      if (e.key === 'Escape') setEditingName(false)
                    }}
                    disabled={savingName}
                    className="h-8 px-2.5 border border-[#1A1816] rounded text-[14px] text-[#1A1816] focus:outline-none disabled:opacity-50 w-[240px]"
                  />
                  <button
                    onClick={saveTeamName}
                    disabled={savingName}
                    className="h-8 px-3 bg-[#D03839] hover:bg-[#E0493B] text-white text-[12px] font-semibold rounded disabled:opacity-50"
                  >
                    {savingName ? 'Saving…' : 'Save'}
                  </button>
                  <button
                    onClick={() => setEditingName(false)}
                    disabled={savingName}
                    className="h-8 px-3 border border-[#E8E8E4] text-[#444441] text-[12px] font-medium rounded hover:border-[#1A1816] disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 group">
                  <p className="text-[14px] text-[#737370]">{org.name}</p>
                  <button
                    onClick={() => { setNameDraft(org.name || ''); setEditingName(true) }}
                    className="p-1 rounded text-[#A8A8A4] hover:text-[#1A1816] hover:bg-[#FAFAF8] transition-colors"
                    title="Edit team name"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                </div>
              )
            ) : (
              <p className="text-[14px] text-[#737370]">{`You're a member of ${org.name}`}</p>
            )
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
                <span className="inline-flex items-center gap-1 px-2 h-5 rounded text-[11px] font-semibold bg-[#EBF3FC] text-[#4A90E2] border border-[#C5DDF8]">
                  <Shield className="w-2.5 h-2.5" /> Full Access
                </span>
              </div>
              <p className="text-[12px] text-[#737370] truncate">
                {isOwner ? seller?.email : (org.owner?.email || '')}
              </p>
            </div>
          </div>
        )}

        {/* Members */}
        {members?.map(m => {
          const perms = m.permissions && Object.keys(m.permissions).length > 0
            ? m.permissions
            : derivePermissionsFromRole(m.role)
          const count = getPermissionCount(perms)
          return (
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
                  <span className="inline-flex items-center gap-1 px-2 h-5 rounded text-[11px] font-semibold bg-[#F3F3F0] text-[#737370] border border-[#E8E8E4]">
                    {count >= TOTAL_PERMISSIONS ? 'Full Access' : `${count}/${TOTAL_PERMISSIONS} access`}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-[12px] text-[#737370]">
                  <span className="truncate">{m.email}</span>
                  <span className="shrink-0">Invited {fmtDate(m.invited_at)}</span>
                </div>
                {isOwner && (
                  <MemberPhoneField
                    memberId={m.id}
                    initialPhone={m.phone || ''}
                    onChanged={fetchTeam}
                  />
                )}
              </div>
              {isOwner && (
                <div className="flex items-center gap-2 shrink-0">
                  <PermissionsPopup
                    memberId={m.id}
                    currentPermissions={perms}
                    memberRole={m.role}
                    onChanged={fetchTeam}
                    onToast={showToast}
                  />
                  {m.status !== 'active' && (
                    <button
                      onClick={() => resendInvite(m)}
                      disabled={resending === m.id}
                      className="flex items-center gap-1.5 h-7 px-2.5 border border-[#E8E8E4] rounded text-[12px] font-medium text-[#444441] hover:border-[#1A1816] disabled:opacity-50 transition-colors"
                      title="Resend invitation email"
                    >
                      <RefreshCw className={`w-3 h-3 ${resending === m.id ? 'animate-spin' : ''}`} />
                      {resending === m.id ? 'Sending…' : 'Resend'}
                    </button>
                  )}
                  <button
                    onClick={() => setConfirmRemove(m)}
                    disabled={removing === m.id}
                    className="p-2 rounded hover:bg-[#FEF0EF] text-[#737370] hover:text-[#D03839] disabled:opacity-50 transition-colors"
                    title={m.status === 'active' ? 'Remove member' : 'Revoke invitation'}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          )
        })}

        {(!members || members.length === 0) && isOwner && (
          <div className="border border-dashed border-[#E8E8E4] rounded p-8 text-center">
            <Mail className="w-5 h-5 text-[#A8A8A4] mx-auto mb-2" />
            <p className="text-[13px] text-[#737370]">No team members yet. Invite someone to get started.</p>
          </div>
        )}
      </div>

      {/* Remove / revoke confirmation */}
      {confirmRemove && (
        <div className="fixed inset-0 z-[100] bg-black/40 flex items-center justify-center p-4" onClick={() => removing ? null : setConfirmRemove(null)}>
          <div className="bg-white rounded w-full max-w-sm shadow-xl p-5" onClick={e => e.stopPropagation()}>
            <h3 className="text-[16px] font-bold text-[#1A1816] mb-1">
              {confirmRemove.status === 'active' ? 'Remove this member?' : 'Revoke this invitation?'}
            </h3>
            <p className="text-[13px] text-[#737370] mb-4">
              {confirmRemove.status === 'active'
                ? <>This will revoke <span className="font-semibold text-[#1A1816]">{confirmRemove.name || confirmRemove.email}</span>&apos;s access to your team and workspace. They can be re-invited later.</>
                : <>The invitation link sent to <span className="font-semibold text-[#1A1816]">{confirmRemove.email}</span> will stop working. You can invite them again anytime.</>}
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmRemove(null)}
                disabled={removing === confirmRemove.id}
                className="h-9 px-4 border border-[#E8E8E4] text-[#444441] text-[13px] font-semibold rounded hover:bg-[#FAFAF8] disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => removeMember(confirmRemove)}
                disabled={removing === confirmRemove.id}
                className="h-9 px-4 bg-[#D03839] hover:bg-[#E0493B] text-white text-[13px] font-semibold rounded disabled:opacity-50 transition-colors"
              >
                {removing === confirmRemove.id ? 'Removing…' : (confirmRemove.status === 'active' ? 'Remove' : 'Revoke')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] px-4 py-2.5 rounded shadow-lg text-[13px] font-medium text-white flex items-center gap-2"
          style={{ background: toast.kind === 'error' ? '#D03839' : '#1A1816' }}>
          {toast.kind === 'error' ? <X className="w-4 h-4" /> : <Check className="w-4 h-4" />}
          {toast.text}
        </div>
      )}
    </div>
  )
}
