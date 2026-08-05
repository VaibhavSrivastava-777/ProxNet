import { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { EventClientPage } from "@/components/forum/EventClientPage";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const supabase = createAdminClient();

  const { data: event } = await supabase
    .from("events")
    .select("title, subtitle, description, starts_at, updated_at, venue_name")
    .eq("id", id)
    .single();

  if (!event) {
    return {
      title: "Event Not Found | ProxNet",
    };
  }

  const startObj = new Date(event.starts_at);
  const dateStr = startObj.toLocaleDateString("en-US", { 
    timeZone: "Asia/Kolkata", 
    weekday: "short", 
    month: "short", 
    day: "numeric" 
  });

  const title = `Meetup: ${event.title} (${dateStr}) | ProxNet`;
  const description = event.subtitle || event.description || `Join this local meetup at ${event.venue_name} on ProxNet Neighborhood Network!`;
  
  const version = event.updated_at ? new Date(event.updated_at).getTime() : new Date(event.starts_at).getTime();
  const ogImageUrl = `https://www.proxnet.in/api/events/${id}/og-image?v=${version}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `https://www.proxnet.in/e/${id}`,
      siteName: "ProxNet Neighborhood Network",
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          type: "image/png",
          alt: event.title,
        },
      ],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImageUrl],
    },
  };
}

export default async function ShortEventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EventClientPage id={id} />;
}
