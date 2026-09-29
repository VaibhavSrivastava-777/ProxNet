import { createAdminClient } from "../lib/supabase/admin";
import { isSameCompany } from "../lib/jobs/job-filters";

async function main() {
  const sb = createAdminClient();
  const { data: users, error } = await sb
    .from("users")
    .select("id, full_name, email, profile_digest");

  if (error || !users) {
    console.error("Failed to query users:", error);
    return;
  }

  console.log(`Scanning ${users.length} users for corrupt blueprints...`);

  let repairedCount = 0;

  for (const user of users) {
    const blueprints = user.profile_digest?.deep_career_blueprints;
    if (!Array.isArray(blueprints) || blueprints.length === 0) continue;

    let modified = false;
    const cleanedBlueprints = blueprints.map((bp: any) => {
      // Check if connector is Prmod Kumar or any mismatched proxnet connector
      if (bp.connector && bp.connector.type === "proxnet") {
        const isPramod = bp.connector.proxnetUserId === "6052f1f7-b42c-4fab-bd08-2d98b0ff5252" ||
          (bp.connector.name && bp.connector.name.toLowerCase().includes("prmod"));

        // Extract connector's company from connectionPath e.g. "... @ T)" or role
        const roleComp = bp.connector.role?.split("@")[1]?.trim();
        const pathComp = bp.connector.connectionPath?.split("@")[1]?.replace(")", "").trim();
        const connComp = roleComp || pathComp || (isPramod ? "T" : "");

        const isSame = connComp && isSameCompany(connComp, bp.company) && (connComp.toLowerCase().trim() !== "t" || bp.company.toLowerCase().trim() === "t");

        if (isPramod || !isSame) {
          console.log(`[USER: ${user.full_name} (${user.email})] Removing invalid connector (${bp.connector.name} @ ${connComp}) for ${bp.company}: "${bp.title}"`);
          modified = true;
          return {
            ...bp,
            connector: {
              type: "linkedin",
              linkedinSearchUrl: `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(bp.company + " (Director OR Head OR VP)")}`,
              linkedinAlumniUrl: `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(bp.company)}`,
              outreachMessage: `Hi [Name], I noticed ${bp.company}'s ${bp.title}. With my background, I'd love to connect and learn about the team's roadmap.`,
              connectionPath: `LinkedIn Direct: Hiring Leader at ${bp.company}`,
            },
          };
        }
      }
      return bp;
    });

    if (modified) {
      const updatedDigest = {
        ...user.profile_digest,
        deep_career_blueprints: cleanedBlueprints,
      };

      const { error: updateErr } = await sb
        .from("users")
        .update({ profile_digest: updatedDigest })
        .eq("id", user.id);

      if (updateErr) {
        console.error(`Failed updating user ${user.id}:`, updateErr);
      } else {
        repairedCount++;
        console.log(`✅ Successfully repaired profile_digest for ${user.full_name}`);
      }
    }
  }

  console.log(`\n🎉 Sanitization complete! Repaired ${repairedCount} user records.`);
}

main().catch(console.error);
