# October 20 webinar: registration attribution

This change is **not** a web analytics or page-view tracker. It records the optional UTM campaign
values already present in a visitor's URL **at form submission** and makes them visible to the owner.
Untagged signups remain `Unknown`. Historic signups are not retroactively attributed.

## Platform-specific links

Use unique links in each platform's webinar post or comment:

- LinkedIn October 16:
  `https://whatentrepreneursneedtoknow.com/?utm_source=linkedin&utm_medium=organic_social&utm_campaign=webinar_oct20&utm_content=post_oct16`
- LinkedIn October 17:
  `https://whatentrepreneursneedtoknow.com/?utm_source=linkedin&utm_medium=organic_social&utm_campaign=webinar_oct20&utm_content=post_oct17`
- LinkedIn October 19:
  `https://whatentrepreneursneedtoknow.com/?utm_source=linkedin&utm_medium=organic_social&utm_campaign=webinar_oct20&utm_content=post_oct19`
- LinkedIn October 20:
  `https://whatentrepreneursneedtoknow.com/?utm_source=linkedin&utm_medium=organic_social&utm_campaign=webinar_oct20&utm_content=post_oct20`
- Facebook October 16 (example):
  `https://whatentrepreneursneedtoknow.com/?utm_source=facebook&utm_medium=organic_social&utm_campaign=webinar_oct20&utm_content=post_oct16`

**Important:** Existing Metricool posts publish the same first comment on LinkedIn and Facebook.
Do **not** replace the shared comment with a LinkedIn-specific link because that would
falsely label Facebook signups as LinkedIn. Use platform-specific comments/posts after
separating delivery, or use a truthful shared `utm_source=facebook_linkedin` tag.
Do not create duplicate scheduled campaigns.

## Owner reporting

- Dashboard registration attribution panel: tagged submissions, LinkedIn submissions,
  and LinkedIn-confirmed submissions (only `confirmedAt` qualifies).
- Dashboard per-registration signup source with full UTM metadata on hover.
- Owner CSV has source, medium, campaign, content and the actual confirmation timestamp.
- Pipeline CSV retains its import schema; factual UTM tags are appended to Notes,
  without guessing lead quality or changing Fit Score.

## Behavior and privacy

- Only four bounded campaign tags are accepted; no browser fingerprinting or arbitrary referrer URL.
- A repeat submission keeps the first non-null campaign tag per field.
- Email consent, confirmation, unsubscribes, reminder eligibility, and attendance handling remain unchanged.
- Older rows and untagged visits have unknown source. This does not measure landing-page visits,
  outbound post clicks, booked calls, or sales without additional instrumentation.

## Deployment checklist (not yet performed)

1. Review the PR and run `npm run check && npm test && npm run build`.
2. Confirm the production Render workspace and migration strategy before merging.
3. Apply `drizzle/0002_utm_attribution.sql` with the normal migration deploy process, preferably
   with a recent database backup. New app code needs the new nullable columns to exist.
4. Verify an untagged signup still works and does not auto-confirm.
5. Verify a tagged signup stores its origin; confirm only by clicking a legitimate opt-in email.
6. Check dashboard source/confirmed counts and CSV; verify no duplicate email or campaign sends.
7. Switch scheduled/promotional comments to verified platform-specific UTM URLs only
   after the application and schema are deployed.
