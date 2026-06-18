import { handleBroadcast } from "@/lib/cronBroadcast";

export async function GET(request: Request) {
  return handleBroadcast(request);
}
