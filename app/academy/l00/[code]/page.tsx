import { notFound } from "next/navigation";
import AcademyShell from "../../../components/academy/AcademyShell";
import L00Chapter from "../../../components/academy/L00Chapter";
import { L00_CHAPTERS } from "../../../lib/academy/generated/v3PublicL00";

export function generateStaticParams() {
  return L00_CHAPTERS.map((chapter) => ({ code: chapter.code }));
}

export default async function L00ChapterPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const chapter = L00_CHAPTERS.find((item) => item.code === code);
  if (!chapter) notFound();
  return (
    <AcademyShell>
      <L00Chapter code={chapter.code} />
    </AcademyShell>
  );
}
