/* UI kit — owned by Design agent (E). Stable API listed in src/contract/api.ts (UI KIT). */
export { cn, useLang, useTr, DUR, SPRING, SPRING_POP } from './utils'
export {
  Button, Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter,
  Badge, SimulatedBadge, PolicyBadge, StatusPill, RiskBadge, RouteBadge, Avatar,
  Spinner, Kbd, Skeleton, LiveDot, Divider, Callout, TextLink,
} from './primitives'
export type { ButtonProps, ButtonVariant, ButtonSize, Tone } from './primitives'
export { HomeLink } from './HomeLink'
export { Logo, LogoGlyph, PhoneFrame, PhoneStatusBar, LaptopFrame, Footer, LangToggle, PageHeader } from './layout'
export { EmptyState, LoadingState, ErrorState, Toaster, toast } from './feedback'
export { Stepper, CheckRow, OutcomeIcon, ScoreBar, CheckTick, CountUp } from './steps'
export type { StepItem, StepState } from './steps'
export { Dialog, DialogClose, Select, RadioCards, Switch, Field, Input, Textarea } from './forms'
export type { SelectOption, RadioCardOption } from './forms'
export {
  PageTransition, Stagger, StaggerItem, ConfettiBurst, ChipReadAnimation, FaceScanAnimation, AbstractFace,
} from './motion'
export type { ChipReadState, FaceScanState } from './motion'
export { DemoPanel } from './DemoPanel'
