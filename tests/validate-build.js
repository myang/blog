#!/usr/bin/env node
/**
 * Build output validator.
 *
 * Checks that the Eleventy build in _site/ produced a coherent site:
 *   - _site/ exists and is not empty
 *   - _site/index.html exists
 *   - Every source post in src/posts/ has a corresponding HTML output
 *   - No built HTML file references static images that do not exist on disk
 *
 * Exits with code 1 on any failure.
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SITE = path.join(ROOT, "_site");
const SRC_POSTS = path.join(ROOT, "src", "posts");

function fail(problems) {
  console.error("validate-build: FAILED");
  for (const p of problems) {
    console.error(`  - ${p}`);
  }
  process.exit(1);
}

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

function main() {
  const problems = [];

  if (!fs.existsSync(SITE)) {
    problems.push(`_site/ does not exist. Run 'npm run build' first.`);
    return fail(problems);
  }

  if (!fs.existsSync(path.join(SITE, "index.html"))) {
    problems.push(`_site/index.html is missing`);
  }

  // Every source post must have a matching built HTML file.
  const sourcePosts = fs
    .readdirSync(SRC_POSTS)
    .filter((f) => f.endsWith(".md"));

  for (const post of sourcePosts) {
    const slug = post.replace(/\.md$/, "");
    const expected = path.join(SITE, "posts", slug, "index.html");
    if (!fs.existsSync(expected)) {
      problems.push(
        `Missing build output for post: ${post} (expected ${path.relative(ROOT, expected)})`
      );
    }
  }

  // Walk built HTML files and check image references resolve on disk.
  const htmlFiles = walk(SITE).filter((f) => f.endsWith(".html"));
  const imgRefRegex = /<img[^>]+src=["']([^"']+)["']/g;

  for (const htmlFile of htmlFiles) {
    const html = fs.readFileSync(htmlFile, "utf8");
    let match;
    while ((match = imgRefRegex.exec(html)) !== null) {
      const src = match[1];
      // Only check local references (skip http(s) and data: urls).
      if (/^(https?:)?\/\//.test(src) || src.startsWith("data:")) continue;
      // Resolve relative to _site/
      const cleanSrc = src.split("?")[0].split("#")[0];
      const resolved = cleanSrc.startsWith("/")
        ? path.join(SITE, cleanSrc)
        : path.join(path.dirname(htmlFile), cleanSrc);
      if (!fs.existsSync(resolved)) {
        problems.push(
          `Broken image reference in ${path.relative(ROOT, htmlFile)}: '${src}' (resolved: ${path.relative(ROOT, resolved)})`
        );
      }
    }
  }

  if (problems.length > 0) return fail(problems);

  console.log(
    `validate-build: OK (${htmlFiles.length} HTML file(s), ${sourcePosts.length} post(s))`
  );
}

main();
