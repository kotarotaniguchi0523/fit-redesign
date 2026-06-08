/** @jsxImportSource hono/jsx */
import { Hono } from "hono";
import { jsxRenderer } from "hono/jsx-renderer";
import { describe, it, expect, vi } from "vitest";

vi.mock("../app/islands/SelfGrade", () => ({
	default: (p: { questionId: string }) => <div data-self-grade data-question-id={p.questionId} />,
}));
vi.mock("../app/islands/AnswerSelector", () => ({
	default: (p: { questionId: string; options: {label:string;html:string}[] }) => (
		<div data-answer-selector data-question-id={p.questionId}>
			{p.options.map((o) => <span class="q-option__label">{o.label}</span>)}
		</div>
	),
}));

import { QuestionCard } from "../app/components/QuestionCard";
import { unitBasedTabs } from "./data/units";
import { getUnitQuestions } from "./utils/questionManifest";

const r = jsxRenderer(({ children }) => <html><body>{children}</body></html>);

describe("iterate", () => {
  it("find breaking question", async () => {
    const unit = unitBasedTabs.find((t) => t.id === "unit-base-conversion")!;
    const questions = await getUnitQuestions(unit);
    const results: string[] = [];
    for (const q of questions) {
      const app = new Hono();
      app.use("*", r);
      app.onError((e, c) => c.text("ERR", 500));
      app.get("/", (c) => c.render(<QuestionCard question={q} />, { title: "t" }));
      const res = await app.request("/");
      results.push(`${q.id}:${res.status}:hasOpt=${!!(q.options&&q.options.length)}:fig=${!!q.figureData}`);
    }
    expect(results).toEqual(["SHOWME"]);
  });
});

import { Hono as Hono2 } from "hono";
describe("all-at-once", () => {
  it("render all questions in one tree", async () => {
    const { unitBasedTabs: tabs } = await import("./data/units");
    const { getUnitQuestions: guq } = await import("./utils/questionManifest");
    const unit = tabs.find((t) => t.id === "unit-base-conversion")!;
    const questions = await guq(unit);
    const app = new Hono2();
    app.use("*", r);
    app.onError((e, c) => c.text("ALLERR:" + ((e as Error)?.stack||"").slice(0,300), 500));
    app.get("/", (c) => c.render(<div>{questions.map((q) => <QuestionCard question={q} />)}</div>, { title: "t" }));
    const res = await app.request("/");
    const body = (await res.text()).slice(0, 350);
    expect({ s: res.status, body }).toEqual({ s: 200, body: "X" });
  });
});

import todayRoute from "../app/routes/today/[unit]";
import notFound from "../app/routes/_404";
describe("notfound-path", () => {
  it("route with bad unit (no QuestionCard rendered)", async () => {
    const app = new Hono2();
    app.use("*", r);
    app.notFound(notFound);
    app.onError((e, c) => c.text("NFERR:" + ((e as Error)?.stack||"").slice(0,350), 500));
    type H = Parameters<Hono2["get"]>[1][];
    app.get("/today/:unit", ...(todayRoute as H));
    const res = await app.request("/today/nonexistent-unit");
    const body = (await res.text()).slice(0, 400);
    expect({ s: res.status, body }).toEqual({ s: 404, body: "X" });
  });
});
