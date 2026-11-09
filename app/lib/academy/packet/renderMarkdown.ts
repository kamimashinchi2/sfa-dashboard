import { escapeMd } from "../journalV2";
import type { SubmissionPacket } from "./schema";
import { packetFilename } from "./resultCode";

const MAX_BYTES = 1_000_000;
const TRUNC_MARK = "\n\n<!-- SFA_PACKET_TRUNCATED -->\n";

function line(s: string): string {
  return escapeMd(s);
}

/** Deterministic Markdown derived only from the JSON packet. */
export function renderMarkdown(packet: SubmissionPacket): string {
  const title = `SFA Weekly Submission Packet · ${packet.student.studentId} (${packet.student.alias}) · ${packet.isoWeek}`;
  const filename = packetFilename({
    studentId: packet.student.studentId,
    isoWeek: packet.isoWeek,
    packetSeq: packet.packetSeq,
  });

  const body: string[] = [];
  body.push(`# ${title}`);
  body.push("");
  body.push(
    "> Educational simulation only. All market data is SYNTHETIC. Every client score, PASS, or correctness flag is a **CLAIM — UNVERIFIED until mentor review**. The digest is tamper-evidence for accidental edits, NOT a signature, proof, or verification.",
  );
  body.push("");
  body.push(`**Result Code:** \`${packet.integrity.resultCode}\``);
  body.push(
    `**Week:** ${packet.isoWeek} (${packet.period.fromISO} → ${packet.period.toISO})`,
  );
  body.push(`**Generated:** ${packet.generatedAtISO} (${packet.timezone})`);
  body.push(
    `**Upload target:** Google Drive → \`02_Student_Submissions/Student_<NN>_<Alias>/\` → New → File upload → \`${filename}\` (do not open with Google Docs).`,
  );
  body.push(`**Build:** ${packet.build.label}`);
  body.push("");
  body.push("## 1 Summary");
  body.push(
    `- Quiz attempts: ${packet.quizAttempts.length} · Simulator runs: ${packet.simulatorRuns.length} · HARD_BLOCK events: ${packet.hardBlockEvents.length}`,
  );
  body.push(
    `- Lesson responses: ${packet.lessonResponses.length} · Journal entries: ${packet.journalEntries.length} · Self-reports: ${packet.selfReports.length}`,
  );
  body.push(
    `- Packet seq: ${packet.packetSeq} · supersedes: ${packet.supersedesDigest ?? "none"}`,
  );
  body.push("");
  body.push("## 2 Quiz attempts");
  if (!packet.quizAttempts.length) body.push("_None in this week._");
  for (const a of packet.quizAttempts) {
    body.push(`### ${a.attemptId}`);
    body.push(
      `- quizId: ${a.quizId} · mode: ${a.mode} · client score claim: ${a.client.score}/100 (${a.client.correct}/${a.client.total}) — **UNVERIFIED**`,
    );
    body.push(
      `- submitted: ${a.submittedAtISO} · shuffleSeed: \`${a.shuffleSeed}\` · buildCommit: ${a.buildCommit ?? "version unavailable"}`,
    );
    body.push("");
    body.push("| item | your answer | result | reflection |");
    body.push("| --- | --- | --- | --- |");
    for (const it of a.items) {
      const ans = line(JSON.stringify(it.answer.canonical));
      const result = !it.touched
        ? "not answered"
        : it.clientCorrect
          ? "correct (claim)"
          : "wrong (claim)";
      const refl = it.reflection ? line(it.reflection) : "";
      body.push(`| ${it.itemId} | \`${ans}\` | ${result} | ${refl} |`);
    }
    body.push("");
  }

  body.push("## 3 Simulator runs");
  if (!packet.simulatorRuns.length) body.push("_None in this week._");
  for (const r of packet.simulatorRuns) {
    body.push(
      `- \`${r.runId}\` · ${r.tool} · ${r.status} · decision=${r.studentDecision} · at ${r.atISO}`,
    );
    if (r.issueCodes.length) {
      body.push(`  - issues: ${r.issueCodes.join(", ")}`);
    }
  }
  body.push("");

  body.push("## 4 HARD_BLOCK events");
  if (!packet.hardBlockEvents.length) body.push("_None._");
  for (const e of packet.hardBlockEvents) {
    body.push(`- ${e.atISO} · ${e.tool} · \`${e.code}\` · run ${e.runId}`);
  }
  body.push("");

  body.push("## 5 Journal");
  if (!packet.journalEntries.length) body.push("_None in this week._");
  for (const j of packet.journalEntries) {
    body.push(`### ${j.id}`);
    body.push(`- mission: ${j.missionId ?? "—"} · stage: ${j.stage}`);
    body.push(`- hypothesis: ${line(j.hypothesis)}`);
    body.push(`- invalidation: ${line(j.invalidation)}`);
    body.push(`- falsification: ${line(j.falsification)}`);
    body.push(`- counterevidence: ${line(j.counterevidence)}`);
    body.push(`- emotions: ${line(j.emotions)}`);
    body.push(`- nextTask: ${line(j.nextTask)}`);
    body.push("");
  }

  body.push("## 6 Lesson responses");
  if (!packet.lessonResponses.length) body.push("_None in this week._");
  for (const r of packet.lessonResponses) {
    body.push(`### ${r.lessonId}`);
    body.push(`- mission: ${r.missionId ?? "—"} · saved: ${r.savedAtISO}`);
    body.push("");
    body.push(line(r.text));
    body.push("");
  }

  body.push("## 7 Weekly reflection");
  body.push(line(packet.weeklyReflection.text));
  body.push("");
  body.push(
    `- emotionBefore: ${packet.weeklyReflection.emotionBefore} · emotionAfter: ${packet.weeklyReflection.emotionAfter}`,
  );
  body.push("");

  body.push("## 8 Self-reported (not graded)");
  if (!packet.selfReports.length) body.push("_None._");
  for (const s of packet.selfReports) {
    body.push(`- ${s.kind} · ${s.refId} · ${s.atISO}`);
  }
  body.push("");

  body.push("## 9 Machine-readable block (do not edit)");
  body.push("<!-- sfa-submission:begin -->");
  body.push("```json");
  body.push(JSON.stringify(packet, null, 2));
  body.push("```");
  body.push("<!-- sfa-submission:end -->");
  body.push("");

  let md = body.join("\n").replace(/\r\n/g, "\n");
  const bytes = new TextEncoder().encode(md);
  if (bytes.length > MAX_BYTES) {
    const overhead = new TextEncoder().encode(TRUNC_MARK).length;
    let cut = md.slice(0, Math.floor(md.length * ((MAX_BYTES - overhead) / bytes.length)));
    while (new TextEncoder().encode(cut + TRUNC_MARK).length > MAX_BYTES) {
      cut = cut.slice(0, Math.floor(cut.length * 0.95));
    }
    md = cut + TRUNC_MARK;
  }
  return md;
}

/** Extract the JSON block from a packet markdown file. */
export function extractPacketJson(md: string): string | null {
  const begin = md.indexOf("<!-- sfa-submission:begin -->");
  const end = md.indexOf("<!-- sfa-submission:end -->");
  if (begin < 0 || end < 0 || end <= begin) return null;
  const slice = md.slice(begin, end);
  const fence = slice.indexOf("```json");
  if (fence < 0) return null;
  const after = slice.slice(fence + "```json".length);
  const close = after.indexOf("```");
  if (close < 0) return null;
  return after.slice(0, close).trim();
}
