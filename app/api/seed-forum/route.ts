import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateAlias } from "@/lib/anonymize";

const SEED_DATA = [
  { category: "Recommendations", body: "Does anyone know a good pediatrician in the Koramangala area? Prefer someone who is good with toddlers.", lat: 12.9279, lng: 77.6271 },
  { category: "General", body: "Has anyone else noticed the frequent power cuts this week in sector 4? Any idea what's going on?", lat: 12.9279, lng: 77.6271 },
  { category: "Events", body: "We're organizing a weekend marathon this Sunday at 6 AM at the local park. Anyone interested in joining?", lat: 12.9279, lng: 77.6271 },
  { category: "Buy/Sell", body: "Selling my 1-year old Herman Miller Aeron chair. Excellent condition. Let me know if interested!", lat: 12.9279, lng: 77.6271 },
  { category: "Help Needed", body: "Lost a golden retriever near the supermarket yesterday evening. Answers to 'Buddy'. Please DM if you spot him!", lat: 12.9279, lng: 77.6271 },
  { category: "Recommendations", body: "Looking for a reliable plumber to fix a persistent leak in the kitchen sink. Urgent!", lat: 12.9279, lng: 77.6271 },
  { category: "General", body: "The new cafe that opened up near the metro station is fantastic. Highly recommend their croissants!", lat: 12.9279, lng: 77.6271 },
  { category: "Events", body: "There's a local farmer's market setting up this Saturday. Great place to get fresh organic produce.", lat: 12.9279, lng: 77.6271 }
];

export async function GET() {
  const supabase = createAdminClient();

  const { data: users } = await supabase.from("users").select("id").limit(5);
  
  if (!users || users.length === 0) {
    return NextResponse.json({ error: "No users found to act as askers" }, { status: 400 });
  }

  const inserts = SEED_DATA.map((seed, i) => {
    const randomUser = users[i % users.length];
    return {
      asker_id: randomUser.id,
      body: `[${seed.category}] ${seed.body}`,
      type: "forum",
      center_lat: seed.lat,
      center_lng: seed.lng,
      radius_meters: 5000,
      asker_alias: generateAlias("resident", 1)
    };
  });

  const { data, error } = await supabase.from("questions").insert(inserts).select();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, count: data.length });
}
