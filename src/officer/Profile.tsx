/* Staff console · My profile: job details, the certificate used, "Update details". */
import { useMemo, useState } from 'react'
import { BadgeCheck, Building2, KeyRound, LogIn, PencilLine, ShieldX, UserPlus } from 'lucide-react'
import { OFFICERS, REGISTRATION_AUTHORITIES, STAFF_CERTIFICATES, STAFF_OFFICES } from '@/contract/seed'
import { useClave } from '@/core/store'
import { accountOfOfficer, isCertificateExpired } from '@/core/staff'
import { relativeTime } from '@/core/selectors'
import { Avatar, cn } from '@/ui'
import { toast } from 'sonner'
import { AUDIT_ACTION_LABEL, S } from './copy'
import { formatDateTime, useLang, useTr } from './lib'
import { Btn, Panel } from './components/ui'
import { postLabel, ProfileForm, SourceFacts, type IdentitySource } from './ProfileForm'
import { TOASTER_ID } from './live'

export function ProfilePage() {
  const tr = useTr()
  const lang = useLang()
  const officerId = useClave(s => s.officerId)
  const profile = useClave(s => (officerId ? s.officerProfiles?.[officerId] : undefined))
  const audit = useClave(s => s.audit)
  const [editing, setEditing] = useState(false)
  const officer = OFFICERS.find(o => o.id === officerId)
  const cert = STAFF_CERTIFICATES.find(c => c.id === profile?.certificateId)
    ?? STAFF_CERTIFICATES.find(c => c.officerId === officerId && c.authorisedForClave && !isCertificateExpired(c))
  const account = officerId ? accountOfOfficer(officerId) : undefined
  const source: IdentitySource | undefined = profile?.signInMethod === 'password' && account
    ? { method: 'password', account }
    : cert ? { method: 'certificate', cert } : account ? { method: 'password', account } : undefined
  const history = useMemo(
    () => audit.filter(e => e.actor.id === officerId && e.action.startsWith('staff_')).slice(-5).reverse(),
    [audit, officerId],
  )
  if (!officer || !officerId) return null

  const authority = REGISTRATION_AUTHORITIES.find(a => a.id === profile?.authorityId)
  const office = STAFF_OFFICES.find(o => o.code === profile?.officeCode)
  const rows: Array<[string, React.ReactNode]> = profile ? [
    [tr(S.organisation), authority ? tr(authority.name) : '—'],
    [tr(S.office), office ? <>{tr(office.name)} <span className="ml-1 rounded-md bg-surface-2 px-1.5 py-0.5 font-mono text-[12px] text-ink">{office.code}</span></> : profile.officeCode],
    [tr(S.post), postLabel(profile.post, lang)],
    [tr(S.nrp), <span className="font-mono">{profile.personnelNumber}</span>],
    [tr(S.role), tr(profile.role === 'supervisor' ? S.supervisor : S.registrar)],
    [tr(S.signInMethod), tr(S.methodLabel[profile.signInMethod ?? 'certificate'])],
    [tr(S.confirmedOn), formatDateTime(profile.completedAt, lang)],
  ] : []

  return (
    <div className="mx-auto max-w-[1200px] px-6 py-6 xl:px-8" data-testid="staff-profile">
      <div className="flex flex-wrap items-center gap-4">
        <Avatar initials={officer.name.split(' ').map(p => p[0]).join('').slice(0, 2)} hue={226} size={56} />
        <div className="min-w-0">
          <h1 className="font-display text-[28px] font-bold text-ink">{tr(S.profileTitlePage)}</h1>
          <p className="text-sm text-muted">{officer.name} · <span>{tr(officer.office)}</span>{profile && <> · {postLabel(profile.post, lang)}</>}</p>
        </div>
        {!editing && source && (
          <Btn variant={profile ? 'secondary' : 'primary'} className="ml-auto" onClick={() => setEditing(true)}>
            {profile ? <PencilLine className="size-4" aria-hidden /> : <UserPlus className="size-4" aria-hidden />}
            {profile ? tr(S.updateDetails) : tr(S.addDetails)}
          </Btn>
        )}
      </div>
      <p className="mt-2 max-w-2xl text-sm text-muted">{tr(S.profileSubtitle)}</p>

      {editing && source ? (
        <div className="mt-6 rounded-[4px] border border-line bg-surface p-6">
          <ProfileForm
            officerId={officerId}
            source={source}
            existing={profile}
            mode="update"
            onDone={() => { setEditing(false); toast.success(tr(S.saved), { toasterId: TOASTER_ID }) }}
            onCancel={() => setEditing(false)}
          />
        </div>
      ) : (
        <div className="mt-6 grid items-start gap-4 lg:grid-cols-[1fr_380px]">
          <Panel id="job" title={tr(S.jobDetails)} icon={<Building2 className="size-4" />}>
            {profile ? (
              <dl className="grid grid-cols-[minmax(9rem,auto)_1fr] gap-x-6 gap-y-3 text-sm" data-testid="profile-details">
                {rows.map(([k, v]) => (
                  <div key={k} className="contents">
                    <dt className="text-muted">{k}</dt>
                    <dd className="font-medium text-ink">{v}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <div className="rounded-[4px] border border-dashed border-line p-5">
                <p className="font-semibold text-ink">{tr(S.noProfile)}</p>
                <p className="mt-1 text-sm text-muted">{tr(S.noProfileBody)}</p>
              </div>
            )}
            <p className="mt-5 rounded-[4px] border-l-4 border-brand bg-brand-soft/60 px-3.5 py-2.5 text-[13px] leading-relaxed text-ink"><b>{tr(S.whyAsk)}:</b> {tr(S.whyAskBody)}</p>
          </Panel>
          <div className="grid content-start gap-4">
            <Panel id="cert" title={tr(source?.method === 'password' ? S.accountUsed : S.certUsed)} icon={<KeyRound className="size-4" />}>
              {source ? <SourceFacts source={source} compact /> : <p className="text-sm text-muted">—</p>}
              <p className="mt-3 flex items-center gap-1.5 text-[12.5px] font-medium text-success"><BadgeCheck className="size-3.5" aria-hidden />{tr(S.authorised)}</p>
            </Panel>
            <Panel id="history" title={tr(S.signInHistory)} icon={<LogIn className="size-4" />}>
              {history.length === 0 ? <p className="text-sm text-muted">—</p> : (
                <ul className="grid gap-2">
                  {history.map(e => (
                    <li key={e.id} className="flex items-center gap-2 text-sm">
                      {e.action === 'staff_access_denied' ? <ShieldX className="size-4 text-danger" aria-hidden /> : <BadgeCheck className="size-4 text-success" aria-hidden />}
                      <span className={cn('flex-1', e.action === 'staff_access_denied' ? 'text-danger' : 'text-ink')}>{tr(AUDIT_ACTION_LABEL[e.action])}</span>
                      <time dateTime={e.at} className="text-[12px] text-muted tabular-nums">{relativeTime(e.at, lang)}</time>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
            <p className="px-1 text-[12px] text-muted">{tr(S.noRealData)}</p>
          </div>
        </div>
      )}
    </div>
  )
}
