/**
 * Curated suggestions and smart ranking for Company names and Designations / Job Titles.
 */

export const TOP_COMPANIES = [
  // Big Tech & Global Majors
  "Google",
  "Microsoft",
  "Amazon",
  "Apple",
  "Meta",
  "Netflix",
  "Uber",
  "LinkedIn",
  "Twitter / X",
  "Airbnb",
  "Adobe",
  "Salesforce",
  "Oracle",
  "Cisco",
  "Intel",
  "Nvidia",
  "AMD",
  "IBM",
  "Qualcomm",
  "Broadcom",
  "Texas Instruments",
  "Micron Technology",
  "Sony",
  "Samsung",
  "SAP",
  "VMware",
  "ServiceNow",
  "Snowflake",
  "Databricks",
  "Palantir",
  "Palo Alto Networks",
  "CrowdStrike",
  "Cloudflare",
  "Twilio",
  "MongoDB",
  "Atlassian",
  "GitHub",
  "GitLab",
  "Slack",
  "Zoom",
  "Shopify",
  "Square / Block",
  "PayPal",
  "Stripe",
  "Spotify",
  "ByteDance",
  "Booking.com",
  "Expedia Group",
  "Intuit",
  "Workday",
  "Autodesk",
  "Pinterest",
  "Snapchat",
  "Dropbox",
  "Box",
  "Asana",
  "Notion",
  "Figma",
  "Canva",

  // Indian Tech Unicorns, Scale-ups & Products
  "Flipkart",
  "Swiggy",
  "Zomato",
  "Zerodha",
  "PhonePe",
  "Razorpay",
  "Paytm",
  "Cred",
  "Groww",
  "Meesho",
  "Zepto",
  "Blinkit",
  "Urban Company",
  "Ola",
  "Ola Electric",
  "Nykaa",
  "BigBasket",
  "MakeMyTrip",
  "Cleartrip",
  "Delhivery",
  "Lenskart",
  "PolicyBazaar",
  "Cars24",
  "Spinny",
  "InMobi",
  "Freshworks",
  "Postman",
  "BrowserStack",
  "Hasura",
  "Zoho",
  "Darwinbox",
  "Chargebee",
  "Pine Labs",
  "BharatPe",
  "Khatabook",
  "CoinSwitch",
  "CoinDCX",
  "Upstox",
  "ShareChat",
  "Dream11",
  "Games24x7",
  "Mobile Premier League (MPL)",
  "Unacademy",
  "PhysicsWallah",
  "UpGrad",
  "Eruditus",
  "LeadSquared",
  "MoEngage",
  "CleverTap",
  "Whatfix",
  "Druva",
  "Icertis",
  "Zenoti",
  "Mindtickle",

  // IT Services & Global Delivery Giants
  "Tata Consultancy Services (TCS)",
  "Infosys",
  "Wipro",
  "HCLTech",
  "Cognizant",
  "Tech Mahindra",
  "LTIMindtree",
  "Mphasis",
  "Persistent Systems",
  "Birlasoft",
  "KPIT Technologies",
  "Hexaware Technologies",
  "Accenture",
  "Capgemini",
  "DXC Technology",
  "NTT DATA",
  "Virtusa",
  "Tata Elxsi",
  "Coforge",

  // Consulting, Strategy & Professional Services
  "McKinsey & Company",
  "Boston Consulting Group (BCG)",
  "Bain & Company",
  "Deloitte",
  "PwC",
  "EY (Ernst & Young)",
  "KPMG",
  "Strategy&",
  "Oliver Wyman",
  "A.T. Kearney",
  "Alvarez & Marsal",
  "Gartner",
  "Zimmerman",
  "Mu Sigma",
  "Fractal Analytics",
  "Tiger Analytics",
  "ZS Associates",
  "EXL Service",
  "Genpact",
  "WNS Global Services",

  // Banking, FinTech & Financial Services
  "Goldman Sachs",
  "Morgan Stanley",
  "JPMorgan Chase & Co.",
  "Citibank",
  "Bank of America",
  "Barclays",
  "HSBC",
  "Standard Chartered",
  "Deutsche Bank",
  "UBS",
  "Credit Suisse",
  "Wells Fargo",
  "American Express",
  "Visa",
  "Mastercard",
  "Fidelity Investments",
  "BlackRock",
  "State Street",
  "BNP Paribas",
  "Societe Generale",
  "HDFC Bank",
  "ICICI Bank",
  "Axis Bank",
  "Kotak Mahindra Bank",
  "State Bank of India (SBI)",
  "Bajaj Finserv",
  "Tata Capital",

  // Retail, Conglomerates, Telecom & Automotive
  "Walmart",
  "Walmart Global Tech",
  "Target",
  "Amazon Web Services (AWS)",
  "Reliance Industries",
  "Reliance Jio",
  "Bharti Airtel",
  "Tata Group",
  "Tata Motors",
  "Tata Digital",
  "Larsen & Toubro (L&T)",
  "Siemens",
  "Bosch",
  "General Electric (GE)",
  "Honeywell",
  "Schneider Electric",
  "ABB",
  "Maruti Suzuki",
  "Mahindra & Mahindra",
  "Hyundai",
  "Toyota",
  "Mercedes-Benz R&D",
  "BMW Group",
  "ITC Limited",
  "Hindustan Unilever (HUL)",
  "Procter & Gamble (P&G)",
  "Nestle",
  "Johnson & Johnson",
];

