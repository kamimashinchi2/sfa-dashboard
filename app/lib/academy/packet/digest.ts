import { canon } from "../canon";
import { sha256Hex } from "../sha256";
import type { SubmissionPacket } from "./schema";

/** Digest = SHA-256 hex of canon(packet without "integrity"). */
export async function digestPacket(
  packet: Omit<SubmissionPacket, "integrity"> | SubmissionPacket,
): Promise<string> {
  const { integrity: _i, ...rest } = packet as SubmissionPacket;
  void _i;
  return sha256Hex(canon(rest));
}

export async function verifyPacketDigest(
  packet: SubmissionPacket,
): Promise<boolean> {
  const expected = await digestPacket(packet);
  return expected === packet.integrity.digest;
}
