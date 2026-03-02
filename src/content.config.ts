import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { ExamJsonSchema } from "./data/exams/schema";

const exams = defineCollection({
	loader: glob({ pattern: "**/*.json", base: "./src/content/exams" }),
	schema: ExamJsonSchema,
});

export const collections = { exams };