export const TOP_DESIGNATIONS = [
  // Software Engineering & Architecture
  "Software Engineer",
  "Software Development Engineer",
  "Senior Software Engineer",
  "Senior Software Development Engineer",
  "Lead Software Engineer",
  "Staff Software Engineer",
  "Principal Software Engineer",
  "Distinguished Engineer",
  "Frontend Engineer",
  "Senior Frontend Engineer",
  "Lead Frontend Engineer",
  "Backend Engineer",
  "Senior Backend Engineer",
  "Lead Backend Engineer",
  "Full Stack Engineer",
  "Senior Full Stack Engineer",
  "Lead Full Stack Engineer",
  "Mobile Engineer",
  "iOS Engineer",
  "Android Engineer",
  "React Native Developer",
  "Flutter Developer",
  "System Architect",
  "Solutions Architect",
  "Cloud Solutions Architect",
  "Enterprise Architect",
  "Technical Lead",

  // DevOps, Infrastructure, Security & SRE
  "DevOps Engineer",
  "Senior DevOps Engineer",
  "Lead DevOps Engineer",
  "Site Reliability Engineer (SRE)",
  "Senior SRE",
  "Cloud Infrastructure Engineer",
  "Platform Engineer",
  "Senior Platform Engineer",
  "Security Engineer",
  "Cybersecurity Specialist",
  "Information Security Analyst",
  "DevSecOps Engineer",

  // Data, Analytics, AI & ML
  "Data Scientist",
  "Senior Data Scientist",
  "Lead Data Scientist",
  "Data Engineer",
  "Senior Data Engineer",
  "Lead Data Engineer",
  "Machine Learning Engineer",
  "Senior Machine Learning Engineer",
  "AI Engineer",
  "Senior AI Engineer",
  "Research Scientist",
  "NLP Engineer",
  "Computer Vision Engineer",
  "Data Analyst",
  "Senior Data Analyst",
  "Lead Data Analyst",
  "Business Intelligence Engineer",
  "Analytics Manager",

  // Product Management & Strategy
  "Associate Product Manager",
  "Product Manager",
  "Senior Product Manager",
  "Lead Product Manager",
  "Principal Product Manager",
  "Group Product Manager",
  "Director of Product",
  "VP of Product",
  "Head of Product",
  "Chief Product Officer (CPO)",
  "Technical Product Manager",
  "Product Owner",

  // Engineering & Tech Leadership
  "Engineering Manager",
  "Senior Engineering Manager",
  "Director of Engineering",
  "Senior Director of Engineering",
  "VP of Engineering",
  "Senior VP of Engineering",
  "Head of Engineering",
  "Chief Technology Officer (CTO)",
  "Chief Information Officer (CIO)",

  // UI/UX & Design
  "UI/UX Designer",
  "Product Designer",
  "Senior Product Designer",
  "Lead Product Designer",
  "Design Director",
  "Head of Design",
  "Visual Designer",
  "UX Researcher",
  "Design Systems Lead",

  // Quality Assurance & Testing
  "QA Engineer",
  "Senior QA Engineer",
  "SDET (Software Development Engineer in Test)",
  "Senior SDET",
  "Lead SDET",
  "QA Automation Lead",
  "Quality Engineering Manager",

  // Agile & Program Management
  "Technical Program Manager (TPM)",
  "Senior Technical Program Manager",
  "Program Manager",
  "Scrum Master",
  "Agile Coach",
  "Project Manager",
  "Delivery Manager",

  // Consulting, Strategy & Finance
  "Business Analyst",
  "Senior Business Analyst",
  "Associate Consultant",
  "Consultant",
  "Senior Consultant",
  "Managing Consultant",
  "Principal Consultant",
  "Management Consultant",
  "Strategy Consultant",
  "Partner",
  "Financial Analyst",
  "Senior Financial Analyst",
  "Investment Banking Analyst",
  "Associate - Investment Banking",

  // Sales, Marketing & Growth
  "Account Executive",
  "Senior Account Executive",
  "Sales Manager",
  "Director of Sales",
  "Business Development Representative",
  "Business Development Manager",
  "Customer Success Manager",
  "Marketing Manager",
  "Product Marketing Manager (PMM)",
  "Growth Marketer",
  "Head of Marketing",
  "Content Strategist",

  // People & Operations
  "Human Resources Manager",
  "HR Business Partner",
  "Talent Acquisition Specialist",
  "Operations Manager",
  "Chief Operating Officer (COO)",
  "Chief Executive Officer (CEO)",
  "Chief Financial Officer (CFO)",
  "Founder",
  "Co-Founder",
];

