/* Dev-only visual QA page for the UI kit. Open /src/ui/__kit/index.html on the dev server. Not part of the app build. */
import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import '@/index.css'
import { BadgeCheck, CreditCard, Globe, IdCard, Inbox, Nfc, ScanFace, Smartphone, Video } from 'lucide-react'
import {
  Avatar, Badge, Button, Callout, Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle, CheckRow,
  ChipReadAnimation, ConfettiBurst, CountUp, Dialog, DialogClose, EmptyState, ErrorState, FaceScanAnimation, Field,
  Footer, Input, Kbd, LangToggle, LiveDot, LoadingState, Logo, PageHeader, PhoneFrame, PolicyBadge, RadioCards,
  RiskBadge, RouteBadge, ScoreBar, Select, SimulatedBadge, Skeleton, Spinner, StatusPill, Stepper, Switch, Textarea,
  Toaster, toast, CheckTick, Stagger, StaggerItem,
} from '@/ui'
import type { CheckOutcome } from '@/contract/types'

const q = new URLSearchParams(location.search)
const FINAL = q.get('final') === '1'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="text-xs font-bold tracking-[0.08em] text-muted uppercase">{title}</h2>
      {children}
    </section>
  )
}

function CitizenMock() {
  const [route, setRoute] = useState('B')
  return (
    <div className="space-y-5 px-5 pt-3 pb-10">
      <div className="flex items-center justify-between"><Logo size="sm" /><LangToggle /></div>
      <Stepper current={1} steps={[{ label: 'Questions' }, { label: 'Verify' }, { label: 'Status' }]} />
      <PageHeader eyebrow="Step 2 of 3" title="Which route is yours?" description="Based on your answers we recommend route B. You can pick another." />
      <RadioCards
        label="Route" value={route} onValueChange={setRoute}
        options={[
          { value: 'A', label: 'EU digital ID (eIDAS)', description: 'Log in with your own national eID.', icon: <Globe /> },
          { value: 'B', label: 'Passport chip + face check', description: 'Your phone reads the chip and checks your face.', icon: <Nfc />, badge: <Badge tone="success" icon={<BadgeCheck />}>Recommended</Badge> },
          { value: 'F', label: 'Video call with an officer', description: 'For red-card and NIE paper holders.', icon: <Video />, badge: <PolicyBadge /> },
        ]}
      />
      <Button size="lg" block>Continue</Button>
    </div>
  )
}

