# Project TODO — Kingdom Solutions AI™ Webinar Registration

## Setup
- [x] Upload brand assets (crowned lion mark, book cover) via manus-upload-file --webdev
- [x] Configure Playfair Display + Montserrat fonts in client/index.html
- [x] Set brand palette CSS variables in client/src/index.css (black, gold, white, navy, bright green)
- [x] Add `registrations` and `eventSettings` tables to drizzle/schema.ts
- [x] Generate + apply migration SQL via webdev_execute_sql

## Backend
- [x] db.ts helpers: createRegistration, listRegistrations, getEventSettings, updateEventSettings
- [x] routers.ts: registration.create (public, validated, duplicate-safe)
- [x] routers.ts: registration.list (admin only)
- [x] routers.ts: registration.exportCsv (admin only)
- [x] routers.ts: settings.get (public) / settings.update (admin only)
- [x] Vitest: registration create validation + duplicate handling
- [x] Vitest: admin-only guard on list/export/settings.update
- [x] Vitest: CSV escaping + formula-injection neutralization

## Landing page
- [x] Hero: book cover, session title, byline "Tabitha Rector, Founder Kingdom Solutions AI™", DATE/TIME/DURATION/PRICE placeholders
- [x] Registration form: first name, last name, email with field-level validation
- [x] Confirmation state after successful registration (prompt slot present — AWAITING USER COPY)
- [x] Session highlights: eight parts of the book
- [x] Session highlights: three core takeaways
- [x] Session highlights: 50 fastest-growing industries feature
- [x] Founder's Table quotes section (Lincoln, Walton, Cathy, Walker, Blakely)
- [x] Three-reader routing module (pre-revenue / already serving / overwhelmed)
- [x] Crowned lion mark used as brand anchor throughout
- [x] Responsive layout verified at mobile width

## Owner dashboard
- [x] Login-protected route, no public access
- [x] Sortable table: name, email, signup date
- [x] One-click CSV export of all records
- [x] Editable event placeholders (DATE/TIME/DURATION/PRICE) without touching code
- [x] Track breakdown summary cards

## Verification
- [x] pnpm test passing (12/12)
- [x] TypeScript check clean
- [x] Screenshots reviewed desktop + mobile
- [x] Checkpoint saved

## Notes / open items
These two items are intentionally open and blocked on Tabitha's input. They are not
incomplete implementation work — the code paths for both are built and in place.

- [x] Prompt slot built into the confirmation panel, clearly marked as placeholder
      (AWAITING exact one-sentence exercise copy from Tabitha — must not be invented)
- [x] Registration capture + storage complete; email delivery intentionally deferred
      pending Tabitha's decision on Brevo vs an external webinar platform

## Evergreen waitlist mode
- [x] Build sample chapter PDF lead magnet from the book (14pp, branded, reuses book CSS verbatim)
- [x] Fix stacked-anchor defect on the sample closing plate
- [x] Upload sample chapter PDF as a static asset
- [x] Add date-aware mode detection: waitlist when [DATE] is still a placeholder
- [x] Hero switches copy/CTA between waitlist and scheduled states
- [x] Registration form copy adapts to waitlist vs scheduled
- [x] Confirmation panel offers sample chapter download in both states
- [x] Dashboard shows current page mode and explains the switch
- [x] Vitest coverage for mode detection logic (10 tests, incl. no-seat-language guard)
- [x] Verify both modes visually (desktop + mobile)
- [x] Fix dashboard empty-state copy that assumed scheduled mode

## Second lead magnet — Readiness Checklist (fillable PDF)
- [x] Build the readiness checklist as a fillable, branded PDF from Appendix F (8pp, 51 AcroForm fields)
- [x] Instantiate static font weights — ReportLab cannot read the variable fonts
- [x] Fix two label/field collisions found in visual QA (pages 5 and 7)
- [x] Upload the checklist PDF as a static asset
- [x] Add a second lead-magnet offer to the confirmation panel
- [x] Let visitors choose which magnet they want, and record the choice
- [x] Add `resource` column; thread through db, router, and CSV export
- [x] Show a "Wanted first" column in the owner dashboard
- [x] Vitest coverage for the magnet choice field (accepts valid, rejects invalid, appears in CSV)
- [x] Verify both magnets download correctly

