import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mutate, buttonProps } = vi.hoisted(() => ({
  mutate: vi.fn(),
  buttonProps: { current: null as Record<string, unknown> | null },
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    registration: {
      confirm: {
        useMutation: () => ({ mutate, isIdle: true, isPending: false }),
      },
    },
  },
}));
vi.mock("@/components/brand", () => ({ LionMark: () => null }));
vi.mock("@/components/ui/button", () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => {
    buttonProps.current = props;
    return React.createElement("button", props, children);
  },
}));
vi.mock("lucide-react", () => ({
  AlertCircle: () => null,
  ArrowUpRight: () => null,
  BookOpen: () => null,
  Download: () => null,
  Loader2: () => null,
}));

import Confirm from "../client/src/pages/Confirm";

describe("double opt-in confirmation page", () => {
  beforeEach(() => {
    mutate.mockClear();
    buttonProps.current = null;
    vi.stubGlobal("window", {
      location: { search: "?e=participant%40example.com&t=valid-looking-token" },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("does not confirm or send follow-up emails just because the link was opened", () => {
    const html = renderToStaticMarkup(React.createElement(Confirm));

    expect(html).toContain("Confirm my email");
    expect(html).toContain("Your registration will not be confirmed until you choose the button below.");
    expect(mutate).not.toHaveBeenCalled();
  });

  it("runs the confirmation mutation only when the visitor presses the button", () => {
    renderToStaticMarkup(React.createElement(Confirm));
    const click = buttonProps.current?.onClick as (() => void) | undefined;

    expect(click).toBeTypeOf("function");
    click?.();
    expect(mutate).toHaveBeenCalledWith({ email: "participant@example.com", token: "valid-looking-token" });
  });
});
