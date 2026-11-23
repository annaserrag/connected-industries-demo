import { useEffect, useMemo, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Text,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { ROUTES, ROUTE_ORDER, SIMULATED_DASHBOARD as D } from '@/contract/seed'
import { COPY } from './copy'
import { ChartCard, LegendItem } from './components/parts'
import { useChartColors, useFmt, useTr, type ChartColors } from './components/hooks'

const INITIAL = { width: 320, height: 240 }
const launchWeek = D.weeks[D.launchWeekIndex]
const preLaunchLast = D.weeks[D.launchWeekIndex - 1]

/* ------------------------------------------------------------- tooltip */

type TipRow = { name: string; value: string; color: string; dashed?: boolean }
function TipBox({ title, rows }: { title: string; rows: TipRow[] }) {
  return (
    <div className="rounded-[2px] border border-line bg-surface px-3 py-2 text-sm shadow-lg">
      <p className="mb-1 font-bold text-ink">{title}</p>
      {rows.map(r => (
        <p key={r.name} className="flex items-center gap-2 text-ink">
          <span aria-hidden="true" className="inline-block h-0.5 w-3 rounded" style={{ background: r.color }} />
          <span className="text-muted">{r.name}</span>
          <span className="ml-auto pl-3 font-bold tabular-nums">{r.value}</span>
        </p>
      ))}
    </div>
  )
}

function axisProps(c: ChartColors) {
  return {
    tick: { fill: c.muted, fontSize: 12 },
    tickLine: false,
    axisLine: { stroke: c.line },
  } as const
}

function LaunchMarkers({ c, label }: { c: ChartColors; label: string }) {
  return (
    <>
      <ReferenceArea x1={D.weeks[0]} x2={preLaunchLast} fill={c.line} fillOpacity={0.35} ifOverflow="extendDomain" />
      <ReferenceLine
        x={launchWeek}
        stroke={c.ink}
        strokeDasharray="3 3"
        strokeWidth={1.5}
        label={({ viewBox }: { viewBox?: { x?: number; y?: number } }) => (
          <text x={(viewBox?.x ?? 0) + 6} y={(viewBox?.y ?? 0) + 12} fill={c.ink} fontSize={12} fontWeight={600}>
            {label}
          </text>
        )}
      />
    </>
  )
}

/* ------------------------------------------- (1) time to advanced level */

export function TimeToAdvancedChart() {
  const tr = useTr()
  const f = useFmt()
  const c = useChartColors()
  const reduce = useReducedMotion()
  const h = tr(COPY.hoursShort)
  const data = useMemo(
    () => D.weeks.map((w, i) => ({ week: w, foreigners: D.hoursToAdvanced.foreigners[i], spaniards: D.hoursToAdvanced.spaniards[i] })),
    [],
  )
  const fName = tr(COPY.kpiTimeForeigners)
  const sName = tr(COPY.kpiTimeSpaniards)
  const last = data.length - 1
  const pre = D.launchWeekIndex - 1

  return (
    <ChartCard
      className="lg:col-span-2"
      height={300}
      title={tr(COPY.timeChartTitle)}
      takeaway={tr(COPY.timeChartTakeaway)}
      summary={`${tr(COPY.timeChartTitle)}. ${fName}: ${f.num(data[pre].foreigners)} ${h} (${preLaunchLast}) → ${f.num(data[last].foreigners)} ${h} (${data[last].week}). ${sName}: ${f.num(data[pre].spaniards)} ${h} → ${f.num(data[last].spaniards)} ${h}.`}
      legend={
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          <LegendItem color={c.brand} label={fName} dashed={false} />
          <LegendItem color={c.muted} label={sName} dashed />
          <span className="text-xs text-muted">{tr(COPY.timeChartUnit)}</span>
        </div>
      }
      table={{
        caption: tr(COPY.timeChartUnit),
        columns: [tr(COPY.week), fName, sName],
        rows: data.map(d => [d.week, `${f.num(d.foreigners)} ${h}`, `${f.num(d.spaniards)} ${h}`]),
      }}
    >
      <ResponsiveContainer width="100%" height="100%" initialDimension={INITIAL}>
        <LineChart data={data} margin={{ top: 22, right: 48, bottom: 0, left: -8 }}>
          <CartesianGrid vertical={false} stroke={c.line} />
          <LaunchMarkers c={c} label={tr(COPY.launch)} />
          <XAxis dataKey="week" {...axisProps(c)} />
          <YAxis {...axisProps(c)} axisLine={false} width={48} tickFormatter={v => `${f.num(v)}`} />
          <Tooltip
            cursor={{ stroke: c.muted, strokeWidth: 1 }}
            content={({ active, payload, label }) =>
              active && payload?.length ? (
                <TipBox
                  title={`${tr(COPY.week)} ${String(label).replace('W', '')}`}
                  rows={[
                    { name: fName, value: `${f.num(Number(payload.find(p => p.dataKey === 'foreigners')?.value))} ${h}`, color: c.brand },
                    { name: sName, value: `${f.num(Number(payload.find(p => p.dataKey === 'spaniards')?.value))} ${h}`, color: c.muted },
                  ]}
                />
              ) : null
            }
          />
          <Line
            type="monotone"
            dataKey="spaniards"
            name={sName}
            stroke={c.muted}
            strokeWidth={2}
            strokeDasharray="5 4"
            dot={false}
            activeDot={{ r: 5, stroke: c.surface, strokeWidth: 2 }}
            isAnimationActive={!reduce}
          >
            <LabelList
              dataKey="spaniards"
              content={({ x, y, index, value }) =>
                index === last ? (
                  <text x={Number(x) + 10} y={Number(y) + 4} fill={c.muted} fontSize={12} fontWeight={600}>{`${f.num(Number(value))} ${h}`}</text>
                ) : null
              }
            />
          </Line>
          <Line
            type="monotone"
            dataKey="foreigners"
            name={fName}
            stroke={c.brand}
            strokeWidth={2.5}
            dot={{ r: 3.5, fill: c.brand, stroke: c.surface, strokeWidth: 1.5 }}
            activeDot={{ r: 6, stroke: c.surface, strokeWidth: 2 }}
            isAnimationActive={!reduce}
          >
            <LabelList
              dataKey="foreigners"
              content={({ x, y, index, value }) =>
                index === last || index === pre ? (
                  <text
                    x={Number(x) + (index === last ? 10 : -8)}
                    y={Number(y) + (index === last ? -9 : -12)}
                    textAnchor={index === last ? 'start' : 'end'}
                    fill={c.brand}
                    fontSize={12}
                    fontWeight={700}
                  >{`${f.num(Number(value))} ${h}`}</text>
                ) : null
              }
            />
          </Line>
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}

/* ------------------------------------------- (2) share needing an office */

export function OfficeShareChart() {
  const tr = useTr()
  const f = useFmt()
  const c = useChartColors()
  const reduce = useReducedMotion()
  const data = useMemo(() => D.weeks.map((w, i) => ({ week: w, pct: D.shareNeedingOfficePct[i] })), [])
  const last = data.length - 1
  const pre = D.launchWeekIndex - 1
  return (
    <ChartCard
      title={tr(COPY.officeChartTitle)}
      takeaway={tr(COPY.officeChartTakeaway)}
      summary={`${tr(COPY.officeChartTitle)}: ${f.pct(data[pre].pct)} (${preLaunchLast}) → ${f.pct(data[last].pct)} (${data[last].week}).`}
      table={{
        caption: tr(COPY.officeChartUnit),
        columns: [tr(COPY.week), tr(COPY.share)],
        rows: data.map(d => [d.week, f.pct(d.pct)]),
      }}
    >
      <ResponsiveContainer width="100%" height="100%" initialDimension={INITIAL}>
        <AreaChart data={data} margin={{ top: 22, right: 30, bottom: 0, left: -8 }}>
          <defs>
            <linearGradient id="dash-office-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={c.brand} stopOpacity={0.28} />
              <stop offset="100%" stopColor={c.brand} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke={c.line} />
          <LaunchMarkers c={c} label={tr(COPY.launch)} />
          <XAxis dataKey="week" {...axisProps(c)} interval="preserveStartEnd" />
          <YAxis {...axisProps(c)} axisLine={false} width={44} domain={[0, 80]} ticks={[0, 20, 40, 60, 80]} tickFormatter={v => `${v}%`} />
          <Tooltip
            cursor={{ stroke: c.muted, strokeWidth: 1 }}
            content={({ active, payload, label }) =>
              active && payload?.length ? (
                <TipBox title={`${tr(COPY.week)} ${String(label).replace('W', '')}`} rows={[{ name: tr(COPY.share), value: f.pct(Number(payload[0].value)), color: c.brand }]} />
              ) : null
            }
          />
          <Area
            type="monotone"
            dataKey="pct"
            stroke={c.brand}
            strokeWidth={2.5}
            fill="url(#dash-office-fill)"
            dot={false}
            activeDot={{ r: 6, stroke: c.surface, strokeWidth: 2 }}
            isAnimationActive={!reduce}
          >
            <LabelList
              dataKey="pct"
              content={({ x, y, index, value }) =>
                index === last || index === pre ? (
                  <text x={Number(x)} y={Number(y) - 10} textAnchor={index === last ? 'end' : 'middle'} fill={c.ink} fontSize={12} fontWeight={700}>
                    {f.pct(Number(value))}
                  </text>
                ) : null
              }
            />
          </Area>
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}

/* ------------------------------------------- (3) corrected rejections */

export function CorrectedChart() {
  const tr = useTr()
  const f = useFmt()
  const c = useChartColors()
  const reduce = useReducedMotion()
  const { total, correctedAndApproved } = D.rejections
  const notCorrected = total - correctedAndApproved
  const pct = (correctedAndApproved / total) * 100
  const data = [{ name: 'r', corrected: correctedAndApproved, rest: notCorrected }]
  return (
    <ChartCard
      height={84}
      title={tr(COPY.correctedChartTitle)}
      takeaway={tr(COPY.correctedChartTakeaway)}
      summary={`${tr(COPY.corrected)}: ${f.num(correctedAndApproved)} (${f.pct1(pct)}). ${tr(COPY.notCorrected)}: ${f.num(notCorrected)}. Total: ${f.num(total)}.`}
      legend={
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-4xl font-bold tracking-tight text-ink tabular-nums">{f.pct1(pct)}</p>
            <p className="text-sm text-muted">
              {f.num(correctedAndApproved)} {tr(COPY.kpiCorrectedOf)} {f.num(total)} {tr(COPY.kpiCorrectedRejections)}
            </p>
          </div>
          <div className="flex flex-col gap-1.5">
            <LegendItem color={c.brand} label={`${tr(COPY.corrected)} · ${f.num(correctedAndApproved)}`} />
            <LegendItem color={c.muted} hatch label={`${tr(COPY.notCorrected)} · ${f.num(notCorrected)}`} />
          </div>
        </div>
      }
      table={{
        caption: tr(COPY.correctedChartTitle),
        columns: [tr(COPY.outcome), tr(COPY.count), tr(COPY.share)],
        rows: [
          [tr(COPY.corrected), f.num(correctedAndApproved), f.pct1(pct)],
          [tr(COPY.notCorrected), f.num(notCorrected), f.pct1(100 - pct)],
          [tr(COPY.total), f.num(total), '100%'],
        ],
      }}
    >
      <ResponsiveContainer width="100%" height="100%" initialDimension={INITIAL}>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 4, bottom: 4, left: 4 }} barSize={44}>
          <defs>
            <pattern id="dash-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="6" height="6" fill={c.surface} />
              <line x1="0" y1="0" x2="0" y2="6" stroke={c.muted} strokeWidth="2.5" strokeOpacity={0.55} />
            </pattern>
          </defs>
          <XAxis type="number" hide domain={[0, total]} />
          <YAxis type="category" dataKey="name" hide />
          <Bar dataKey="corrected" stackId="a" fill={c.brand} radius={[6, 0, 0, 6]} stroke={c.surface} strokeWidth={2} isAnimationActive={!reduce}>
            <LabelList dataKey="corrected" position="insideLeft" fill="#fff" fontSize={13} fontWeight={700} formatter={(v: unknown) => f.num(Number(v))} />
          </Bar>
          <Bar dataKey="rest" stackId="a" fill="url(#dash-hatch)" radius={[0, 6, 6, 0]} stroke={c.muted} strokeOpacity={0.5} isAnimationActive={!reduce}>
            <LabelList
              dataKey="rest"
              content={({ x, y, width, height, value }) => (
                <g>
                  <rect x={Number(x) + Number(width) - 58} y={Number(y) + Number(height) / 2 - 11} width={50} height={22} rx={5} fill={c.surface} />
                  <text x={Number(x) + Number(width) - 33} y={Number(y) + Number(height) / 2 + 4.5} textAnchor="middle" fill={c.ink} fontSize={13} fontWeight={700}>
                    {f.num(Number(value))}
                  </text>
                </g>
              )}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}

/* ------------------------------------------- horizontal bars (4) and (5) */

type HRow = { key: string; label: string; value: number; display: string }

function HBars({ rows, color, max }: { rows: HRow[]; color: string; max: number }) {
  const c = useChartColors()
  const reduce = useReducedMotion()
  const ref = useRef<HTMLDivElement>(null)
  const [w, setW] = useState(320)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const RIGHT = 56
  return (
    <div ref={ref} className="size-full">
      <ResponsiveContainer width="100%" height="100%" initialDimension={INITIAL}>
        <BarChart data={rows} layout="vertical" margin={{ top: 30, right: RIGHT, bottom: 0, left: 0 }} barSize={12}>
          <XAxis type="number" hide domain={[0, max]} />
          <YAxis type="category" dataKey="key" hide />
          <Tooltip
            cursor={{ fill: c.line, fillOpacity: 0.35 }}
            content={({ active, payload }) => {
              const p = payload?.[0]?.payload as HRow | undefined
              return active && p ? <TipBox title={p.label} rows={[{ name: '', value: p.display, color }]} /> : null
            }}
          />
          <Bar dataKey="value" fill={color} radius={[0, 4, 4, 0]} background={{ fill: c.line, fillOpacity: 0.35, radius: 4 } as never} isAnimationActive={!reduce}>
            <LabelList
              dataKey="label"
              content={({ x, y, value }) => (
                <Text
                  x={Number(x)}
                  y={Number(y) - 7}
                  width={Math.max(120, w - 8)}
                  lineHeight="1.3em"
                  maxLines={2}
                  verticalAnchor="end"
                  fill={c.ink}
                  fontSize={13}
                  fontWeight={500}
                >
                  {String(value)}
                </Text>
              )}
            />
            <LabelList
              dataKey="display"
              content={({ y, height, value }) => (
                <text x={w - 4} y={Number(y) + Number(height) / 2 + 4.5} textAnchor="end" fill={c.ink} fontSize={13} fontWeight={700}>
                  {String(value)}
                </text>
              )}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function AppealsChart() {
  const tr = useTr()
  const f = useFmt()
  const c = useChartColors()
  const A = D.appeals
  const rows: HRow[] = [
    { key: 'upheld', label: tr(COPY.appealsUpheld), value: A.upheld, display: f.num(A.upheld) },
    { key: 'dismissed', label: tr(COPY.appealsDismissed), value: A.dismissed, display: f.num(A.dismissed) },
    { key: 'open', label: tr(COPY.appealsOpen), value: A.open, display: f.num(A.open) },
  ]
  return (
    <ChartCard
      height={236}
      title={tr(COPY.appealsChartTitle)}
      takeaway={tr(COPY.appealsChartTakeaway)}
      summary={`${tr(COPY.appealsFiled)}: ${f.num(A.filed)}. ${rows.map(r => `${r.label}: ${r.display}`).join('. ')}.`}
      legend={
        <p className="text-sm text-muted">
          <span className="text-2xl font-bold text-ink tabular-nums">{f.num(A.filed)}</span> {tr(COPY.appealsFiled).toLowerCase()}
        </p>
      }
      table={{
        caption: tr(COPY.appealsChartTitle),
        columns: [tr(COPY.outcome), tr(COPY.count)],
        rows: [[tr(COPY.appealsFiled), f.num(A.filed)], ...rows.map(r => [r.label, r.display])],
      }}
    >
      <HBars rows={rows} color={c.brand} max={A.filed} />
    </ChartCard>
  )
}

export function RoutesChart() {
  const tr = useTr()
  const f = useFmt()
  const c = useChartColors()
  const total = ROUTE_ORDER.reduce((s, r) => s + D.byRoute[r], 0)
  const rows: HRow[] = ROUTE_ORDER.map(r => ({
    key: r,
    label: `${r === 'F' ? ROUTES[r].code : `${tr(COPY.route)} ${ROUTES[r].code}`} · ${tr(ROUTES[r].name)}`,
    value: D.byRoute[r],
    display: f.num(D.byRoute[r]),
  }))
  return (
    <ChartCard
      height={300}
      title={tr(COPY.routesChartTitle)}
      takeaway={tr(COPY.routesChartTakeaway)}
      summary={`${tr(COPY.routesChartTitle)}: ${rows.map(r => `${r.label}: ${r.display}`).join('. ')}.`}
      table={{
        caption: tr(COPY.routesChartTitle),
        columns: [tr(COPY.route), tr(COPY.registrations), tr(COPY.share)],
        rows: [...rows.map(r => [r.label, r.display, f.pct1((r.value / total) * 100)]), [tr(COPY.total), f.num(total), '100%']],
      }}
    >
      <HBars rows={rows} color={c.brand} max={Math.max(...rows.map(r => r.value))} />
    </ChartCard>
  )
}
