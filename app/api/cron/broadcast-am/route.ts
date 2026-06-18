import { handleBroadcast } from "@/lib/cronBroadcast";

export const maxDuration = 60;

export async function GET(request: Request) {
  return handleBroadcast(request);
}
