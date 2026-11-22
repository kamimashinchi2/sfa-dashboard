import AcademyShell from "../../components/academy/AcademyShell";
import L00Level from "../../components/academy/L00Level";

/** Public readiness. No session and no quiz. */
export default function L00Page() {
  return (
    <AcademyShell>
      <L00Level />
    </AcademyShell>
  );
}