/**
 * Smart matching algorithm:
 * 1. Exact case-insensitive prefix match (rank 1)
 * 2. Word boundary prefix match (rank 2, e.g. "Engineer" matches "Senior Software Engineer")
 * 3. Substring match (rank 3)
 */
export function rankAndFilterSuggestions(
  query: string,
  items: string[],
  maxResults = 8
): string[] {
  const cleanQ = query.trim().toLowerCase();
  if (!cleanQ) return [];

  // Deduplicate items while preserving original case and relative priority
  const uniqueMap = new Map<string, { original: string; priority: number }>();
  let idx = 0;
  for (const item of items) {
    if (!item) continue;
    const trimmed = item.trim();
    if (!trimmed) continue;
    const lower = trimmed.toLowerCase();
    if (!uniqueMap.has(lower)) {
      uniqueMap.set(lower, { original: trimmed, priority: idx++ });
    }
  }

  const prefixMatches: { original: string; priority: number }[] = [];
  const wordBoundaryMatches: { original: string; priority: number }[] = [];
  const substringMatches: { original: string; priority: number }[] = [];

  for (const [lower, entry] of uniqueMap.entries()) {
    if (lower.startsWith(cleanQ)) {
      prefixMatches.push(entry);
    } else {
      const words = lower.split(/[\s,/-]+/);
      const isWordBoundary = words.some((w) => w.startsWith(cleanQ));
      if (isWordBoundary) {
        wordBoundaryMatches.push(entry);
      } else if (lower.includes(cleanQ)) {
        substringMatches.push(entry);
      }
    }
  }

  // Sort prefix matches: exact match > canonical root prefix > priority
  prefixMatches.sort((a, b) => {
    const aLower = a.original.toLowerCase();
    const bLower = b.original.toLowerCase();
    if (aLower === cleanQ && bLower !== cleanQ) return -1;
    if (bLower === cleanQ && aLower !== cleanQ) return 1;

    // Canonical root comes before extended variants (e.g. "Google" before "Google Inc.")
    if (bLower.startsWith(aLower) && aLower.length !== bLower.length) return -1;
    if (aLower.startsWith(bLower) && aLower.length !== bLower.length) return 1;

    return a.priority - b.priority;
  });

  wordBoundaryMatches.sort((a, b) => a.priority - b.priority);
  substringMatches.sort((a, b) => a.priority - b.priority);

  const combined = [
    ...prefixMatches.map((m) => m.original),
    ...wordBoundaryMatches.map((m) => m.original),
    ...substringMatches.map((m) => m.original),
  ];
  return combined.slice(0, maxResults);
}

export function searchCompanies(
  query: string,
  additionalCompanies: string[] = [],
  maxResults = 8
): string[] {
  const all = [...TOP_COMPANIES, ...additionalCompanies];
  return rankAndFilterSuggestions(query, all, maxResults);
}

export function searchDesignations(
  query: string,
  additionalDesignations: string[] = [],
  maxResults = 8
): string[] {
  const all = [...TOP_DESIGNATIONS, ...additionalDesignations];
  return rankAndFilterSuggestions(query, all, maxResults);
}
