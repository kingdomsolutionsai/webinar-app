/**
 * One-time, carefully scoped repair for the already-queued October 20 webinar
 * follow-up campaigns. The owner approved the cleaned replay and supplied
 * this OneDrive viewing URL on October 20.
 *
 * This patches only existing queued campaigns by ID. It NEVER creates, sends,
 * suspends or reschedules a campaign, and retains their recipient lists.
 * Record the approved replay setting only after both updates succeed.
 */
import { getAllEventSettings, setEventSetting } from "./db";
import { planEventCampaigns } from "./brevo";

const APPROVED_REPLAY =
  "https://1drv.ms/v/c/52a392d9ed1526bd/IQAyFhABQY80Spv_wbSBTKMGAT92m5FiahsVIoPS3avWEvM?e=RXvtdI";
const EVENT_START = "2026-10-20T15:00:00.000Z";
const FLAG_KEY = "approvedReplaySyncOct20";
const TARGETS = [
  { key: "letter-4", id: 270, when: "2026-10-21T13:00:00.000Z" },
  { key: "fast-track-3", id: 272, when: "2026-10-25T15:00:00.000Z" },
] as const;

type BrevoCampaign = {
  id: number;
  status: string;
  scheduledAt: string;
  htmlContent: string;
  recipients: { lists: number[] };
};

async function brevoRequest(path: string, method: "GET" | "PUT", body?: object) {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) throw Error("BREVO_API_KEY is not configured");
  const response = await fetch("https://api.brevo.com/v3" + path, {
    method,
    headers: {
      "api-key": apiKey,
      accept: "application/json",
      ...(body ? { "content-type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(18000),
  });
  if (!response.ok) {
    const message = (await response.text()).slice(0, 220);
    throw Error("Brevo HTTP " + response.status + ": " + message);
  }
  if (response.status === 204) return null;
  return response.json();
}

export async function syncApprovedReplayOnce() {
  try {
    const settings = await getAllEventSettings();
    if (settings[FLAG_KEY] === APPROVED_REPLAY) {
      console.log("[Approved replay] Previously synchronized; no changes");
      return;
    }
    if (settings.replayUrl && settings.replayUrl !== APPROVED_REPLAY) {
      console.warn("[Approved replay] A different replay URL exists; no changes");
      return;
    }
    const registry = JSON.parse(settings.brevoCampaigns || "{}") as {
      eventStart?: string;
      items?: { key: string; id: number }[];
    };
    if (registry.eventStart !== EVENT_START ||
        TARGETS.some(t => registry.items?.find(x => x.key === t.key)?.id !== t.id)) {
      console.warn("[Approved replay] Campaign IDs changed; no changes");
      return;
    }
    const baseUrl = (settings.publicSiteUrl || "").replace(/\/+$/, "");
    if (!baseUrl.startsWith("https://whatentrepreneursneedtoknow.com")) {
      console.warn("[Approved replay] Unexpected site URL; no changes");
      return;
    }
    const updatedSettings = { ...settings, replayUrl: APPROVED_REPLAY };
    const prepared = planEventCampaigns({
      baseUrl,
      settings: updatedSettings,
      start: new Date(EVENT_START),
    });

    // The two campaigns that reference the recording, in the existing Fast
    // Track sequence. Other scheduled emails remain byte-for-byte unchanged.
    for (const target of TARGETS) {
      const campaign = await brevoRequest("/emailCampaigns/" + target.id, "GET") as BrevoCampaign;
      if (campaign.status !== "queued" ||
          !campaign.scheduledAt ||
          new Date(campaign.scheduledAt).toISOString() !== target.when ||
          campaign.recipients?.lists?.length !== 1 ||
          Number(campaign.recipients.lists[0]) !== 32) {
        throw Error("Campaign " + target.id + " not in the expected queued state; stopped");
      }
      const letter = prepared.find(p => p.key === target.key);
      if (!letter || !letter.html.includes(APPROVED_REPLAY)) {
        throw Error("Missing approved replay button in generated campaign " + target.id);
      }
      if (campaign.htmlContent.includes(APPROVED_REPLAY)) {
        console.log("[Approved replay] Already linked in campaign", target.id);
        continue;
      }
      await brevoRequest("/emailCampaigns/" + target.id, "PUT", {
        subject: letter.subject,
        htmlContent: letter.html,
      });
      const confirmed = await brevoRequest("/emailCampaigns/" + target.id, "GET") as BrevoCampaign;
      if (!confirmed.htmlContent.includes(APPROVED_REPLAY) ||
          confirmed.status !== "queued" ||
          new Date(confirmed.scheduledAt).toISOString() !== target.when) {
        throw Error("Post-update Brevo verification failed for campaign " + target.id);
      }
      console.log("[Approved replay] Updated and verified queued campaign", target.id);
    }
    await setEventSetting("replayUrl", APPROVED_REPLAY);
    await setEventSetting(FLAG_KEY, APPROVED_REPLAY);
    console.log("[Approved replay] Both campaigns linked, original scheduling preserved");
  } catch (error) {
    console.error(
      "[Approved replay] Synchronization incomplete:",
      error instanceof Error ? error.message : "Unknown error",
    );
  }
}
