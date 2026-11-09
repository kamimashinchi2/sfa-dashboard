import { Activity, Bot, Shield } from "lucide-react";

const badges = [
  {
    icon: Activity,
    label: "Student Status",
    value: "Stage 1: Active",
  },
  {
    icon: Shield,
    label: "Risk Rule",
    value: "1.0% Max Risk Cap",
  },
  {
    icon: Bot,
    label: "Live AI Mentor",
    value: "Echo Online",
  },
] as const;

export default function StatusBadges() {
  return (
    <ul className="flex flex-wrap items-center gap-2 sm:gap-3">
      {badges.map(({ icon: Icon, label, value }) => (
        <li
          key={label}
          className="inline-flex items-center gap-2 border border-line bg-ink/40 px-2.5 py-1.5 text-left sm:px-3"
        >
          <Icon
            className="h-3.5 w-3.5 shrink-0 text-teal-bright"
            aria-hidden
            strokeWidth={1.75}
          />
          <span className="flex min-w-0 flex-col leading-tight">
            <span className="text-[10px] tracking-[0.16em] text-fog uppercase">
              {label}
            </span>
            <span className="font-mono text-[11px] text-gold-soft sm:text-xs">
              {value}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}
