export interface JobPostInput {
  type?: string | null;
  role?: string | null;
  company?: string | null;
  experience_years?: string | number | null;
  experienceYears?: string | number | null;
  skills?: string | null;
  description?: string | null;
  contact_info?: string | null;
  contactInfo?: string | null;
  contact_number?: string | null;
  is_on_behalf?: boolean;
}

export interface SanitizedJobPost {
  type: "giver" | "seeker";
  role: string;
  company: string;
  experience_years: string;
  skills: string;
  description: string;
  contact_info: string | null;
}

export interface JobPostValidationResult {
  valid: boolean;
  errors: string[];
  sanitized?: SanitizedJobPost;
}

/**
 * Validates that a Hiring or Looking for job opportunity has all required, proper details.
 * Prevents spam, incomplete, or vague posts from entering the network and triggering 2km dispatches.
 */
export function validateJobPost(input: JobPostInput): JobPostValidationResult {
  const errors: string[] = [];

  // 1. Validate Post Type
  const rawType = (input.type || "").trim().toLowerCase();
  if (rawType !== "giver" && rawType !== "seeker") {
    errors.push("Opportunity type must be specified as either 'Hiring / Referring' (giver) or 'Looking for a role' (seeker).");
  }

  // 2. Validate Role Title
  const role = (input.role || "").trim();
  if (!role) {
    errors.push("Role title is required.");
  } else if (role.length < 3) {
    errors.push("Role title must be at least 3 characters long (e.g. Frontend Engineer, Product Manager).");
  } else if (role.length > 120) {
    errors.push("Role title must be 120 characters or fewer.");
  }

  // 3. Validate Company Name
  const company = (input.company || "").trim();
  if (!company) {
    if (rawType === "giver") {
      errors.push("Company name is required for hiring/referral posts.");
    } else {
      errors.push("Target company or preferred company type is required for role seeker posts.");
    }
  } else if (company.length < 2) {
    errors.push("Company name must be at least 2 characters long.");
  }

  // 4. Validate Experience Level
  const expRaw = input.experience_years !== undefined && input.experience_years !== null
    ? String(input.experience_years).trim()
    : input.experienceYears !== undefined && input.experienceYears !== null
      ? String(input.experienceYears).trim()
      : "";

  if (!expRaw) {
    errors.push("Experience level is required (e.g. 0-2 years, 3-5 years, 5+).");
  }

  // 5. Validate Key Skills
  const skills = (input.skills || "").trim();
  if (!skills) {
    errors.push("Key skills or technologies are required (e.g. React, Python, Product Strategy).");
  } else if (skills.length < 2) {
    errors.push("Key skills must be at least 2 characters long.");
  }

  // 6. Validate Description / Context
  let description = (input.description || "").trim();
  if (description) {
    if (description.length < 15) {
      errors.push("Description must be at least 15 characters long to provide proper context to neighbors.");
    }
  } else {
    // If description is not explicitly provided (e.g. from quick-post), auto-synthesize a rich description
    // from the validated structured fields so that the post is never incomplete in the feed or database.
    const isGiver = rawType === "giver";
    description = isGiver
      ? `Hiring / Referral Opportunity for ${role} at ${company}. Experience: ${expRaw}${!expRaw.includes("year") ? " years" : ""}. Key skills: ${skills}.`
      : `Looking for ${role} opportunities at ${company}. Experience: ${expRaw}${!expRaw.includes("year") ? " years" : ""}. Key skills: ${skills}.`;
  }

  const contactInfo = (input.contact_info || input.contactInfo || input.contact_number || "").trim() || null;

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    errors: [],
    sanitized: {
      type: rawType as "giver" | "seeker",
      role,
      company,
      experience_years: expRaw,
      skills,
      description,
      contact_info: contactInfo,
    },
  };
}
