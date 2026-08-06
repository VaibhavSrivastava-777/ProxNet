import { ImageResponse } from 'next/og';
import { createAdminClient } from "@/lib/supabase/admin";

function parseISTDate(isoStr: string): Date {
  if (!isoStr) return new Date();
  let cleanStr = String(isoStr).trim();
  // If string has no timezone offset (no 'Z' and no '+' and no trailing timezone offset), append +05:30
  if (!cleanStr.endsWith("Z") && !cleanStr.includes("+") && !cleanStr.match(/-\d{2}:\d{2}$/)) {
    cleanStr += "+05:30";
  }
  return new Date(cleanStr);
}

function formatISTTime(isoStr: string): string {
  const d = parseISTDate(isoStr);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}

function formatISTDateStr(isoStr: string): string {
  const d = parseISTDate(isoStr);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(d).toUpperCase();
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  
  try {
    const supabase = createAdminClient();
    const { data: event } = await supabase
      .from("events")
      .select("*, creator:users!events_creator_id_fkey(full_name, job_title, company), rsvps:event_rsvps(status)")
      .eq("id", id)
      .single();

    if (!event) {
      return new Response('Not Found', { status: 404 });
    }

    const rsvps = event.rsvps || [];
    const going = rsvps.filter((r: any) => r.status === "yes").length;

    const dateStr = formatISTDateStr(event.starts_at);
    const startTimeStr = formatISTTime(event.starts_at);
    const endTimeStr = formatISTTime(event.ends_at);
    const timeStr = `${startTimeStr} – ${endTimeStr}`;

    const hostName = event.creator?.full_name || "Neighbor";
    const hostTitle = event.creator?.job_title ? `${event.creator.job_title} @ ${event.creator.company || ''}` : '';

    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            backgroundColor: '#ffffff',
            backgroundImage: 'radial-gradient(circle at 25px 25px, #E5E7EB 2%, transparent 0%), radial-gradient(circle at 75px 75px, #E5E7EB 2%, transparent 0%)',
            backgroundSize: '100px 100px',
            padding: '60px 70px',
            fontFamily: 'sans-serif',
          }}
        >
          {/* Header Badge & Brand */}
          <div style={{ display: 'flex', alignItems: 'center', width: '100%', justifyContent: 'space-between' }}>
            <div style={{ 
              display: 'flex', 
              backgroundColor: '#FFF0EB', 
              color: '#E56B42', 
              fontSize: 22, 
              fontWeight: 800, 
              textTransform: 'uppercase', 
              letterSpacing: '1.5px',
              padding: '8px 20px',
              borderRadius: '100px',
              border: '1.5px solid #FFD6C9'
            }}>
              MEETUP • {dateStr}
            </div>
            
            <div style={{ display: 'flex', fontSize: 26, fontWeight: 800, color: '#4F46E5' }}>
              ProxNet
            </div>
          </div>

          {/* Title & Subtitle */}
          <div style={{ display: 'flex', flexDirection: 'column', marginTop: '12px', marginBottom: '12px', width: '100%' }}>
            <div style={{ 
              fontSize: 52, 
              fontWeight: 900,
              color: '#111827',
              lineHeight: 1.15,
              maxWidth: '1060px'
            }}>
              {event.title}
            </div>
            {event.subtitle && (
              <div style={{ fontSize: 24, fontWeight: 600, color: '#4B5563', marginTop: '8px' }}>
                {event.subtitle}
              </div>
            )}
          </div>

          {/* Agenda Section */}
          {(event.description || event.subtitle) && (
            <div style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              width: '100%', 
              backgroundColor: '#EEF2FF', 
              padding: '16px 24px', 
              borderRadius: '16px', 
              borderLeft: '5px solid #4F46E5',
              marginTop: '8px',
              marginBottom: '12px'
            }}>
              <div style={{ display: 'flex', fontSize: 16, fontWeight: 800, color: '#4F46E5', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>
                📋 Agenda / Overview
              </div>
              <div style={{ display: 'flex', fontSize: 20, fontWeight: 600, color: '#1E1B4B', lineHeight: 1.35 }}>
                {(() => {
                  const text = event.description || event.subtitle;
                  return text.length > 140 ? `${text.substring(0, 140)}...` : text;
                })()}
              </div>
            </div>
          )}

          {/* Snapshot Grid: Venue & Time */}
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column',
            gap: '16px',
            backgroundColor: '#F9FAFB', 
            padding: '24px 30px', 
            borderRadius: '20px', 
            border: '1.5px solid #E5E7EB', 
            width: '100%' 
          }}>
            <div style={{ display: 'flex', alignItems: 'center', fontSize: 28, color: '#111827', fontWeight: 800 }}>
              <span style={{ marginRight: '12px' }}>⏰</span> {timeStr}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', fontSize: 26, color: '#374151', fontWeight: 700 }}>
              <span style={{ marginRight: '12px' }}>📍</span> {event.venue_name}
            </div>
          </div>

          {/* Footer Info */}
          <div style={{ display: 'flex', alignItems: 'center', width: '100%', justifyContent: 'space-between', borderTop: '2px solid #F3F4F6', paddingTop: '20px', marginTop: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', fontSize: 22, fontWeight: 700, color: '#111827' }}>
                Hosted by {hostName}
              </div>
              {hostTitle && (
                <div style={{ display: 'flex', fontSize: 18, color: '#6B7280', marginTop: '2px' }}>
                  {hostTitle}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', backgroundColor: '#EEF2FF', color: '#4F46E5', padding: '12px 24px', borderRadius: '100px', fontSize: 22, fontWeight: 800 }}>
              {going} Going
            </div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
        headers: {
          'Cache-Control': 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800',
        }
      }
    );
  } catch (e: any) {
    console.error(e);
    return new Response(`Failed to generate image`, { status: 500 });
  }
}
