import type { PracticalPlan, Text } from "../../lib/academy/contracts";
import {
  DAILY_LOG_RULES,
  FINAL_PLAN_WORKSHEET,
  GENUINE_ENTRY,
  NO_TRADE_RULE,
  ROUTINE_HEADER,
} from "../../lib/academy/practicalPlans";

function line(value: Text, locale: "fa" | "en"): string {
  return locale === "fa" ? value.fa : value.en;
}

export default function PracticalPlanBlock({
  plan,
  locale,
  stage,
}: {
  plan: PracticalPlan;
  locale: "fa" | "en";
  stage: number;
}) {
  return (
    <div className="space-y-3 text-sm text-fog" data-testid="practical-plan">
      <div className="space-y-2 border border-line/70 p-3" data-testid="weekly-practical-rules">
        <h3 className="text-paper">{locale === "fa" ? "تمرین هفتگی چطور کار می‌کند" : "How the weekly practical works"}</h3>
        <p>{line(DAILY_LOG_RULES, locale)}</p>
        <ul className="list-disc space-y-1 ps-5">
          {ROUTINE_HEADER.map((row) => (
            <li key={row.en}>{line(row, locale)}</li>
          ))}
        </ul>
        <p>{line(GENUINE_ENTRY, locale)}</p>
        <p>{line(FINAL_PLAN_WORKSHEET, locale)}</p>
        {stage === 8 ? null : <p data-testid="no-trade-rule">{line(NO_TRADE_RULE, locale)}</p>}
      </div>
      <ul className="list-disc space-y-1 ps-5">
        {plan.core.map((item) => (
          <li key={item.id}>
            <span className="font-mono text-teal-bright">{item.id}</span> {line(item.text, locale)}
          </li>
        ))}
      </ul>
      {plan.spiral ? <p>{line(plan.spiral, locale)}</p> : null}
      <p>{line(plan.minimum, locale)}</p>
      <p>{line(plan.friday, locale)}</p>
      <p>{line(plan.reflection, locale)}</p>
      {plan.note ? <p>{line(plan.note, locale)}</p> : null}
    </div>
  );
}
