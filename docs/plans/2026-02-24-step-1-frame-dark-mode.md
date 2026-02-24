# Step 1 Frame Dark Mode Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Switch only the "Step 1 Frame" in `pencil-welcome.pen` to dark mode by setting its theme mode to `Dark`.

**Architecture:** This is a single-file JSON update with a lightweight verification script to enforce the frame¡¦s theme mode. The script serves as a minimal test to ensure the change is applied and stays correct.

**Tech Stack:** Node.js (for a tiny verification script), JSON (`pencil-welcome.pen`)

---

### Task 1: Add Verification Script (TDD)

**Files:**
- Create: `scripts/verify-step1-dark.js`

**Step 1: Write the failing test**

```js
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'pencil-welcome.pen');
const raw = fs.readFileSync(filePath, 'utf8');
const data = JSON.parse(raw);

function findFrame(node) {
  if (node && node.type === 'frame' && node.name === 'Step 1 Frame') {
    return node;
  }
  if (node && Array.isArray(node.children)) {
    for (const child of node.children) {
      const found = findFrame(child);
      if (found) return found;
    }
  }
  return null;
}

const root = { type: 'root', children: data.children || [] };
const frame = findFrame(root);

if (!frame) {
  console.error('FAIL: Step 1 Frame not found');
  process.exit(1);
}

const mode = frame.theme && frame.theme.Mode;
if (mode !== 'Dark') {
  console.error(`FAIL: Step 1 Frame theme.Mode is "${mode}" (expected "Dark")`);
  process.exit(1);
}

console.log('PASS: Step 1 Frame is Dark');
```

**Step 2: Run test to verify it fails**

Run: `node scripts/verify-step1-dark.js`
Expected: FAIL with message indicating `theme.Mode` is `Light`

---

### Task 2: Update Step 1 Frame Theme

**Files:**
- Modify: `pencil-welcome.pen`

**Step 1: Write minimal implementation**

Change the `theme` block for the frame with `name: "Step 1 Frame"` from:

```json
"theme": { "Mode": "Light" }
```

to:

```json
"theme": { "Mode": "Dark" }
```

**Step 2: Run test to verify it passes**

Run: `node scripts/verify-step1-dark.js`
Expected: PASS

**Step 3: Commit**

```bash
git add scripts/verify-step1-dark.js pencil-welcome.pen
git commit -m "feat: set Step 1 Frame to dark mode"
```

---

### Task 3: Manual Visual Check

**Files:**
- No file changes

**Step 1: Manual verification**

Open `pencil-welcome.pen` in the design tool and confirm that only "Step 1 Frame" renders in dark mode.
