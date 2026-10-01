// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FaqAccordion } from "@/components/site/faq-accordion";
import { ar } from "@/content/ar";

describe("FaqAccordion — إمكانية الوصول بلوحة المفاتيح", () => {
  it("يعرض الأسئلة مغلقة افتراضيًا ويفتحها بالنقر مع aria-expanded", async () => {
    const user = userEvent.setup();
    render(<FaqAccordion items={ar.faq.items} />);

    const firstTrigger = screen.getAllByRole("button")[0];
    expect(firstTrigger).toHaveAttribute("aria-expanded", "false");

    await user.click(firstTrigger);
    expect(firstTrigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText(ar.faq.items[0].a)).toBeVisible();
  });

  it("يغلق السؤال المفتوح عند فتح آخر (نمط single collapsible)", async () => {
    const user = userEvent.setup();
    render(<FaqAccordion items={ar.faq.items} />);

    const [t1, t2] = screen.getAllByRole("button");
    await user.click(t1);
    expect(t1).toHaveAttribute("aria-expanded", "true");
    await user.click(t2);
    expect(t1).toHaveAttribute("aria-expanded", "false");
    expect(t2).toHaveAttribute("aria-expanded", "true");
  });

  it("يفتح ويغلق بمفتاح Enter عبر التنقل Tab (سلوك Radix)", async () => {
    const user = userEvent.setup();
    render(<FaqAccordion items={ar.faq.items} selected={[0]} />);

    const trigger = screen.getByRole("button", { name: ar.faq.items[0].q });
    await user.tab();
    expect(trigger).toHaveFocus();

    await user.keyboard("{Enter}");
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    await user.keyboard("{Enter}");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("يعرض القائمة المختارة فقط عند تمرير selected", () => {
    render(<FaqAccordion items={ar.faq.items} selected={[0, 1]} />);
    const triggers = screen.getAllByRole("button");
    expect(triggers).toHaveLength(2);
    expect(screen.getByRole("button", { name: ar.faq.items[0].q })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: ar.faq.items[2].q })).not.toBeInTheDocument();
  });
});
