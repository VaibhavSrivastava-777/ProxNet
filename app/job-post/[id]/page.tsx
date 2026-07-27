import { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { JobPostClientPage } from "@/components/forum/JobPostClientPage";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const supabase = createAdminClient();

  const { data: jobPost } = await supabase
    .from("job_posts")
    .select("role, company, type, description")
    .eq("id", id)
    .single();

  if (!jobPost) {
    return {
      title: "Job Post Not Found | ProxNet",
    };
  }

  const isSeeker = jobPost.type === "seeker";
  const title = isSeeker
    ? `Looking for Role: ${jobPost.role} | ProxNet`
    : `Hiring: ${jobPost.role} ${jobPost.company ? `at ${jobPost.company}` : ''} | ProxNet`;
  const description = jobPost.description
    ? jobPost.description.slice(0, 160)
    : `Connect with local professionals on ProxNet for job opportunities and referrals!`;
  const ogImageUrl = `https://www.proxnet.in/api/job-posts/${id}/og-image`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `https://www.proxnet.in/job-post/${id}`,
      siteName: "ProxNet Neighborhood Network",
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: jobPost.role,
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

export default async function JobPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <JobPostClientPage id={id} />;
}
