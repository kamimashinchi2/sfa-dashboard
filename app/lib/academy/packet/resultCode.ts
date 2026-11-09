import type { SubmissionPacket } from "./schema";
import { formatResultWeek } from "./week";

/**
 * SFA1-${studentId}-${YYYY}W${ww}-${digest.slice(0,10)}-Q${n}-R${n}-HB${n}
 */
export function buildResultCode(input: {
  studentId: string;
  isoWeek: string;
  digest: string;
  quizAttempts: number;
  simulatorRuns: number;
  hardBlockEvents: number;
}): string {
  return `SFA1-${input.studentId}-${formatResultWeek(input.isoWeek)}-${input.digest.slice(0, 10)}-Q${input.quizAttempts}-R${input.simulatorRuns}-HB${input.hardBlockEvents}`;
}

export function resultCodeFromPacket(packet: SubmissionPacket): string {
  return buildResultCode({
    studentId: packet.student.studentId,
    isoWeek: packet.isoWeek,
    digest: packet.integrity.digest,
    quizAttempts: packet.quizAttempts.length,
    simulatorRuns: packet.simulatorRuns.length,
    hardBlockEvents: packet.hardBlockEvents.length,
  });
}

export function packetFilename(input: {
  studentId: string;
  isoWeek: string;
  packetSeq: number;
}): string {
  const nn = String(input.packetSeq).padStart(2, "0");
  return `SFA_${input.studentId}_${input.isoWeek}_packet-${nn}.md`;
}
