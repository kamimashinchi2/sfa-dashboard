"use client";

import { useState } from "react";
import RiskGridCalculator from "./RiskGridCalculator";

/** Always-open risk grid for /simulators/risk-grid */
export default function RiskGridSimulator() {
  const [open, setOpen] = useState(true);
  return (
    <div>
      <button
        type="button"
        className="mb-4 min-h-11 border border-gold/50 px-4 text-sm text-gold-soft"
        onClick={() => setOpen(true)}
      >
        Open calculator dialog
      </button>
      <RiskGridCalculator open={open} onClose={() => setOpen(false)} />
      {!open ? (
        <p className="text-sm text-fog">Dialog closed — reopen to continue practice.</p>
      ) : null}
    </div>
  );
}
