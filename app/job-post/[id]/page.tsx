"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import Link from "next/link";
import { EventInviteModal } from "@/components/forum/EventInviteModal";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function JobPostPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();

  // Session
  const { data: profile } = useSWR("/api/profile", fetcher, { 
    errorRetryCount: 0,
    shouldRetryOnError: false 
  });
  
  const { data, error, isLoading, mutate } = useSWR(`/api/job-posts/${resolvedParams.id}`, fetcher);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isInviteOpen, setIsInviteOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-background)]">
        <div className="skeleton h-64 w-full max-w-2xl rounded-xl"></div>
      </div>
    );
  }

  if (error || !data || data.error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--color-background)] p-4">
        <h1 className="text-h2 font-bold text-[var(--color-text)]">Job Post Not Found</h1>
        <p className="text-body text-[var(--color-text-secondary)] mt-2">This job post may have been removed.</p>
        <button onClick={() => router.push("/")} className="btn btn-primary mt-6">Go Home</button>
      </div>
    );
  }

  const { jobPost, userInterest, isCreator } = data;
  const isLoggedIn = !!profile && !profile.error;

  const isSeeker = jobPost.type === "seeker";
  const badgeText = isSeeker ? "Looking for Role" : "Hiring / Referring";
  const badgeBg = isSeeker ? "bg-blue-600" : "bg-emerald-600";

  const interests = jobPost.interests || [];
  const interestedList = interests.filter((i: any) => i.status === "interested");

  const isInterested = userInterest === "interested";

  const handleInterest = async () => {
    if (!isLoggedIn) {
      const cb = encodeURIComponent(`/job-post/${jobPost.id}`);
      router.push(`/login?callbackUrl=${cb}`);
      return;
    }

    setIsSubmitting(true);
    try {
      const nextStatus = isInterested ? "not_interested" : "interested";
      const res = await fetch(`/api/job-posts/${jobPost.id}/interest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus })
      });
      if (res.ok) {
        mutate();
      } else {
        alert("Failed to update interest.");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleShareWhatsapp = () => {
    const shareUrl = `${window.location.origin}/job-post/${jobPost.id}`;
    const text = `Check out this job opportunity on ProxNet: *${jobPost.role}* ${jobPost.company ? `at ${jobPost.company}` : ''}\n\nView details: ${shareUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const skillsList = jobPost.skills 
    ? jobPost.skills.split(",").map((s: string) => s.trim()).filter(Boolean)
    : [];

  return (
    <div className="min-h-screen bg-[var(--color-background)] pb-24">
      {/* Header Banner */}
      <div className={`h-48 w-full ${isSeeker ? 'bg-gradient-to-br from-blue-600 to-indigo-800' : 'bg-gradient-to-br from-emerald-600 to-teal-800'} opacity-90`} />
      
      <div className="max-w-3xl mx-auto px-4 -mt-24 relative z-10">
        {/* Main Job Card */}
        <div className="card bg-[var(--color-surface)] rounded-2xl shadow-xl border border-[var(--color-border-light)] p-6 md:p-8 flex flex-col gap-6">
          
          <div className="flex flex-col md:flex-row gap-4 justify-between items-start">
            <div className="flex flex-col gap-2 flex-1">
              <span className={`self-start px-3 py-1 rounded-full text-xs font-bold text-white uppercase tracking-wider ${badgeBg}`}>
                {badgeText}
              </span>
              <h1 className="text-3xl md:text-4xl font-black text-[var(--color-text)] leading-tight mt-1">{jobPost.role}</h1>
              {jobPost.company && (
                <p className="text-xl text-[var(--color-text-secondary)] font-semibold">
                  🏢 {jobPost.company} {jobPost.experience_years ? `• ⌛ ${jobPost.experience_years}` : ''}
                </p>
              )}
            </div>

            <div className="shrink-0 flex flex-col gap-2 w-full md:w-auto">
              <button
                onClick={handleInterest}
                disabled={isSubmitting}
                className={`w-full px-6 py-3 rounded-xl font-bold text-sm shadow-md transition-all cursor-pointer ${
                  isInterested
                    ? "bg-emerald-500/10 text-emerald-600 border border-emerald-300"
                    : "bg-[var(--color-primary)] text-white hover:opacity-90"
                }`}
              >
                {isInterested ? "✓ You are Interested" : "I'm Interested"}
              </button>

              <button
                onClick={handleShareWhatsapp}
                className="w-full px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 hover:bg-emerald-700 transition-colors shadow-sm"
              >
                <span>💬</span> Share via WhatsApp
              </button>
            </div>
          </div>

          {/* Posted By */}
          <div className="flex items-center gap-4 py-4 border-y border-[var(--color-border-light)]">
            <div className="w-12 h-12 rounded-full bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)] flex items-center justify-center font-bold text-base border border-[var(--color-border)] shadow-sm shrink-0">
              {jobPost.creator?.profile_photo_url ? (
                <img src={jobPost.creator.profile_photo_url} alt={jobPost.creator.full_name} className="w-full h-full object-cover rounded-full" />
              ) : (
                <span>💼</span>
              )}
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-base text-[var(--color-text)]">{jobPost.creator?.full_name}</span>
              <span className="text-xs text-[var(--color-text-secondary)]">
                Posted by {jobPost.creator?.job_title} @ {jobPost.creator?.company}
              </span>
            </div>
          </div>

          {/* Skills */}
          {skillsList.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-wider mb-2">Required / Key Skills</h3>
              <div className="flex flex-wrap gap-2">
                {skillsList.map((skill: string, i: number) => (
                  <span key={i} className="px-3 py-1 rounded-lg bg-[var(--color-surface-secondary)] text-xs font-semibold text-[var(--color-text)] border border-[var(--color-border-light)]">
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Description */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-h3 font-bold text-[var(--color-text)]">About this Opportunity</h3>
              {isLoggedIn && (
                <button 
                  onClick={() => setIsInviteOpen(true)}
                  className="px-4 py-2 bg-[var(--color-primary-subtle)] text-[var(--color-primary)] font-bold rounded-lg text-xs hover:opacity-80 transition-opacity"
                >
                  + Invite People
                </button>
              )}
            </div>
            <p className="text-body text-[var(--color-text-secondary)] whitespace-pre-wrap leading-relaxed">
              {jobPost.description || "No additional description provided."}
            </p>
          </div>

          {/* Contact Info */}
          {jobPost.contact_info && (
            <div className="p-4 rounded-xl bg-[var(--color-surface-secondary)] border border-[var(--color-border-light)]">
              <span className="text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-wider block mb-1">Direct Contact</span>
              <span className="text-sm font-semibold text-[var(--color-text)]">{jobPost.contact_info}</span>
            </div>
          )}

        </div>

        {/* Interested Professionals List */}
        <div className="mt-6 card bg-[var(--color-surface)] rounded-2xl shadow-sm border border-[var(--color-border-light)] p-6">
          <h3 className="text-h3 font-bold text-[var(--color-text)] mb-4">
            Interested Professionals ({interestedList.length})
          </h3>
          
          {interestedList.length === 0 ? (
            <p className="text-sm text-[var(--color-text-secondary)] italic">No one has expressed interest yet. Be the first!</p>
          ) : (
            <div className="flex flex-col gap-4">
              {interestedList.map((i: any) => (
                <div key={i.user?.id} className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[var(--color-primary-subtle)] text-[var(--color-primary)] flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden">
                    {i.user?.profile_photo_url ? (
                      <img src={i.user.profile_photo_url} alt={i.user.full_name} className="w-full h-full object-cover" />
                    ) : (
                      i.user?.full_name?.substring(0, 2).toUpperCase() || "U"
                    )}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-[var(--color-text)]">{i.user?.full_name}</span>
                    <span className="text-xs text-[var(--color-text-secondary)]">
                      {i.user?.job_title} @ {i.user?.company}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* CTA for Non-Logged in Users */}
        {!isLoggedIn && (
          <div className="mt-6 p-6 rounded-2xl bg-gradient-to-r from-[var(--color-primary)] to-blue-700 text-white text-center shadow-lg flex flex-col items-center gap-3">
            <h3 className="text-xl font-bold m-0">Join ProxNet to Express Interest</h3>
            <p className="text-sm text-white/80 max-w-md m-0">Connect directly with professionals in your neighborhood and get direct job referrals.</p>
            <Link 
              href={`/login?callbackUrl=${encodeURIComponent(`/job-post/${jobPost.id}`)}`}
              className="px-6 py-3 bg-white text-[var(--color-primary)] font-bold text-sm rounded-xl shadow hover:bg-white/90 transition-colors mt-2"
            >
              Sign Up / Login to Respond
            </Link>
          </div>
        )}

      </div>

      {isInviteOpen && (
        <EventInviteModal
          isOpen={isInviteOpen}
          onClose={() => setIsInviteOpen(false)}
          eventId={jobPost.id}
          eventTitle={jobPost.role}
        />
      )}
    </div>
  );
}
