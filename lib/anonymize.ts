import type { User } from "./types";

export function companyLogoUrl(company: string, storedUrl?: string | null): string {
  if (!company) return "";
  const name = company.trim().toLowerCase();

  const mappings: Record<string, string> = {
    // Global Tech & Internet
    google: "google.com",
    alphabet: "google.com",
    microsoft: "microsoft.com",
    apple: "apple.com",
    meta: "meta.com",
    facebook: "meta.com",
    netflix: "netflix.com",
    amazon: "amazon.com",
    uber: "uber.com",
    lyft: "lyft.com",
    stripe: "stripe.com",
    airbnb: "airbnb.com",
    salesforce: "salesforce.com",
    adobe: "adobe.com",
    twitter: "x.com",
    x: "x.com",
    github: "github.com",
    gitlab: "gitlab.com",
    oracle: "oracle.com",
    intel: "intel.com",
    nvidia: "nvidia.com",
    ibm: "ibm.com",
    cisco: "cisco.com",
    zoom: "zoom.us",
    slack: "slack.com",
    spotify: "spotify.com",
    figma: "figma.com",
    canva: "canva.com",
    openai: "openai.com",
    anthropic: "anthropic.com",
    supabase: "supabase.com",
    vercel: "vercel.com",
    linkedin: "linkedin.com",
    tesla: "tesla.com",
    spacex: "spacex.com",
    pinterest: "pinterest.com",
    reddit: "reddit.com",
    tiktok: "tiktok.com",
    bytedance: "bytedance.com",

    // Major Tech & IT presence in Bangalore
    accenture: "accenture.com",
    tcs: "tcs.com",
    "tata consultancy services": "tcs.com",
    infosys: "infosys.com",
    wipro: "wipro.com",
    cognizant: "cognizant.com",
    capgemini: "capgemini.com",
    dell: "dell.com",
    sap: "sap.com",
    flipkart: "flipkart.com",
    myntra: "myntra.com",
    swiggy: "swiggy.com",
    zomato: "zomato.com",
    ola: "olacabs.com",
    samsung: "samsung.com",
    hp: "hp.com",
    "hewlett packard": "hp.com",
    vmware: "vmware.com",
    intuit: "intuit.com",
    "goldman sachs": "goldmansachs.com",
    target: "target.com",
    walmart: "walmart.com",
    huawei: "huawei.com",
    nokia: "nokia.com",
    ericsson: "ericsson.com",
    siemens: "siemens.com",
    qualcomm: "qualcomm.com",
    "texas instruments": "ti.com",
    netapp: "netapp.com",
    juniper: "juniper.net",
    "juniper networks": "juniper.net",
    paypal: "paypal.com",
    "morgan stanley": "morganstanley.com",
    mcafee: "mcafee.com",
    razorpay: "razorpay.com",
    cred: "cred.club",
    phonepe: "phonepe.com",
    paytm: "paytm.com",
    inmobi: "inmobi.com",
    zerodha: "zerodha.com",
    meesho: "meesho.com",
    freshworks: "freshworks.com",
    zoho: "zoho.com",
    browserstack: "browserstack.com",
    cleartrip: "cleartrip.com",
    makemytrip: "makemytrip.com",
    atlassian: "atlassian.com",
    nutanix: "nutanix.com",
    rubrik: "rubrik.com",
    gojek: "gojek.com",
    grab: "grab.com",
    amadeus: "amadeus.com",
    epsilon: "epsilon.com",
    visa: "visa.com",
    mastercard: "mastercard.com",
    "american express": "americanexpress.com",
    amex: "americanexpress.com",
    bosch: "bosch.com",
    "jpmorgan chase": "jpmorganchase.com",
    jpmorgan: "jpmorgan.com",
    wellsfargo: "wellsfargo.com",
    "wells fargo": "wellsfargo.com",
    "standard chartered": "sc.com",
    citibank: "citi.com",
    citi: "citi.com",
    hsbc: "hsbc.com",
    barclays: "barclays.com",
  };

  if (name.includes(".") && !name.startsWith(".") && !name.endsWith(".")) {
    return `https://logos.hunter.io/${name}`;
  }

  const cleanName = name
    .replace(/\b(inc|corp|co|ltd|gmbh|llc|plc|corporation|incorporated|limited|technologies|solutions|systems|labs|software)\b/gi, "")
    .trim()
    .toLowerCase();

  const domain = mappings[cleanName] || mappings[name] || `${cleanName.replace(/[^a-z0-9]/g, "")}.com`;
  return `https://logos.hunter.io/${domain}`;
}

export function generateAlias(role: "resident" | "professional", index: number, company?: string | null): string {
  const label = role === "resident" ? "Resident" : "Professional";
  if (company) {
    // Normalise: title-case the first word of the company name
    const shortName = company.trim().split(/[\s,]/)[0];
    const formatted = shortName.charAt(0).toUpperCase() + shortName.slice(1).toLowerCase();
    return `${label}@${formatted}`;
  }
  return `${label}-${index}`;
}

export function resolveUserLocation(
  user: User,
  currentLat?: number | null,
  currentLng?: number | null
): { lat: number; lng: number } | null {
  if (user.active_location === "home" && user.home_lat != null && user.home_lng != null) {
    return { lat: Number(user.home_lat), lng: Number(user.home_lng) };
  }
  if (user.active_location === "office" && user.office_lat != null && user.office_lng != null) {
    return { lat: Number(user.office_lat), lng: Number(user.office_lng) };
  }
  if (currentLat != null && currentLng != null) {
    return { lat: currentLat, lng: currentLng };
  }
  if (user.home_lat != null && user.home_lng != null) {
    return { lat: Number(user.home_lat), lng: Number(user.home_lng) };
  }
  return null;
}
