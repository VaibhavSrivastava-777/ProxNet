import { isSameCompany } from "../lib/jobs/job-filters";

function testMatching() {
  const companyName = "Stripe";
  const pramodCompany = "T";
  
  const cleanTarget = companyName.toLowerCase().trim();
  const oldMatch = isSameCompany(pramodCompany, companyName) ||
    (pramodCompany && cleanTarget.includes(pramodCompany.toLowerCase().trim())) ||
    (pramodCompany && pramodCompany.toLowerCase().trim().includes(cleanTarget));

  console.log("Old match for Pramod @ T on Stripe:", oldMatch);

  const newMatch = isSameCompany(pramodCompany, companyName);
  console.log("New safe match (isSameCompany only):", newMatch);

  console.log("isSameCompany('Google', 'Google LLC'):", isSameCompany('Google', 'Google LLC'));
  console.log("isSameCompany('Dell', 'Dell Technologies'):", isSameCompany('Dell', 'Dell Technologies'));
  console.log("isSameCompany('Eclerx', 'Eclerx'):", isSameCompany('Eclerx', 'Eclerx'));
  console.log("isSameCompany('Eclerx Services', 'Eclerx'):", isSameCompany('Eclerx Services', 'Eclerx'));
}

testMatching();
