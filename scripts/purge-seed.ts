import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Missing Supabase environment variables in environment");
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function run() {
  const { data: forumPosts, error: fetchError } = await supabase
    .from("questions")
    .select("id, body")
    .eq("type", "forum");

  if (fetchError) {
    console.error("Error fetching forum posts:", fetchError.message);
    process.exit(1);
  }

  const seedPhrases = [
    "pediatrician in the Koramangala area",
    "power cuts this week in sector 4",
    "weekend marathon this Sunday",
    "Herman Miller Aeron chair",
    "Lost a golden retriever near the supermarket",
    "reliable plumber to fix a persistent leak",
    "cafe that opened up near the metro station",
    "local farmer's market setting up this Saturday"
  ];

  const idsToDelete = (forumPosts ?? [])
    .filter((q) => seedPhrases.some((phrase) => q.body.includes(phrase)))
    .map((q) => q.id);

  if (idsToDelete.length > 0) {
    const { error: deleteError } = await supabase
      .from("questions")
      .delete()
      .in("id", idsToDelete);
    if (deleteError) {
      console.error("Error deleting posts:", deleteError.message);
      process.exit(1);
    }
    console.log(`Successfully deleted ${idsToDelete.length} seeded questions.`);
  } else {
    console.log("No seeded questions found in database.");
  }
}

run();