function Kit() {
  const [outcomes, setOutcomes] = useState<CheckOutcome[]>(FINAL ? ['pass', 'pass', 'warn', 'fail', 'skipped'] : ['pending', 'pending', 'pending', 'pending', 'pending'])
  const [chip, setChip] = useState<'idle' | 'reading' | 'done' | 'failed'>(FINAL ? 'done' : 'reading')
  const [face, setFace] = useState<'idle' | 'scanning' | 'done' | 'failed'>(FINAL ? 'done' : 'scanning')
  const [dlg, setDlg] = useState(q.get('dialog') === '1')
  const [confetti, setConfetti] = useState(0)
  const [sw, setSw] = useState(true)
  const [sel, setSel] = useState('PASSPORT')
  useEffect(() => {
    if (FINAL) return
    const final: CheckOutcome[] = ['pass', 'pass', 'warn', 'fail', 'skipped']
    const ts = final.map((o, i) => setTimeout(() => setOutcomes(p => p.map((x, j) => (j === i ? o : x))), 700 + i * 500))
    return () => ts.forEach(clearTimeout)
  }, [])

  return (
    <div className="min-h-dvh">
      <Toaster />
      <div className="mx-auto max-w-[1200px] space-y-12 px-4 py-8 sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Logo size="lg" />
          <div className="flex items-center gap-3"><LiveDot /><LangToggle /></div>
        </div>
        <PageHeader eyebrow="Design system" title="Get your Cl@ve — UI kit" description="Calm, trustworthy civic tech. One accent, one tone reserved for simulated things." actions={<><Button variant="secondary">Secondary</Button><Button>Primary</Button></>} />

        <Section title="Buttons">
          <div className="flex flex-wrap items-center gap-3">
            <Button>Primary</Button><Button variant="secondary">Secondary</Button><Button variant="soft">Soft</Button>
            <Button variant="ghost">Ghost</Button><Button variant="danger">Refuse</Button><Button loading>Saving</Button>
            <Button size="sm">Small</Button><Button size="lg" icon={<Smartphone className="size-5" />}>Start on my phone</Button>
            <Button disabled>Disabled</Button>
          </div>
        </Section>

        <Section title="Badges & pills">
          <div className="flex flex-wrap items-center gap-2">
            <Badge>Neutral</Badge><Badge tone="info">Info</Badge><Badge tone="success">Success</Badge><Badge tone="warning">Warning</Badge><Badge tone="danger">Danger</Badge>
            <SimulatedBadge /><PolicyBadge />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {(['draft', 'received', 'checking', 'need_info', 'approved', 'not_approved'] as const).map(s => <StatusPill key={s} status={s} />)}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <RiskBadge risk="low" /><RiskBadge risk="medium" /><RiskBadge risk="high" />
            <RouteBadge route="A" /><RouteBadge route="B" /><RouteBadge route="C" /><RouteBadge route="FALLBACK" /><RouteBadge route="B" compact />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {[['GF', 12], ['DM', 150], ['RM', 32], ['NB', 210], ['YH', 280], ['IP', 0], ['HK', 330], ['LW', 190]].map(([i, h]) => <Avatar key={i} initials={i as string} hue={h as number} size={44} />)}
            <Spinner /><Kbd>⌘</Kbd><Kbd>K</Kbd><LiveDot tone="brand" label="Synced" />
          </div>
        </Section>

        <div className="grid gap-6 lg:grid-cols-2">
          <Section title="Card + checks">
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3"><Avatar initials="GF" hue={12} size={44} /><div><CardTitle>Giulia Ferraro</CardTitle><CardDescription>Italian master's student in Madrid</CardDescription></div></div>
                  <RiskBadge risk="medium" />
                </div>
              </CardHeader>
              <CardContent className="space-y-1.5">
                <CheckRow label="Chip read (NFC)" outcome={outcomes[0]} detail="Chip read in 2.1 s" trailing={<SimulatedBadge />} />
                <CheckRow label="Liveness" outcome={outcomes[1]} detail="Natural micro-movement and depth" score={0.98} threshold={0.85} />
                <CheckRow label="Face match" outcome={outcomes[2]} detail="Below threshold: new glasses" score={0.86} threshold={0.9} />
                <CheckRow label="Chip signature" outcome={outcomes[3]} detail="Not issued by a trusted authority" />
                <CheckRow label="Residence record" outcome={outcomes[4]} />
              </CardContent>
              <CardFooter className="justify-end"><Button variant="secondary" size="sm">Request info</Button><Button size="sm">Approve</Button></CardFooter>
            </Card>
          </Section>
          <Section title="Status tracker (vertical stepper)">
            <Card className="p-5">
              <Stepper orientation="vertical" current={1} steps={[
                { label: 'Received', description: 'We have your application.' },
                { label: 'Checking', description: 'We are checking your document, your face and your residence record.' },
                { label: 'We need something from you' },
                { label: 'Approved' },
              ]} />
            </Card>
            <Card className="p-5"><Stepper current={2} steps={[{ label: 'Received' }, { label: 'Checking' }, { label: 'Need info', state: 'warning' }, { label: 'Approved' }]} /></Card>
            <Card className="space-y-3 p-5">
              <ScoreBar label="Liveness" value={0.42} threshold={0.85} />
              <div className="flex items-center gap-3"><CheckTick size={32} /><span className="font-display text-3xl font-semibold"><CountUp value={21558192} /></span><SimulatedBadge /></div>
            </Card>
          </Section>
        </div>

        <Section title="Chip read & face scan">
          <div className="flex flex-wrap gap-2">
            {(['idle', 'reading', 'done', 'failed'] as const).map(s => <Button key={s} size="sm" variant={chip === s ? 'primary' : 'secondary'} onClick={() => setChip(s)}>chip: {s}</Button>)}
            {(['idle', 'scanning', 'done', 'failed'] as const).map(s => <Button key={s} size="sm" variant={face === s ? 'primary' : 'secondary'} onClick={() => setFace(s)}>face: {s}</Button>)}
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            <Card className="p-6"><ChipReadAnimation state={chip} /></Card>
            <Card className="p-6"><FaceScanAnimation state={face} liveness={face === 'failed' ? 0.41 : 0.98} faceMatch={face === 'failed' ? 0.62 : 0.96} hue={12} /></Card>
          </div>
        </Section>

        <Section title="Forms">
          <Card className="grid gap-5 p-5 md:grid-cols-2">
            <Field label="Document" htmlFor="doc"><Select id="doc" label="Document" value={sel} onValueChange={setSel} options={[{ value: 'PASSPORT', label: 'Passport' }, { value: 'TIE', label: 'TIE' }, { value: 'RED_CARD', label: 'Red card' }]} /></Field>
            <Field label="Your answer" htmlFor="ans" hint="The officer will see this."><Input id="ans" placeholder="Calle Alcalá 12" /></Field>
            <Field label="Reason note" htmlFor="note" error="A reason is required"><Textarea id="note" aria-invalid="true" /></Field>
            <div className="space-y-4"><Switch checked={sw} onCheckedChange={setSw} label="Show dashboard" />
              <div className="flex gap-2"><Button variant="secondary" onClick={() => setDlg(true)}>Open dialog</Button><Button variant="secondary" onClick={() => toast.success('Approved', { description: 'Basic level granted to Giulia' })}>Toast</Button></div>
            </div>
          </Card>
        </Section>

        <Section title="Callouts">
          <div className="grid gap-3 md:grid-cols-2">
            <Callout title="Key rule">The platform can approve automatically; only an officer can refuse or revoke.</Callout>
            <Callout tone="sim" title="Simulated">Nothing in this prototype checks a real document.</Callout>
            <Callout tone="warning" title="Policy proposal">Red-card holders are included as a proposed rule change.</Callout>
            <Callout tone="danger" title="Not approved">Your face did not match the chip photo.</Callout>
          </div>
        </Section>

        <Section title="Empty / loading / error">
          <div className="grid gap-4 md:grid-cols-3">
            <Card><EmptyState title="Queue is clear" body="New cases appear here the moment a citizen submits." icon={<Inbox />} action={<Button size="sm" variant="secondary">Refresh</Button>} /></Card>
            <Card className="p-4"><LoadingState rows={3} /></Card>
            <Card><ErrorState body="We could not load the audit trail." onRetry={() => {}} /></Card>
          </div>
          <div className="flex gap-3"><Skeleton className="h-10 w-40" /><LoadingState className="py-0" /></div>
        </Section>

        <Section title="Phone frame (citizen)">
          <div className="relative flex flex-wrap items-start gap-10">
            <PhoneFrame><CitizenMock /></PhoneFrame>
            <PhoneFrame>
              <Stagger className="space-y-4 px-5 pt-6 pb-10" gap={0.08}>
                <StaggerItem><div className="relative grid place-items-center pt-6"><CheckTick size={72} /><ConfettiBurst fire={confetti} /></div></StaggerItem>
                <StaggerItem><h1 className="text-center font-display text-[30px] leading-tight font-semibold">You have Cl@ve</h1></StaggerItem>
                <StaggerItem><p className="text-center text-muted">Basic level granted. The advanced level is being reviewed by a person.</p></StaggerItem>
                <StaggerItem><Card className="space-y-2 p-4"><div className="flex items-center justify-between"><span className="font-semibold">Basic level</span><StatusPill status="approved" /></div><div className="flex items-center justify-between"><span className="font-semibold">Advanced level</span><Badge tone="info" icon={<IdCard />}>In review</Badge></div></Card></StaggerItem>
                <StaggerItem><Button block size="lg" onClick={() => setConfetti(c => c + 1)} icon={<CreditCard className="size-5" />}>Celebrate</Button></StaggerItem>
                <StaggerItem><div className="flex justify-center"><SimulatedBadge /></div></StaggerItem>
              </Stagger>
            </PhoneFrame>
            <Card className="w-[300px] p-5"><FaceScanAnimation state="idle" hue={150} showSimulated /><div className="mt-4 flex justify-center"><Button icon={<ScanFace className="size-5" />}>Start face check</Button></div></Card>
          </div>
        </Section>
      </div>
      <Dialog
        open={dlg} onOpenChange={setDlg} title="Refuse this application?" tone="danger"
        description="Pick the reason the citizen will see. They can appeal."
        footer={<><DialogClose asChild><Button variant="secondary">Cancel</Button></DialogClose><Button variant="danger">Refuse with reason</Button></>}
      >
        <RadioCards label="Reason" value="face" onValueChange={() => {}} options={[{ value: 'face', label: 'Face does not match', description: 'Liveness or face match below threshold' }, { value: 'chip', label: 'Chip invalid' }]} />
      </Dialog>
      <Footer />
    </div>
  )
}

createRoot(document.getElementById('root')!).render(<StrictMode><Kit /></StrictMode>)
