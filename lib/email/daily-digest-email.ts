import { DailyDigestReport } from "../admin-digest";

/**
 * Builds an executive-grade, mobile-responsive HTML email for the Daily Administrative Digest
 */
export function buildDailyDigestEmailHtml(report: DailyDigestReport): { subject: string; html: string } {
  const { dateStr, companyMetrics, goodIndicators, badIndicators } = report;
  const totalTrackedCompanies = companyMetrics.totalNetworkCompanies + companyMetrics.totalCompetitorCompanies;
  const totalIncremental = companyMetrics.incrementalNetworkCompanies + companyMetrics.incrementalCompetitors;

  const subject = `📊 ProxNet Daily Pulse — ${dateStr} | Network Growth & Diagnostics`;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; -webkit-font-smoothing: antialiased;">

  <!-- Outer Container -->
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f1f5f9; padding: 24px 12px;">
    <tr>
      <td align="center">
        <!-- Main Card -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 660px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.01); border: 1px solid #e2e8f0;">

          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 32px 28px; text-align: left; border-bottom: 3px solid #0A66C2;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td>
                    <span style="display: inline-block; background-color: rgba(10, 102, 194, 0.25); color: #38bdf8; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.2px; padding: 4px 10px; border-radius: 9999px; margin-bottom: 8px;">
                      Executive Morning Digest
                    </span>
                    <h1 style="margin: 4px 0 0 0; color: #ffffff; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">
                      ProxNet Daily Pulse
                    </h1>
                    <p style="margin: 6px 0 0 0; color: #94a3b8; font-size: 14px;">
                      Activity & Health Report for <strong>${dateStr}</strong> (Previous Day IST)
                    </p>
                  </td>
                  <td align="right" style="vertical-align: top;">
                    <div style="background-color: #1e293b; border: 1px solid #334155; border-radius: 10px; padding: 8px 12px; text-align: right;">
                      <div style="color: #64748b; font-size: 10px; font-weight: 600; text-transform: uppercase;">Timezone</div>
                      <div style="color: #38bdf8; font-size: 12px; font-weight: 700;">IST (UTC+5:30)</div>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Summary KPI Strip -->
          <tr>
            <td style="background-color: #f8fafc; padding: 20px 24px; border-bottom: 1px solid #e2e8f0;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <!-- KPI 1 -->
                  <td width="25%" style="text-align: center; border-right: 1px solid #e2e8f0; padding: 0 8px;">
                    <div style="color: #64748b; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Network Orgs</div>
                    <div style="color: #0f172a; font-size: 22px; font-weight: 800; margin-top: 4px;">${companyMetrics.totalNetworkCompanies}</div>
                    <div style="color: #059669; font-size: 11px; font-weight: 700; margin-top: 2px;">+${companyMetrics.incrementalNetworkCompanies} today</div>
                  </td>
                  <!-- KPI 2 -->
                  <td width="25%" style="text-align: center; border-right: 1px solid #e2e8f0; padding: 0 8px;">
                    <div style="color: #64748b; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Competitors</div>
                    <div style="color: #0f172a; font-size: 22px; font-weight: 800; margin-top: 4px;">${companyMetrics.totalCompetitorCompanies}</div>
                    <div style="color: #64748b; font-size: 11px; font-weight: 600; margin-top: 2px;">${totalTrackedCompanies} total</div>
                  </td>
                  <!-- KPI 3 -->
                  <td width="25%" style="text-align: center; border-right: 1px solid #e2e8f0; padding: 0 8px;">
                    <div style="color: #64748b; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Jobs Scraped</div>
                    <div style="color: #0f172a; font-size: 22px; font-weight: 800; margin-top: 4px;">${goodIndicators.jobsScrapedYesterday}</div>
                    <div style="color: #64748b; font-size: 11px; font-weight: 600; margin-top: 2px;">${companyMetrics.totalCompaniesWithJobs} live orgs</div>
                  </td>
                  <!-- KPI 4 -->
                  <td width="25%" style="text-align: center; padding: 0 8px;">
                    <div style="color: #64748b; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Referrals</div>
                    <div style="color: #0f172a; font-size: 22px; font-weight: 800; margin-top: 4px;">${goodIndicators.referralThreadsCount}</div>
                    <div style="color: #0A66C2; font-size: 11px; font-weight: 700; margin-top: 2px;">${goodIndicators.referralMessagesCount} msgs</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Content Body -->
          <tr>
            <td style="padding: 28px 24px;">

              <!-- ============================================================== -->
              <!-- 🟢 GOOD LEADING INDICATORS -->
              <!-- ============================================================== -->
              <div style="margin-bottom: 28px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 14px;">
                  <tr>
                    <td>
                      <span style="display: inline-block; background-color: #ecfdf5; color: #059669; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.8px; padding: 4px 10px; border-radius: 6px; border: 1px solid #a7f3d0;">
                        🟢 Good Leading Indicators
                      </span>
                    </td>
                    <td align="right">
                      <span style="color: #059669; font-size: 13px; font-weight: 700;">
                        ${goodIndicators.newSignupsCount} New Members &bull; ${goodIndicators.pioneerBountiesCount} Pioneers
                      </span>
                    </td>
                  </tr>
                </table>

                <!-- Good Metrics Cards Grid -->
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 16px;">
                  <tr>
                    <td width="50%" style="padding-right: 6px;">
                      <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 14px;">
                        <div style="color: #166534; font-size: 12px; font-weight: 700;">New User Onboarding</div>
                        <div style="color: #15803d; font-size: 24px; font-weight: 800; margin: 4px 0;">+${goodIndicators.newSignupsCount}</div>
                        <div style="color: #4ade80; font-size: 12px; color: #166534;">Verified professionals joined ProxNet</div>
                      </div>
                    </td>
                    <td width="50%" style="padding-left: 6px;">
                      <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 14px;">
                        <div style="color: #166534; font-size: 12px; font-weight: 700;">Pioneer Companies Unlocked</div>
                        <div style="color: #15803d; font-size: 24px; font-weight: 800; margin: 4px 0;">${companyMetrics.incrementalNetworkCompanies}</div>
                        <div style="color: #4ade80; font-size: 12px; color: #166534;">1st-time orgs added to network (+10 pts)</div>
                      </div>
                    </td>
                  </tr>
                </table>

                ${
                  goodIndicators.newSignups.length > 0
                    ? `
                <!-- Signups List -->
                <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px; margin-bottom: 14px;">
                  <div style="font-size: 12px; font-weight: 700; color: #334155; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px;">Recent Member Arrivals</div>
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                    ${goodIndicators.newSignups
                      .slice(0, 5)
                      .map(
                        (s) => `
                    <tr>
                      <td style="padding: 6px 0; border-bottom: 1px solid #f1f5f9; font-size: 13px; color: #0f172a; font-weight: 600;">
                        ${s.name}
                      </td>
                      <td style="padding: 6px 0; border-bottom: 1px solid #f1f5f9; font-size: 13px; color: #64748b;">
                        ${s.title} &bull; <strong style="color: #0A66C2;">${s.company}</strong>
                      </td>
                      <td align="right" style="padding: 6px 0; border-bottom: 1px solid #f1f5f9; font-size: 12px; font-weight: 700; color: #059669;">
                        ${s.wallet} credits
                      </td>
                    </tr>
                    `
                      )
                      .join("")}
                  </table>
                </div>
                `
                    : `
                <div style="background-color: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 8px; padding: 12px; text-align: center; color: #64748b; font-size: 13px; margin-bottom: 14px;">
                  No new user signups recorded during this 24-hour cycle.
                </div>
                `
                }

                ${
                  companyMetrics.newCompanyNames.length > 0
                    ? `
                <!-- New Companies Pill Box -->
                <div style="background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 10px; padding: 12px 14px; margin-bottom: 14px;">
                  <span style="font-size: 12px; font-weight: 700; color: #065f46; text-transform: uppercase;">🏆 Pioneer Companies Unlocked Yesterday:</span>
                  <div style="margin-top: 6px;">
                    ${companyMetrics.newCompanyNames
                      .map(
                        (c) =>
                          `<span style="display: inline-block; background-color: #d1fae5; color: #047857; font-size: 12px; font-weight: 600; padding: 3px 8px; border-radius: 4px; margin: 2px 4px 2px 0;">${c}</span>`
                      )
                      .join("")}
                  </div>
                </div>
                `
                    : ""
                }

                <!-- Job Scrape Highlights -->
                <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px;">
                  <div style="font-size: 12px; font-weight: 700; color: #334155; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px;">Job Ingestion Velocity</div>
                  <div style="font-size: 13px; color: #475569;">
                    Ingested <strong>${goodIndicators.jobsScrapedYesterday}</strong> fresh opportunities yesterday across ProxNet and competitor companies.
                    ${
                      goodIndicators.topJobCompanies.length > 0
                        ? ` Top contributors: ${goodIndicators.topJobCompanies
                            .map((tc) => `<strong>${tc.company}</strong> (${tc.count})`)
                            .join(", ")}.`
                        : ""
                    }
                  </div>
                </div>
              </div>


              <!-- ============================================================== -->
              <!-- 🔴 BAD LEADING INDICATORS & BOTTLENECKS -->
              <!-- ============================================================== -->
              <div style="border-top: 2px dashed #e2e8f0; padding-top: 24px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 14px;">
                  <tr>
                    <td>
                      <span style="display: inline-block; background-color: #fef2f2; color: #dc2626; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.8px; padding: 4px 10px; border-radius: 6px; border: 1px solid #fecaca;">
                        🔴 Bad Leading Indicators & Action Required
                      </span>
                    </td>
                    <td align="right">
                      <span style="color: #dc2626; font-size: 13px; font-weight: 700;">
                        ${badIndicators.stalledThreadsCount} Stalled &bull; ${badIndicators.uncoveredDemandCount} Uncovered Orgs
                      </span>
                    </td>
                  </tr>
                </table>

                <!-- Stalled Referral Requests -->
                ${
                  badIndicators.stalledThreads.length > 0
                    ? `
                <div style="background-color: #fff1f2; border: 1px solid #fecdd3; border-radius: 10px; padding: 14px; margin-bottom: 14px;">
                  <div style="color: #9f1239; font-size: 13px; font-weight: 700; margin-bottom: 6px;">
                    ⚠️ Stalled Referral Requests (>24h without response)
                  </div>
                  <div style="color: #881337; font-size: 12px; margin-bottom: 10px;">
                    Candidates are waiting for an insider referral reply. Immediate nudge recommended to protect conversion:
                  </div>
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                    ${badIndicators.stalledThreads
                      .map(
                        (st) => `
                    <tr>
                      <td style="padding: 4px 0; font-size: 12px; color: #9f1239; font-weight: 600;">
                        ${st.role} @ <strong>${st.company}</strong>
                      </td>
                      <td align="right" style="padding: 4px 0; font-size: 12px; color: #e11d48; font-weight: 700;">
                        Waiting ${st.waitingHours} hours
                      </td>
                    </tr>
                    `
                      )
                      .join("")}
                  </table>
                </div>
                `
                    : `
                <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 10px 14px; font-size: 12px; color: #166534; font-weight: 600; margin-bottom: 14px;">
                  ✨ Zero stalled referral requests! All active threads have active responses.
                </div>
                `
                }

                <!-- Uncovered Referral Demand -->
                ${
                  badIndicators.uncoveredCompanies.length > 0
                    ? `
                <div style="background-color: #fffbeb; border: 1px solid #fef3c7; border-radius: 10px; padding: 14px; margin-bottom: 14px;">
                  <div style="color: #92400e; font-size: 13px; font-weight: 700; margin-bottom: 4px;">
                    🎯 Uncovered Referral Demand (Pioneer Bounty Opportunities)
                  </div>
                  <div style="color: #b45309; font-size: 12px; margin-bottom: 8px;">
                    Users have placed demand for these companies, but ProxNet has 0 verified professionals from them yet:
                  </div>
                  <div>
                    ${badIndicators.uncoveredCompanies
                      .map(
                        (uc) =>
                          `<span style="display: inline-block; background-color: #fef3c7; color: #92400e; border: 1px solid #fde68a; font-size: 12px; font-weight: 600; padding: 3px 8px; border-radius: 4px; margin: 2px 4px 2px 0;">${uc.company} (${uc.seekersCount} seeker${uc.seekersCount > 1 ? "s" : ""})</span>`
                      )
                      .join("")}
                  </div>
                </div>
                `
                    : ""
                }

                <!-- Scraper Diagnostic & Health Warnings -->
                ${
                  badIndicators.failedCompanies.length > 0
                    ? `
                <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px; margin-bottom: 14px;">
                  <div style="color: #334155; font-size: 13px; font-weight: 700; margin-bottom: 6px;">
                    🔧 ATS Scraping Health Warnings (${badIndicators.failedCompanies.length} boards)
                  </div>
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                    ${badIndicators.failedCompanies
                      .slice(0, 5)
                      .map(
                        (fc) => `
                    <tr>
                      <td style="padding: 4px 0; font-size: 12px; color: #0f172a; font-weight: 600;">
                        ${fc.company} <span style="color: #64748b; font-weight: 400;">(${fc.provider})</span>
                      </td>
                      <td align="right" style="padding: 4px 0; font-size: 11px; color: #ef4444; font-weight: 600;">
                        ${fc.notes}
                      </td>
                    </tr>
                    `
                      )
                      .join("")}
                  </table>
                </div>
                `
                    : ""
                }

                <!-- Incomplete Signups Drop-off -->
                ${
                  badIndicators.incompleteUsers.length > 0
                    ? `
                <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px; font-size: 12px; color: #64748b;">
                  <strong>Profile Drop-off Notice:</strong> ${badIndicators.incompleteUsers.length} user(s) signed up yesterday with incomplete details:
                  ${badIndicators.incompleteUsers
                    .map((iu) => `${iu.name} (Missing: ${iu.missing.join(", ")})`)
                    .join("; ")}.
                </div>
                `
                    : ""
                }
              </div>

              <!-- CTA Button -->
              <div style="margin-top: 32px; text-align: center;">
                <a href="https://www.proxnet.in/admin" style="display: inline-block; background-color: #0A66C2; color: #ffffff; font-size: 14px; font-weight: 700; text-decoration: none; padding: 12px 28px; border-radius: 9999px; box-shadow: 0 4px 6px -1px rgba(10, 102, 194, 0.2);">
                  Open ProxNet Admin Console &rarr;
                </a>
              </div>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 24px; text-align: center; border-top: 1px solid #e2e8f0; color: #94a3b8; font-size: 12px; line-height: 1.6;">
              <div style="font-weight: 700; color: #475569; margin-bottom: 4px;">ProxNet Operations &bull; Automated Daily Briefing</div>
              <div>Delivered daily at 8:00 AM IST to <strong>ProxNet.Connect@Gmail.com</strong> via Resend API.</div>
              <div style="margin-top: 8px; color: #cbd5e1; font-size: 11px;">
                Generated at ${new Date().toISOString()} &bull; ProxNet Neighborhood Professional Network
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>
  `.trim();

  return { subject, html };
}
