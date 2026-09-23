import { GameError, setDailyPick } from "@/server/daily";
import { handle } from "@/server/http";
import { currentUser } from "@/server/user";
import { isValidSelection, type Market } from "@/lib/types";

export async function PUT(request: Request) {
  return handle(async () => {
    const user = await currentUser();
    if (!user) throw new GameError("No slate started today", 409);
    const body = await request.json().catch(() => null);
    const slot = body?.slot;
    const market = body?.market as Market;
    const selection = body?.selection ?? null;
    if (!Number.isInteger(slot) || (market !== "moneyline" && market !== "total")) {
      throw new GameError("Bad pick", 400);
    }
    if (selection !== null && !isValidSelection(market, selection)) throw new GameError("Bad selection", 400);
    await setDailyPick(user, slot, market, selection);
    return Response.json({ ok: true });
  });
}
