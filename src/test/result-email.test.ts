import { APP } from "@/lib/assessment/config";
import { gmailComposeUrl } from "@/lib/assessment/payload";

// Rule: the result email goes ONLY to the configured To + CC pair, nowhere else.
describe("Result email recipients", () => {
  const url = () => gmailComposeUrl("ICC1.abc.def", "Test User", "summary");

  it("targets the fixed To address", () => {
    expect(url()).toContain(`to=${encodeURIComponent(APP.evaluatorEmail)}`);
    expect(APP.evaluatorEmail).toBe("resultsubmission@hackthefuture.co.in");
  });

  it("targets the fixed CC address", () => {
    expect(url()).toContain(`cc=${encodeURIComponent(APP.evaluatorCcEmail)}`);
    expect(APP.evaluatorCcEmail).toBe("hackthefuture.in@gmail.com");
  });

  it("adds no other recipient parameter", () => {
    expect(url()).not.toMatch(/[?&]bcc=/);
    expect(url().match(/[?&](to|cc)=/g)).toHaveLength(2);
  });
});