## End-to-end verification (2026-08-10)
- [x] Both asset URLs return HTTP 200 `application/pdf` after redirect
      (chapter 6.06 MB, checklist 317 KB, both begin with `%PDF-`)
- [x] Submitted a real signup choosing "checklist" and another choosing "chapter";
      confirmed both rows stored the correct `resource` value in the database
- [x] Removed the two verification rows so the owner's list stays clean

## Automatic email on signup (Brevo)
- [x] Obtain BREVO_API_KEY via a secure secrets card
- [x] Validate the key against the live Brevo account endpoint (2 credential tests)
- [x] Confirm tabitha@kingdomsolutionsai.com is a verified, active sender
- [x] Add email service module with Brevo transactional send (`server/email.ts`)
- [x] Build the registrant email: both resource links + the full exercise prompt
- [x] Build the owner notification email, Reply-To set to the registrant
- [x] Send on signup without blocking or failing the registration
- [x] Record email send status per registration (`emailStatus`, `emailDetail`)
- [x] Vitest: 12 email tests — payload shape, sender identity, escaping, text part
- [x] Vitest: a provider failure still returns success to the visitor
- [x] Show delivery status in the owner dashboard ("Delivery" column)
- [x] Add email delivery status to the CSV export
- [x] Confirmation panel tells the registrant a copy is on its way
- [x] Verify a real send end to end — Brevo returned messageId
      `<202608101733.94016618158@smtp-relay.mailin.fr>`; test row then removed

## Logo in the email masthead
- [x] Move brand asset paths into shared/event.ts so the server can build absolute URLs
- [x] Pass an absolute logo URL into both the registrant and owner emails
- [x] Crowned lion mark centered above the gold wordmark, 56px with explicit dimensions
- [x] Keep the gold wordmark beneath it, so a blocked image still leaves a full masthead
- [x] Vitest: absolute src, alt text, explicit width/height, graceful no-logo fallback
- [x] Verify a real send with the logo — messageId
      `<202608101740.54281727916@smtp-relay.mailin.fr>`; test row then removed

## Publishing readiness (tasks 2-4)
- [x] Make the email logo resolve from a stable public URL, not the sandbox preview
- [x] Add a PUBLIC_SITE_URL setting so email links survive sandbox/production moves
- [x] Add unsubscribe: token-based opt-out link in the email footer
- [x] Add an `unsubscribedAt` column and suppress sending to opted-out addresses
- [x] Build a public unsubscribe confirmation page, no login required
- [x] Add a resend action in the dashboard for failed (or any) delivery
- [x] Vitest coverage for unsubscribe token, suppression, and resend authorization
- [x] Verify end to end, then hand off for publishing

## End-to-end verification of opt-out (2026-08-10)
- [x] Signed a real token, posted the opt-out, received `ok: true`
- [x] `unsubscribedAt` written to the row with a timestamp
- [x] Repeat signup for that address returned `emailed: false`, stored
      `emailStatus: skipped` with detail "Recipient has unsubscribed"
- [x] Unsubscribe page renders the branded confirmation with the lion mark
- [x] Dashboard row switched from "Delivered" to an "Opted out" badge
- [x] Verification row removed; the owner's list is clean
- [x] 64/64 tests passing, TypeScript clean

## Handoff to Tabitha (requires her action)
- [x] DONE, and better than proposed. The start.kingdomsolutionsai.com subdomain
      was never needed: Tabitha bound the purchased domain directly, so
      www.whatentrepreneursneedtoknow.com now serves the site rather than
      redirecting to a platform address.
- [x] Public web address saved as https://www.whatentrepreneursneedtoknow.com
- [x] The bare whatentrepreneursneedtoknow.com reaches the live site by GoDaddy
      301 forwarding to the www host, over https now that the certificate issued

## Download tracking
- [x] Add a `resourceDownloads` table: registration, resource, timestamp, user agent
- [x] Add a counted redirect route that records the open then serves the real file
- [x] Point the confirmation panel and both email links at the counted route
- [x] Keep the raw file URLs working, so an old email link never breaks
- [x] Show per-person download activity in the dashboard (what, and when)
- [x] Add downloaded/not-downloaded to the CSV export
- [x] Summary card: how many registrants actually opened something
- [x] Vitest: counting, de-duplication of rapid repeats, unknown ids, bad resource
- [x] Sign the counted link, so an open cannot be attributed to a forged address
- [x] Verified: signed click counted, forged click still served but not counted,
      rapid repeats collapsed to one, unknown resource refused with a 404

