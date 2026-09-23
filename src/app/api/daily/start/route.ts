import { dailyState, startDaily } from "@/server/daily";
import { handle, siteUrl } from "@/server/http";
import { currentOrNewUser } from "@/server/user";

export async function POST(request: Request) {
  return handle(async () => {
    const user = await currentOrNewUser();
    await startDaily(user);
    return Response.json(await dailyState(user, siteUrl(request)));
  });
}
