import Link from "next/link";
import AcademyShell from "../../components/academy/AcademyShell";

export default function DisclaimerPage() {
  return (
    <AcademyShell>
      <div className="mx-auto w-full max-w-3xl space-y-4 px-6 py-10 sm:px-8 text-fog">
        <h1 className="font-display text-3xl text-paper">Educational disclaimer</h1>
        <p>
          Smart Financial Academy pilot content is educational and SYNTHETIC. It is
          not live market data, trade execution, investment advice, or a certificate.
        </p>
        <p>
          Structure tools evaluate SETUP_ONLY. Macro tools evaluate CONTEXT_ONLY and
          never produce entry, stop-loss, or take-profit instructions.
        </p>
        <p>
          localStorage stores editable practice state only. Stops do not guarantee
          loss caps through gaps; margin sufficiency is separate from risk budget.
        </p>
        <Link href="/academy" className="text-gold-soft hover:underline">
          Return to academy
        </Link>
      </div>
    </AcademyShell>
  );
}