## Post-signup email sequence
- [x] Read the periodic-updates skill before writing any scheduled code
- [x] Add a `sequenceSends` table to track which email each person has received
- [x] Write email 1: the "something special is coming" note (day 2)
- [x] Write email 2: the exercise revisited (day 7)
- [x] Write email 3: the webinar announcement / date reveal (day 14)
- [x] Schedule dispatch relative to each person's signup date
- [x] Never send to an opted-out address; never send the same email twice
- [x] Owner control in the dashboard: pause or resume the sequence
- [x] Vitest: due-selection, suppression, idempotency, ordering
- [x] Unique index on (email, step) makes a duplicate letter impossible in the database
- [x] A provider failure releases the claim, so the letter retries instead of vanishing
- [x] Letter three adapts: invitation when a date is set, honest update when not
- [x] One letter per person per run, so a late signup is never flooded
- [x] Preview button sends any letter to Tabitha's own inbox without consuming a step
- [x] Cron endpoint at /api/scheduled/sequence is cron-only; a signed-in human gets 403
- [x] Verified with three real preview sends through Brevo
- [x] All verification rows removed; registrations, downloads and sends all at zero

## Correction
- [x] A test signup used the placeholder name "Track", which made a preview letter
      greet Tabitha by the wrong name. The row was mine, not a real registrant.
      Removed, and previews re-sent addressed correctly.

## Scheduler hookup (blocked until the site is published)
The dispatch endpoint is built, guarded and tested, but nothing calls it on a
timer yet. The platform's scheduler POSTs to the *deployed* address, so the cron
cannot be created against a dev sandbox — it must be registered after publishing.
- [x] Cron registered after publishing, task_uid fKhS79Y2DGwvJctSRwHU2M,
      "0 0 13 * * *" = 9am Eastern, enabled, POST /api/scheduled/sequence.
      Re-confirmed present and enabled. (The first actual execution is tracked as
      a separate open item below — registration is not the same as having run.)
- [x] "Send what is due" in the dashboard remains the manual equivalent and uses
      the identical code path

## Live launch (site published 2026-08-10)
- [x] Site published at https://webinarreg-wksscmbd.manus.space
- [x] Live routes verified: /, /unsubscribe, /dashboard all return 200
- [x] Scheduler endpoint verified live: refuses a non-cron caller with 403
- [x] Daily follow-up cron registered, task_uid fKhS79Y2DGwvJctSRwHU2M,
      "0 0 13 * * *" = 9am Eastern, enabled
- [x] Public web address saved as the published address, so email logo and
      download links resolve for recipients
- [x] Live signup test passed: row stored, email delivered through Brevo
- [x] BUG FOUND AND FIXED: the confirmation panel built its download links from
      the request host. In production that is an internal Cloud Run hostname, so
      a visitor clicking straight from the confirmation panel would have hit a
      link that cannot resolve outside the platform. The panel now uses the same
      saved public address the emails use. Regression test added.
- [x] All live test rows removed; registrations and downloads back to zero
- [x] Republished, and the fix confirmed live: confirmation links now carry the
      public address, and a real click returned the 14-page sample chapter
      (6.0 MB, valid PDF) and was recorded as one counted open
- [x] All verification rows removed again; registrations, downloads, sends and
      opt-outs all at zero
- [x] Scheduler re-confirmed REGISTERED and enabled (task_uid
      fKhS79Y2DGwvJctSRwHU2M, cron "0 0 13 * * *", POST /api/scheduled/sequence).
      This confirms the job exists, NOT that it has run.
- [x] Scheduler logs checked: `runs: []`, total 0. The job is registered and
      enabled but has not reached its first 13:00 UTC trigger yet, which is the
      expected state and not a fault.
- [ ] STILL GENUINELY OPEN (time-dependent, cannot be forced): after the next
      13:00 UTC, re-run `manus-heartbeat logs --task-uid fKhS79Y2DGwvJctSRwHU2M`
      and confirm the first execution succeeded. An empty send summary is a pass
      while the list is empty; what matters is that a run appears at all.
- [x] Webinar date set: Tuesday, September 15, 2026 at 10:00 AM - 12:00 PM ET.
      The entire page switched from waitlist to scheduled mode. Letters 4, 5, and 6
      are now armed and will fire based on the session date. Verified on the live
      site: the hero, buttons, copy and date display all updated automatically.
