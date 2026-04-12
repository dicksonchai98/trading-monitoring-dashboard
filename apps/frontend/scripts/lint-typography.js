import { execSync } from "node:child_process";

const rules = [
  {
    id: "no-arbitrary-text-size",
    pattern:
      /text-\[(?:\d+(?:\.\d+)?(?:px|rem|em)|\.\d+(?:px|rem|em))\]/,
    message: "Avoid arbitrary font size classes. Use Typography variants/tokens instead.",
  },
  {
    id: "no-arbitrary-letter-spacing",
    pattern: /tracking-\[[^\]]+\]/,
    message: "Avoid arbitrary tracking classes. Use Typography variants/tokens instead.",
  },
  {
    id: "no-inline-text-transform",
    pattern: /\b(?:uppercase|lowercase|capitalize)\b/,
    message: "Avoid inline text transform classes. Use Typography variants/tokens instead.",
  },
];

function getDiff() {
  return execSync("git diff --cached --unified=0 --no-color -- src", {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function lintAddedLines(diffText) {
  const violations = [];
  const lines = diffText.split(/\r?\n/);
  let filePath = "";
  let nextLine = 0;

  for (const line of lines) {
    if (line.startsWith("+++ b/")) {
      filePath = line.slice("+++ b/".length);
      continue;
    }

    const hunk = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (hunk) {
      nextLine = Number.parseInt(hunk[1], 10);
      continue;
    }

    if (!filePath.endsWith(".tsx")) {
      continue;
    }

    if (line.startsWith("+") && !line.startsWith("+++")) {
      const content = line.slice(1);

      if (content.includes("typography-lint-ignore")) {
        nextLine += 1;
        continue;
      }

      for (const rule of rules) {
        if (rule.pattern.test(content)) {
          violations.push({
            filePath,
            line: nextLine,
            rule: rule.id,
            message: rule.message,
            content: content.trim(),
          });
        }
      }
      nextLine += 1;
      continue;
    }

    if (!line.startsWith("-")) {
      nextLine += 1;
    }
  }

  return violations;
}

try {
  const diff = getDiff();
  if (!diff.trim()) {
    console.log("Typography lint: no staged changes under src/");
    process.exit(0);
  }

  const violations = lintAddedLines(diff);

  if (violations.length === 0) {
    console.log("Typography lint passed: no new banned typography classes.");
    process.exit(0);
  }

  console.error("Typography lint failed. New banned typography classes detected:\n");
  for (const violation of violations) {
    console.error(
      `${violation.filePath}:${violation.line} [${violation.rule}] ${violation.message}`,
    );
    console.error(`  ${violation.content}`);
  }
  process.exit(1);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Typography lint failed to run: ${message}`);
  process.exit(1);
}
