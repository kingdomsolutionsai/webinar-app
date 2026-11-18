import { claimSequenceStep, finishSequenceStep, getAllEventSettings, releaseSequenceStep } from "./db";
import { sendEmail } from "./email";
import { buildDayBeforeReminder, buildFifteenBeforeReminder, buildHourBeforeReminder, upcomingSession } from "./reminders";
import { listSessionRegistrations, sessionKeyFor } from "./sessions";
import { unsubscribeUrl } from "./unsubscribe";

const reminders = [
  { minutes: 15, step: 3, build: buildFifteenBeforeReminder },
  { minutes: 60, step: 2, build: buildHourBeforeReminder },
  { minutes: 1440, step: 1, build: buildDayBeforeReminder },
];

export async function sendDueSessionReminders(now = new Date()) {
  const settings = await getAllEventSettings();
  const session = upcomingSession(settings, now);
  const key = sessionKeyFor(settings.date);
  if (!session?.joinUrl || !key || key <= "2026-11-17") return;
  const untilStart = session.start.getTime() - now.getTime();
  const due = reminders.find(reminder => untilStart <= reminder.minutes * 60_000);
  if (!due) return;
  const dueAt = session.start.getTime() - due.minutes * 60_000;
  // Isolate each dated session from legacy sequence steps and later events.
  const step = Number(key.replaceAll("-", "")) * 10 + due.step;
  const baseUrl = settings.publicSiteUrl || process.env.PUBLIC_URL || "https://whatentrepreneursneedtoknow.com";
  for (const row of await listSessionRegistrations(key)) {
    if (row.unsubscribedAt || row.createdAt.getTime() > dueAt) continue;
    if (!await claimSequenceStep(row.email, step)) continue;
    try {
      const optOut = unsubscribeUrl(baseUrl, row.email, key);
      const message = due.build({ ...session, firstName: row.firstName, baseUrl, unsubscribeUrl: optOut });
      const result = await sendEmail({ ...message, to: { email: row.email }, tags: ["webinar-reminder"] });
      if (result.ok) await finishSequenceStep(row.email, step, "sent", result.messageId);
      else await releaseSequenceStep(row.email, step);
    } catch (error) {
      await releaseSequenceStep(row.email, step);
      throw error;
    }
  }
}
