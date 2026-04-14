#!/usr/bin/env node
/**
 * Frontmatter schema validator for blog posts.
 *
 * Ensures every post in src/posts/ has the required frontmatter fields
 * so posts render correctly on the site. Required fields:
 *   - title  (non-empty string)
 *   - date   (parseable date)
 *
 * Exits with code 1 and a list of problems if any post is invalid.
 */

const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");

const POSTS_DIR = path.join(__dirname, "..", "src", "posts");

const REQUIRED_FIELDS = ["title", "date"];

function extractFrontmatter(content, filePath) {
  if (!content.startsWith("---")) {
    return { error: "Missing frontmatter block (file must start with '---')" };
  }
  const end = content.indexOf("\n---", 3);
  if (end === -1) {
    return { error: "Unterminated frontmatter block (no closing '---')" };
  }
  const raw = content.slice(3, end).trim();
  try {
    const data = yaml.safeLoad(raw);
    if (data === null || typeof data !== "object") {
      return { error: "Frontmatter YAML did not parse to an object" };
    }
    return { data };
  } catch (e) {
    return { error: `Invalid YAML in frontmatter: ${e.message}` };
  }
}

function validatePost(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  const result = extractFrontmatter(content, filePath);
  const problems = [];

  if (result.error) {
    problems.push(result.error);
    return problems;
  }

  const { data } = result;

  for (const field of REQUIRED_FIELDS) {
    if (!(field in data)) {
      problems.push(`Missing required frontmatter field: '${field}'`);
      continue;
    }
    const value = data[field];
    if (value === null || value === undefined || value === "") {
      problems.push(`Frontmatter field '${field}' is empty`);
      continue;
    }
    if (field === "title" && typeof value !== "string") {
      problems.push(`Frontmatter field 'title' must be a string (got ${typeof value})`);
    }
    if (field === "date") {
      const d = value instanceof Date ? value : new Date(value);
      if (isNaN(d.getTime())) {
        problems.push(`Frontmatter field 'date' is not a valid date: '${value}'`);
      }
    }
  }

  return problems;
}

function main() {
  if (!fs.existsSync(POSTS_DIR)) {
    console.error(`Posts directory not found: ${POSTS_DIR}`);
    process.exit(1);
  }

  const files = fs
    .readdirSync(POSTS_DIR)
    .filter((f) => f.endsWith(".md"))
    .map((f) => path.join(POSTS_DIR, f));

  let totalProblems = 0;
  for (const file of files) {
    const problems = validatePost(file);
    if (problems.length > 0) {
      totalProblems += problems.length;
      const rel = path.relative(process.cwd(), file);
      for (const p of problems) {
        console.error(`${rel}: ${p}`);
      }
    }
  }

  if (totalProblems > 0) {
    console.error(`\nvalidate-posts: FAILED with ${totalProblems} problem(s) across ${files.length} post(s)`);
    process.exit(1);
  }

  console.log(`validate-posts: OK (${files.length} post(s) validated)`);
}

main();