- [x] Final clean-state check before handoff: registrations 0, resourceDownloads
      0, sequenceSends 0. No test data of mine remains in the live database.
- [x] Handoff summary written to
      /home/ubuntu/deliverables/Post_Webinar_Bridge_Complete.md — the six-letter
      map, the three audit placements, the explicit list of what the system
      refuses to do and why, the two items only Tabitha can close, and the
      recommendation to run the AI-readiness material as a session before
      committing it to a second book

## Bugs reported from the live site
- [x] Signing in from /dashboard lands on the front page instead of the dashboard.
      Cause: the OAuth callback always redirects to "/" and discards where the
      person started. Fix: carry the origin path through the signed state and
      return there, with a strict same-site path check so the parameter cannot be
      used as an open redirect.
      Fixed and published. Eleven tests cover the behaviour plus each bypass:
      absolute URLs, "//host", backslash variants, header-splitting newlines and
      /api/ paths all collapse to "/".
- [x] Rollout confirmed live on both hosts: webinarreg-wksscmbd.manus.space and
      www.whatentrepreneursneedtoknow.com now serve the identical current bundle
      (index-DQ_YWOe_.js) containing the return-path logic. Worth noting the two
      hosts updated a couple of minutes apart, so an immediate re-test after any
      future publish can show stale behaviour on one address; a hard refresh or a
      short wait resolves it.
- [x] Diagnosed: the bare whatentrepreneursneedtoknow.com serves a registrar
      placeholder because two GoDaddy parking A records (76.223.105.230 and
      13.248.243.5) still answer for the apex. The www host is a CNAME to
      cname.manus.space and works correctly. A bare domain cannot be a CNAME by
      DNS rule, so the apex needs an A or ALIAS/ANAME record instead. Written up
      in /home/ubuntu/deliverables/GoDaddy_Apex_Domain_Fix.md, including why no
      raw IP should be hardcoded from a shared CDN range.
- [x] Resolved via GoDaddy domain forwarding rather than a DNS record. GoDaddy
      refuses a CNAME at the apex, correctly, and offers no ALIAS/ANAME type, so
      a 301 forward from the bare name to the www host was the right route. An
      A record pointing at the shared CDN IPs was deliberately NOT used: those
      addresses can be reassigned without notice, which would take the domain
      dark silently weeks later.
- [x] Verified: http://whatentrepreneursneedtoknow.com returns 301 to
      https://www.whatentrepreneursneedtoknow.com and the chain ends at 200.
      Apex A records now point at GoDaddy's forwarding service (3.33.152.147,
      15.197.142.173), which is expected for forwarding.
- [x] RESOLVED: the forwarding certificate has issued. https:// on the bare domain
      now completes a clean TLS handshake, returns 301 to the www host, and the
      chain ends at 200 serving the real page. Both spoken forms of the domain —
      with and without www, with and without https — now reach the live site, so
      the bare name is safe to say out loud and print.
- [x] Canonical address set to https://www.whatentrepreneursneedtoknow.com, which
      is correct because forwarding makes the www host the real destination.
      Verified with a live signup: both download links now carry the branded name,
      the email still delivered, and a real click returned the 14-page sample
      chapter (6.0 MB, valid PDF). Verification rows removed afterwards.
- [x] Explained the built-in .manus.space address: it remains the underlying home
      and the safety net if DNS ever breaks, but no registrant will see it now
      that the branded address is canonical. Advised against using "Edit URL",
      since that slug is embedded in links already sent.
- [x] Public web address updated so the email logo, both download links and the
      unsubscribe footer all carry the branded name.

## Handoff

## Pipeline export for the Lead Qualifier / Notion
Tabitha's qualifier pipeline uses these columns: Name, Email, Stage, Source,
Industry, Deal Size, Next Follow-Up, Last Contact, Notes, Fit Score.
- [x] Add a second export that matches those headers exactly, so registrants can be
      imported without retyping
- [x] Derive Stage from real signals only: "New lead", "Engaged" once something was
      actually opened, "Unsubscribed" if opted out. Never "Qualified" — that word
      belongs to Tabitha after a real conversation.
- [x] Leave Deal Size, Industry and Fit Score blank rather than guessing: Fit Score
      is the qualifier's own computed output and must not be faked upstream
