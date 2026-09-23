import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No image file provided" }, { status: 400 });
    }

    // Validate mime type
    const validMimes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!validMimes.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid image format. Supported formats: JPEG, PNG, WebP, GIF." },
        { status: 400 }
      );
    }

    // Validate size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Image size exceeds 5MB limit. Please choose a smaller photo." },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const supabase = createAdminClient();

    // Ensure profile-photos bucket exists
    const { data: buckets } = await supabase.storage.listBuckets();
    const hasBucket = buckets?.some((b) => b.id === "profile-photos" || b.name === "profile-photos");
    if (!hasBucket) {
      await supabase.storage.createBucket("profile-photos", {
        public: true,
        fileSizeLimit: 5242880,
        allowedMimeTypes: validMimes,
      });
    }

    // File naming: sanitized user id with timestamp
    const ext = file.type.split("/")[1] || "jpg";
    const fileName = `${user.id}-${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("profile-photos")
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      console.error("Failed to upload profile photo:", uploadError);
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    const { data: publicUrlData } = supabase.storage
      .from("profile-photos")
      .getPublicUrl(fileName);

    const photoUrl = publicUrlData.publicUrl;

    // Update user record in database
    await supabase
      .from("users")
      .update({ profile_photo_url: photoUrl, updated_at: new Date().toISOString() })
      .eq("id", user.id);

    return NextResponse.json({
      success: true,
      photoUrl,
    });
  } catch (err: any) {
    console.error("Error in upload-photo route:", err);
    return NextResponse.json(
      { error: err.message || "Failed to process profile photo upload" },
      { status: 500 }
    );
  }
}
