import "server-only";
import { cookies } from "next/headers";
import { addDays, slateDateFor } from "@/lib/day";

// Testing tools (replay today, jump to another day). Enabled only when TEST_TOOLS=1;
// remove that env var before real players arrive, since replays bypass one-attempt-per-day.
export const testToolsEnabled = process.env.TEST_TOOLS === "1";

const OFFSET_COOKIE = "sr_day_offset";

export async function dayOffset(): Promise<number> {
  if (!testToolsEnabled) return 0;
  const n = Number((await cookies()).get(OFFSET_COOKIE)?.value ?? 0);
  return Number.isInteger(n) && n >= 0 && n <= 3650 ? n : 0;
}

export async function setDayOffset(n: number) {
  (await cookies()).set(OFFSET_COOKIE, String(n), { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
}

/** Today's slate date, shifted by the tester's simulated day offset. */
export async function currentSlateDate(): Promise<string> {
  return addDays(slateDateFor(), await dayOffset());
}