- [x] Compose Notes from observed facts only — which resource they asked for, which
      track they selected in their own words, whether they opened anything
- [x] Keep the existing full CSV export unchanged for record-keeping; the dashboard
      now offers both, "For the pipeline" and "Export CSV"
- [x] Vitest coverage: 14 tests including header order, formula-injection
      neutralization, a guard that Notes never contains intent language, and a
      guard that Fit Score is never pre-filled. 130 tests passing overall.
- [x] Written publishing and domain guide delivered
      (/home/ubuntu/deliverables/Publishing_and_Domain_Setup.md), covering the
      publish-first order, the subdomain binding, the redirect for
      whatentrepreneursneedtoknow.com, post-launch checks and a troubleshooting table
- [x] Explained why the CNAME target cannot be stated in advance: Manus generates it
      per project at bind time, and a guessed value fails silently

## Exercise prompt copy (approved by Tabitha)
- [x] Add the approved "you are not afraid of hard work" line as a core promise band
- [x] Replace the placeholder exercise prompt with the full approved copy
- [x] Include the check question and the can't-write-it reframe
- [x] Vitest guard that no placeholder text remains on the page
- [x] Update waitlist copy so it offers two resources rather than the chapter alone

## Evergreen chapter-first promotion set
- [x] Write 10 LinkedIn + 6 Instagram/Facebook evergreen posts (no date required)
- [x] Write 2 emails, incl. the "something special is coming" note and the announcement
- [x] Document the 14-21 day chapter window then countdown handoff
## Capacity Leak Audit™ invitation (approved wording)
Link: https://www.kingdomsolutionsai.com/capacity-leak-audit
- [x] Add the audit invitation block to the confirmation panel, visibly secondary to
      the free resources so the downloads stay the point of that screen
- [x] Add the postscript to follow-up letter two only, never letter one — the first
      letter should give without asking for anything
- [x] Store the audit URL in shared config (AUDIT_INVITATION in shared/event.ts)
- [x] Wording is fixed and approved: "Six fields, no login" is accurate (it is a form,
      not an account). No free claim, no countdown, no promise of what it will find
- [x] Vitest coverage: 9 tests asserting the invitation is in letter two only, absent
      from letters one and three, and that the wording never claims free, never
      invents urgency, and never promises a particular finding. 139 tests passing.
- [x] Letter two sent as a real preview through Brevo; the audit URL was asserted
      present in the generated HTML and Brevo accepted the send. This proves
      generation and delivery, NOT rendering.
- [ ] STILL OPEN: open the letter-two preview in your inbox and confirm the P.S.
      is visible and the link works. Email clients rewrite HTML in ways no test can
      predict, so only a human can verify rendering.
- [x] Both variants of the morning-after letter sent as real previews (with and
      without a replay link) so the two versions can be compared side by side
## Replay / morning-after email (letter four)
Sent the morning after the session. Attendance is never complete, so this is the
letter that recovers the people who meant to be there.
- [x] Add a fourth letter that is triggered by the event date, not by signup age —
      unlike letters 1-3, this one is anchored to the session
- [x] It must adapt honestly to whether a replay link exists: with one it offers the
      recording, without one it restates the exercise and never implies a recording
      that does not exist
- [x] Add an owner-editable "Replay link" setting to the dashboard
- [x] Restate the one-sentence exercise in full, since that is the single action the
      session asked for
- [x] Carry the audit invitation, since the morning after is when "what do I fix
      first" is most alive
- [x] Never send before the session has actually happened (14h gate after start; an
      unparseable or placeholder date is never treated as past)
- [x] Send once per person only, using the same ledger as letters 1-3
- [x] Vitest coverage: 13 tests for date gating, the no-replay-link case, no shaming
      language, and no double sends. 152 tests passing.
- [x] Dashboard row for letter four with its own status badges (waiting for a date /
      replay link set / no replay link) and a preview button
## Post-webinar follow-up (letters five and six)
The morning-after letter recovers the no-shows. These two carry the people who
did attend from motivation into a decision, without pressure.
- [x] Letter five, three days after the session: the objection letter. Names the
      reason people stall — not knowing what to fix first — and answers it
- [x] Letter six, seven days after the session: the last word. Closes the arc,
      makes the audit invitation plainly, and does not ask again after this
- [x] Both anchored to the event date like letter four, not to signup age, via a
      shared selectEventAnchoredStep() gate
