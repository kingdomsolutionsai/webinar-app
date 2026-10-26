import { describe, expect, it } from "vitest";
import { buildRegistrantEmail } from "./email";
import { planEventCampaigns, syncRegistrantToBrevo, type BrevoIO } from "./brevo";
import { buildFifteenBeforeReminder } from "./reminders";

const start = new Date("2026-11-17T16:00:00.000Z"); // 11 AM EST

describe("Finding the Gap funnel", () => {
  it("includes the chapter gift and Zoom details in the post-confirmation email", () => {
    const message = buildRegistrantEmail({
      firstName: "Example",
      baseUrl: "https://whatentrepreneursneedtoknow.com",
      sessionOnly: true,
      trackedUrls: { chapter: "https://whatentrepreneursneedtoknow.com/api/download?r=chapter&test=1" },
      seat: {
        when: "Tuesday, November 17, 2026 at 11 AM Eastern",
        html: "<tr><td>Join on Zoom: https://zoom.example/j/1234567890</td></tr>",
        text: ["Join on Zoom: https://zoom.example/j/1234567890"],
      },
    });
    expect(message.subject).toContain("Zoom link and gift");
    expect(message.html).toContain("Finding the Gap");
    expect(message.html).toContain("Download Part One");
    expect(message.html).toContain("https://zoom.example/j/1234567890");
    expect(message.html).not.toContain("Download the First-Sale Readiness Checklist");
  });

  it("includes a readable Zoom link and backup details in the 15-minute reminder", () => {
    const result = buildFifteenBeforeReminder({
      firstName: "Example",
      baseUrl: "https://whatentrepreneursneedtoknow.com",
      start,
      durationMinutes: 60,
      joinUrl: "https://us06web.zoom.us/j/1234567890",
      passcode: "test-code",
    });
    expect(result.subject).toContain("15 minutes");
    expect(result.text).toContain("https://us06web.zoom.us/j/1234567890");
    expect(result.html).toContain("Join the webinar now");
  });

  it("schedules the final reminder 15 minutes before the active session", () => {
    const campaigns = planEventCampaigns({
      baseUrl: "https://whatentrepreneursneedtoknow.com",
      settings: {
        date: "Tuesday, November 17, 2026",
        time: "11:00 AM",
        duration: "60 minutes",
        joinUrl: "https://us06web.zoom.us/j/1234567890",
        zoomPasscode: "test-code",
      },
      start,
    });
    const last = campaigns.find(campaign => campaign.key === "reminder-fifteen");
    expect(last).toBeDefined();
    expect(last!.at.toISOString()).toBe("2026-11-17T15:45:00.000Z");
    expect(last!.html).toContain("https://us06web.zoom.us/j/1234567890");
    expect(campaigns.some(campaign => campaign.key === "reminder-ten")).toBe(false);
  });
  it("never syncs a new session contact to the legacy audience when its list is missing", async () => {
    const io: BrevoIO = {
      apiKey: "test-key",
      fetcher: (async () => { throw new Error("Must not contact Brevo"); }) as typeof fetch,
      getSettings: async () => ({ date: "Tuesday, November 17, 2026" }),
      setSetting: async () => { throw new Error("Must not write settings"); },
      listRegistrations: async () => { throw new Error("Must not read legacy registrations"); },
      listDownloads: async () => { throw new Error("Must not read legacy downloads"); },
      now: () => new Date("2026-10-26T16:00:00.000Z"),
    };
    const result = await syncRegistrantToBrevo("example@example.com", io);
    expect(result).toEqual({ ok: false, skipped: "current event list not configured" });
  });

});
