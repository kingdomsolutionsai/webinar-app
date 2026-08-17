import { describe, expect, it } from "vitest";
import {
  buildNotes,
  deriveStage,
  PIPELINE_HEADERS,
  toPipelineCsv,
  type PipelineRow,
} from "./pipelineExport";

const base: PipelineRow = {
  firstName: "Ada",
  lastName: "Bennett",
  email: "ada@example.com",
  track: "serving_clients",
  resource: "both",
  createdAt: new Date("2026-08-10T14:30:00Z"),
  opened: [],
};

describe("pipeline export headers", () => {
  it("matches the qualifier's column order exactly, so import needs no mapping", () => {
    expect(PIPELINE_HEADERS).toEqual([
      "Name",
      "Email",
      "Stage",
      "Source",
      "Industry",
      "Deal Size",
      "Next Follow-Up",
      "Last Contact",
      "Notes",
      "Fit Score",
    ]);
  });

  it("emits the header row first", () => {
    const csv = toPipelineCsv([base]);
    expect(csv.split("\r\n")[0]).toBe(
      '"Name","Email","Stage","Source","Industry","Deal Size","Next Follow-Up","Last Contact","Notes","Fit Score"',
    );
  });
});

describe("stage reflects observed behaviour only", () => {
  it("is a new lead when nothing has been opened", () => {
    expect(deriveStage({ ...base, opened: [] })).toBe("New lead");
  });

  it("is engaged once a resource has actually been opened", () => {
    expect(deriveStage({ ...base, opened: ["chapter"] })).toBe("Engaged");
  });

  it("marks an opted-out person so they cannot be worked by mistake", () => {
    expect(deriveStage({ ...base, unsubscribedAt: new Date() })).toBe("Unsubscribed");
  });

  it("never claims Qualified, which only Tabitha can determine", () => {
    const stages = [
      deriveStage({ ...base, opened: [] }),
      deriveStage({ ...base, opened: ["chapter", "checklist"] }),
      deriveStage({ ...base, unsubscribedAt: new Date() }),
    ];
    expect(stages).not.toContain("Qualified");
  });
});

describe("notes contain facts, not inferences", () => {
  it("records the track in the registrant's own framing", () => {
    expect(buildNotes(base)).toContain("Already serving clients");
  });

  it("records what was requested and that nothing was opened yet", () => {
    const notes = buildNotes({ ...base, opened: [] });
    expect(notes).toContain("Asked for the sample chapter and readiness checklist");
    expect(notes).toContain("Has not opened a resource yet");
  });

  it("records what was actually opened", () => {
    const notes = buildNotes({ ...base, opened: ["checklist"] });
    expect(notes).toContain("Opened the readiness checklist");
  });

  it("says nothing about intent, urgency or likelihood to buy", () => {
    const notes = buildNotes({ ...base, opened: ["chapter"] }).toLowerCase();
    for (const word of ["ready to buy", "hot", "likely", "eager", "urgent", "interested in"]) {
      expect(notes).not.toContain(word);
    }
  });
});

describe("columns the qualifier must compute are left blank", () => {
  it("never pre-fills Fit Score, Deal Size or Industry", () => {
    const [, row] = toPipelineCsv([{ ...base, opened: ["chapter"] }]).split("\r\n");
    const cells = row.split('","');
    // Industry, Deal Size, Next Follow-Up and Fit Score are positions 5, 6, 7 and 10.
    expect(cells[4]).toBe(""); // Industry
    expect(cells[5]).toBe(""); // Deal Size
    expect(cells[6]).toBe(""); // Next Follow-Up
    expect(row.endsWith(',""')).toBe(true); // Fit Score
  });
});

describe("spreadsheet safety", () => {
  it("neutralizes a formula-injection attempt in a name", () => {
    const csv = toPipelineCsv([
      { ...base, firstName: "=HYPERLINK(1)", lastName: "Test" },
    ]);
    expect(csv).toContain("'=HYPERLINK(1) Test");
  });

  it("escapes embedded quotes rather than breaking the row", () => {
    const csv = toPipelineCsv([{ ...base, lastName: 'O"Hara' }]);
    expect(csv).toContain('Ada O""Hara');
  });

  it("writes Last Contact as a plain date the pipeline can parse", () => {
    expect(toPipelineCsv([base])).toContain('"2026-08-10"');
  });
});
