import { dailyState } from "@/server/daily";
import { handle, siteUrl } from "@/server/http";
import { currentUser } from "@/server/user";

export async function GET(request: Request) {
  return handle(async () => Response.json(await dailyState(await currentUser(), siteUrl(request))));
}
