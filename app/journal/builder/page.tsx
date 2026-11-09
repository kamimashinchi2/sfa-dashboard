import AcademyShell from "../../components/academy/AcademyShell";
import JournalBuilder from "../../components/academy/JournalBuilder";

export default function JournalPage() {
  return (
    <AcademyShell>
      <div className="mx-auto w-full max-w-3xl space-y-6 px-6 py-10 sm:px-8">
        <h1 className="font-display text-3xl text-paper">Journal builder</h1>
        <JournalBuilder />
      </div>
    </AcademyShell>
  );
}
