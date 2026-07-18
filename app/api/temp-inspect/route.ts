import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get("secret");

  if (secret !== "inspect_998877") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  try {
    const { data: forumPosts, error: fetchError } = await supabase
      .from("questions")
      .select("id, body")
      .eq("type", "forum");

    if (fetchError) throw new Error(fetchError.message);

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

    let deletedCount = 0;
    if (idsToDelete.length > 0) {
      const { error: deleteError } = await supabase
        .from("questions")
        .delete()
        .in("id", idsToDelete);
      if (deleteError) throw new Error(deleteError.message);
      deletedCount = idsToDelete.length;
    }

    return NextResponse.json({
      success: true,
      message: `Successfully purged ${deletedCount} fake seeded forum posts.`,
      deletedCount
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