- [x] Both gated on the session having actually happened, and on the replay letter
      having actually gone first (they refer back to a session she could have seen)
- [x] Letter six is genuinely the final letter — no endless nurture on
      an audience of depleted women. The list goes quiet after this unless she
      chooses to write again.
- [x] IMPORTANT SUBTLETY CAUGHT IN TESTING: once letter six has gone, ALL sending
      stops for that person, including signup letters 1-3 that may still be
      outstanding. Without this, someone who joined days before the session would
      receive "the last letter" and then a cheerful day-2 letter afterwards —
      making a promise and breaking it three days later.
- [x] Letter five explicitly excuses the person who has already started, so it
      cannot insult someone further along than it assumes
- [x] Vitest coverage: 14 tests for ordering, date gating, replay-first ordering,
      finality, no double sends, and no shaming language. 166 tests passing.

## Webinar date locked in (2026-08-10)
- [x] Tabitha confirmed Tuesday, September 15, 2026 at 10:00 AM ET
- [x] Updated eventSettings: date, time, duration all set
- [x] Verified on live site: page switched from waitlist to scheduled mode
- [x] Letters 4, 5, 6 now armed and will fire based on the session date

## Post-handoff documentation
- [x] Created What_The_Scheduler_Is.md — plain-language explanation of the daily
      cron job that sends follow-up emails, why it matters, and what Tabitha needs
      to do with it (nothing — it just runs)

## Expansion: Promo Content, Lead Gen & AI Readiness Book (2026-08-10)
- [x] Phase 1: Requirements gathering for promo strategy (LinkedIn, Facebook, Instagram, teacher tone)
- [x] Phase 2: Scroll-stopping social content created (/home/ubuntu/deliverables/Scroll_Stopping_Promo_Suite.md)
- [x] Phase 3: Pre-webinar and nurture email sequences created (/home/ubuntu/deliverables/Pre_Webinar_Email_Sequences.md)
- [x] Phase 4: Lead Qualifier pipeline integration guide created (/home/ubuntu/deliverables/Lead_Qualifier_Pipeline_Integration.md)
- [x] Phase 5: AI Readiness session strategy and book outline created (/home/ubuntu/deliverables/AI_Readiness_Session_And_Book_Strategy.md)
- [x] Phase 2: Created scroll-stopping promotional suite for LinkedIn, Instagram, and Facebook (/home/ubuntu/deliverables/Scroll_Stopping_Promo_Suite.md), bridging Revived Spirit heritage into Kingdom Solutions AI™ with authority-driven, empathy-led copy.
- [x] Phase 3: Created pre-webinar announcement and nurture email sequences (/home/ubuntu/deliverables/Pre_Webinar_Email_Sequences.md) written in Tabitha's teacher voice (professional, relatable, faith-aligned, empathetic).
- [x] Phase 4: Created Lead Qualifier pipeline integration guide (/home/ubuntu/deliverables/Lead_Qualifier_Pipeline_Integration.md) documenting both CSV export formats, the stage logic, why certain columns are intentionally blank, and the full import workflow into Notion.
- [x] Phase 5: Created AI Readiness session strategy and book outline (/home/ubuntu/deliverables/AI_Readiness_Session_And_Book_Strategy.md) outlining the live workshop model, the five levels of adoption, and the chapter-by-chapter roadmap for Volume Two of the Emerging Entrepreneur Series.

## Daily Posting Schedule (2026-08-10)
- [x] Created detailed day-by-day posting calendar (/home/ubuntu/deliverables/Daily_Posting_Schedule_Aug18_Sept14.md) for LinkedIn and Facebook: 3x/week starting Tuesday, August 18 at 11am ET, rotating through video, carousel, book cover, and lion mark visuals. Includes copy-paste-ready posts and visual asset checklist.

## Capacity Leak Audit™ Page Redesign (2026-08-11)
- [x] Created detailed redesign specification (/home/ubuntu/deliverables/Capacity_Leak_Audit_Page_Redesign.md) matching the Constance and Clarity Pro design system: black hero with gold accents, asymmetric layout, numbered diagnostic framework, and consistent typography and color palette.
- [x] Added smooth hover effects to diagnostic framework blocks: 8px slide-in animation, gold left border, number/title color change, subtle shadow lift, and faint gold background tint. Includes CSS implementation, accessibility support (prefers-reduced-motion), and keyboard focus states.
