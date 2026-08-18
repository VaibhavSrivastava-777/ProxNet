import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.error("Missing Supabase credentials");
    process.exit(1);
  }

  const supabase = createClient(url, key);

  // 1. Fetch user 50ecc4a2 or admin user
  const { data: user } = await supabase
    .from("users")
    .select("id, home_lat, home_lng")
    .eq("id", "50ecc4a2-c514-4922-8eb7-7e74961c7c4f")
    .single();

  const creatorId = user?.id || "50ecc4a2-c514-4922-8eb7-7e74961c7c4f";

  // Check existing future events
  const { data: events } = await supabase
    .from("events")
    .select("*")
    .eq("status", "active")
    .gt("starts_at", new Date().toISOString());

  if (events && events.length > 0) {
    console.log(`✅ Found ${events.length} existing future meetup events:`);
    events.forEach(e => console.log(`  - [${e.id}] "${e.title}" starts_at: ${e.starts_at}`));
    process.exit(0);
  }

  // Create a future meetup event starting in 3 days
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 3);
  futureDate.setHours(18, 0, 0, 0); // 6:00 PM

  const endDate = new Date(futureDate);
  endDate.setHours(20, 0, 0, 0); // 8:00 PM

  const newEvent = {
    creator_id: creatorId,
    title: "Indiranagar Tech & Product Leaders Coffee Meetup",
    subtitle: "Casual networking & AMA with local tech neighbors",
    description: "Join fellow product managers, engineers, and founders in Indiranagar for casual networking and coffee.",
    starts_at: futureDate.toISOString(),
    ends_at: endDate.toISOString(),
    venue_name: "Third Wave Coffee, 100ft Road, Indiranagar",
    venue_lat: user?.home_lat || 12.9716,
    venue_lng: user?.home_lng || 77.5946,
    center_lat: user?.home_lat || 12.9716,
    center_lng: user?.home_lng || 77.5946,
    is_public: true,
    status: "active",
  };

  const { data: created, error } = await supabase
    .from("events")
    .insert(newEvent)
    .select()
    .single();

  if (error) {
    console.error("Failed to seed future meetup event:", error.message);
    process.exit(1);
  }

  console.log(`🎉 Seeded new future meetup event:`);
  console.log(`   Title: ${created.title}`);
  console.log(`   Starts At: ${created.starts_at}`);
  console.log(`   Venue: ${created.venue_name}`);

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
