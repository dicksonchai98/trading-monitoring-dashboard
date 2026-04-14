# Auth And Frontend UX Refactor (Wave 1) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Deliver Wave 1 refactor with `user_id` as primary login identifier, `email` as verification/notification channel, and frontend UX stability improvements (auth flow, subscription crash fix, skeleton loading, mobile sidebar behavior).

**Architecture:** Keep existing FastAPI + React modular structure. Apply a minimal backend schema/API evolution first (identity contract), then refactor frontend auth flow into deterministic multi-step state. Keep subscription and dashboard UI fixes isolated and additive to avoid broad regression risk. Preserve current SSE pipeline and billing lifecycle behavior from previous fixes.

**Tech Stack:** FastAPI, SQLAlchemy, Alembic, Pytest, React + TypeScript, React Query, Zustand, react-hook-form, zod, Vitest

---

## Execution Status (2026-04-03)

- [x] Task 1: Add Identity Fields For `user_id + email` Model
- [x] Task 2: Switch Auth Service And Routes To `user_id` Login Contract
- [x] Task 3: Refactor Frontend Auth Schemas And API Types
- [x] Task 4: Replace OTP Modal With Two-Step Register Flow Component
- [x] Task 5: Improve Auth Feedback (Success/Error Alert And Copy)
- [x] Task 6: Add Skeleton Loading For High-Traffic Pages
- [x] Task 7: Improve Mobile Sidebar Layout And Interaction Smoothness
- [~] Task 8: Verification Sweep + Docs Update (frontend verification/docs done; backend `tests/test_billing_plans_api.py` currently hangs at collection in local env)

---

### Task 1: Add Identity Fields For `user_id + email` Model

**Files:**
- Create: `apps/backend/alembic/versions/20260403_01_add_user_id_and_email_fields.py`
- Modify: `apps/backend/app/models/user.py`
- Modify: `apps/backend/app/repositories/user_repository.py`
- Test: `apps/backend/tests/test_user_repository.py`

**Step 1: Write the failing test**

```python
def test_create_user_persists_user_id_and_email(session_factory):
    repo = UserRepository(session_factory=session_factory)
    created = repo.create_user(
        user_id="trader01",
        email="trader01@example.com",
        password_hash="hash",
        role="user",
    )
    assert created.user_id == "trader01"
    assert created.email == "trader01@example.com"
```

**Step 2: Run test to verify it fails**

Run: `cd apps/backend && $env:PYTHONPATH='.'; pytest tests/test_user_repository.py::test_create_user_persists_user_id_and_email -q -v`  
Expected: FAIL because repository/model signature still uses `username`.

**Step 3: Write minimal implementation**

```python
# models/user.py
user_id = mapped_column(String(64), unique=True, nullable=False)
email = mapped_column(String(320), unique=True, nullable=False)
email_verified_at = mapped_column(DateTime(timezone=True), nullable=True)

# repository/user_repository.py
def create_user(self, user_id: str, email: str, password_hash: str, role: str) -> UserRecord:
    model = UserModel(user_id=user_id, email=email, password_hash=password_hash, role=role)
```

**Step 4: Run test to verify it passes**

Run: `cd apps/backend && $env:PYTHONPATH='.'; pytest tests/test_user_repository.py::test_create_user_persists_user_id_and_email -q -v`  
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/backend/alembic/versions/20260403_01_add_user_id_and_email_fields.py apps/backend/app/models/user.py apps/backend/app/repositories/user_repository.py apps/backend/tests/test_user_repository.py
git commit -m "feat: add user_id and email identity fields"
```

### Task 2: Switch Auth Service And Routes To `user_id` Login Contract

**Files:**
- Modify: `apps/backend/app/routes/auth.py`
- Modify: `apps/backend/app/services/auth_service.py`
- Modify: `apps/backend/app/repositories/user_repository.py`
- Modify: `apps/backend/app/services/otp_service.py`
- Test: `apps/backend/tests/test_identity_access_acceptance.py`
- Test: `apps/backend/tests/test_auth_otp_api.py`

**Step 1: Write the failing test**

```python
def test_login_uses_user_id_not_email(client):
    register_payload = {
        "user_id": "trader01",
        "email": "trader01@example.com",
        "password": "Passw0rd!",
        "verification_token": "token_ok",
    }
    assert client.post("/auth/register", json=register_payload).status_code == 200
    login_res = client.post("/auth/login", json={"user_id": "trader01", "password": "Passw0rd!"})
    assert login_res.status_code == 200
```

**Step 2: Run test to verify it fails**

Run: `cd apps/backend && $env:PYTHONPATH='.'; pytest tests/test_identity_access_acceptance.py::test_login_uses_user_id_not_email -q -v`  
Expected: FAIL due to schema mismatch (`username` currently required).

**Step 3: Write minimal implementation**

```python
# routes/auth.py request models
class CredentialRequest(BaseModel):
    user_id: str
    password: str

class RegisterRequest(CredentialRequest):
    email: str
    verification_token: str | None = None

# auth_service.py
user = self._user_repository.get_by_user_id(user_id)
```

**Step 4: Run test to verify it passes**

Run: `cd apps/backend && $env:PYTHONPATH='.'; pytest tests/test_identity_access_acceptance.py::test_login_uses_user_id_not_email -q -v`  
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/backend/app/routes/auth.py apps/backend/app/services/auth_service.py apps/backend/app/repositories/user_repository.py apps/backend/app/services/otp_service.py apps/backend/tests/test_identity_access_acceptance.py apps/backend/tests/test_auth_otp_api.py
git commit -m "feat: switch auth contract to user_id login and email registration"
```

### Task 3: Refactor Frontend Auth Schemas And API Types

**Files:**
- Modify: `apps/frontend/src/features/auth/validation/auth-schema.ts`
- Modify: `apps/frontend/src/features/auth/api/types.ts`
- Modify: `apps/frontend/src/features/auth/api/auth.ts`
- Test: `apps/frontend/src/features/auth/pages/LoginPage.test.tsx`

**Step 1: Write the failing test**

```tsx
it("submits user_id and password for login", async () => {
  // mock login API call and assert payload keys
  expect(mockLogin).toHaveBeenCalledWith({ user_id: "trader01", password: "Passw0rd!" });
});
```

**Step 2: Run test to verify it fails**

Run: `cd apps/frontend && npm.cmd run test -- LoginPage.test.tsx`  
Expected: FAIL because form still uses `username`.

**Step 3: Write minimal implementation**

```ts
export const loginSchema = z.object({
  user_id: z.string().min(3, "User ID is required"),
  password: z.string().min(8, "Password is required"),
});
```

**Step 4: Run test to verify it passes**

Run: `cd apps/frontend && npm.cmd run test -- LoginPage.test.tsx`  
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/frontend/src/features/auth/validation/auth-schema.ts apps/frontend/src/features/auth/api/types.ts apps/frontend/src/features/auth/api/auth.ts apps/frontend/src/features/auth/pages/LoginPage.test.tsx
git commit -m "feat: align frontend auth schemas with user_id contract"
```

### Task 4: Replace OTP Modal With Two-Step Register Flow Component

**Files:**
- Modify: `apps/frontend/src/features/auth/pages/LoginPage.tsx`
- Create: `apps/frontend/src/features/auth/components/EmailVerificationStep.tsx`
- Create: `apps/frontend/src/features/auth/components/RegisterCredentialsStep.tsx`
- Test: `apps/frontend/src/features/auth/pages/LoginPage.test.tsx`

**Step 1: Write the failing test**

```tsx
it("advances register flow from email verification to credential submission", async () => {
  // assert initial step is verification, then moves to credentials after verify success
  expect(screen.getByText("Verify email")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Verify code" }));
  expect(screen.getByText("Create account")).toBeInTheDocument();
});
```

**Step 2: Run test to verify it fails**

Run: `cd apps/frontend && npm.cmd run test -- LoginPage.test.tsx`  
Expected: FAIL because current flow uses modal and mixed state.

**Step 3: Write minimal implementation**

```tsx
// LoginPage.tsx
{mode === "register" ? <RegisterFlow /> : <LoginForm />}
```

```tsx
// RegisterFlow state machine
type Step = "verify_email" | "credentials";
```

**Step 4: Run test to verify it passes**

Run: `cd apps/frontend && npm.cmd run test -- LoginPage.test.tsx`  
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/frontend/src/features/auth/pages/LoginPage.tsx apps/frontend/src/features/auth/components/EmailVerificationStep.tsx apps/frontend/src/features/auth/components/RegisterCredentialsStep.tsx apps/frontend/src/features/auth/pages/LoginPage.test.tsx
git commit -m "refactor: replace register otp modal with two-step flow"
```

### Task 5: Improve Auth Feedback (Success/Error Alert And Copy)

**Files:**
- Modify: `apps/frontend/src/features/auth/pages/LoginPage.tsx`
- Create: `apps/frontend/src/components/ui/alert-banner.tsx`
- Test: `apps/frontend/src/features/auth/pages/LoginPage.test.tsx`

**Step 1: Write the failing test**

```tsx
it("shows success alert after email verification", async () => {
  // complete verification flow
  expect(screen.getByText("Email verified. Continue to create account.")).toBeInTheDocument();
});
```

**Step 2: Run test to verify it fails**

Run: `cd apps/frontend && npm.cmd run test -- LoginPage.test.tsx`  
Expected: FAIL due to missing unified alert component/message.

**Step 3: Write minimal implementation**

```tsx
<AlertBanner variant="success" message={statusMessage} />
```

**Step 4: Run test to verify it passes**

Run: `cd apps/frontend && npm.cmd run test -- LoginPage.test.tsx`  
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/frontend/src/features/auth/pages/LoginPage.tsx apps/frontend/src/components/ui/alert-banner.tsx apps/frontend/src/features/auth/pages/LoginPage.test.tsx
git commit -m "feat: add unified auth success and error alerts"
```

### Task 6: Add Skeleton Loading For High-Traffic Pages

**Files:**
- Create: `apps/frontend/src/components/ui/page-skeleton.tsx`
- Modify: `apps/frontend/src/features/dashboard/pages/RealtimeDashboardPage.tsx`
- Modify: `apps/frontend/src/features/subscription/pages/SubscriptionPage.tsx`
- Modify: `apps/frontend/src/features/auth/pages/LoginPage.tsx`
- Test: `apps/frontend/src/features/dashboard/pages/RealtimeDashboardPage.test.tsx`
- Test: `apps/frontend/src/features/subscription/pages/SubscriptionPage.test.tsx`

**Step 1: Write the failing test**

```tsx
it("shows skeleton while bootstrap/query is loading", () => {
  expect(screen.getByTestId("page-skeleton")).toBeInTheDocument();
});
```

**Step 2: Run test to verify it fails**

Run: `cd apps/frontend && npm.cmd run test -- RealtimeDashboardPage.test.tsx SubscriptionPage.test.tsx`  
Expected: FAIL because skeleton states are missing.

**Step 3: Write minimal implementation**

```tsx
if (isLoading) {
  return <PageSkeleton data-testid="page-skeleton" />;
}
```

**Step 4: Run test to verify it passes**

Run: `cd apps/frontend && npm.cmd run test -- RealtimeDashboardPage.test.tsx SubscriptionPage.test.tsx`  
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/frontend/src/components/ui/page-skeleton.tsx apps/frontend/src/features/dashboard/pages/RealtimeDashboardPage.tsx apps/frontend/src/features/subscription/pages/SubscriptionPage.tsx apps/frontend/src/features/auth/pages/LoginPage.tsx apps/frontend/src/features/dashboard/pages/RealtimeDashboardPage.test.tsx apps/frontend/src/features/subscription/pages/SubscriptionPage.test.tsx
git commit -m "feat: add page skeletons for auth dashboard and subscription"
```

### Task 7: Improve Mobile Sidebar Layout And Interaction Smoothness

**Files:**
- Modify: `apps/frontend/src/components/ui/sidebar.tsx`
- Modify: `apps/frontend/src/app/layout/AppShell.tsx`
- Modify: `apps/frontend/src/components/ui/sidebar.test.tsx`
- Modify: `apps/frontend/src/app/layout/AppShell.test.tsx`

**Step 1: Write the failing tests**

```tsx
it("hides sidebar content by default on mobile and shows toggle icon", () => {
  // emulate mobile viewport
  expect(screen.getByLabelText("Open sidebar")).toBeInTheDocument();
});

it("renders setting nav item at end and keeps user info separate", () => {
  // assert nav order and section split
});
```

**Step 2: Run tests to verify they fail**

Run: `cd apps/frontend && npm.cmd run test -- sidebar.test.tsx AppShell.test.tsx`  
Expected: FAIL due to current mixed layout and behavior.

**Step 3: Write minimal implementation**

```tsx
// sidebar.tsx
const isMobile = useMediaQuery("(max-width: 768px)");
const [open, setOpen] = useState(false);
```

```tsx
// AppShell.tsx
// move Settings entry to nav tail; keep user info pinned in footer block
```

**Step 4: Run tests to verify they pass**

Run: `cd apps/frontend && npm.cmd run test -- sidebar.test.tsx AppShell.test.tsx`  
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/frontend/src/components/ui/sidebar.tsx apps/frontend/src/app/layout/AppShell.tsx apps/frontend/src/components/ui/sidebar.test.tsx apps/frontend/src/app/layout/AppShell.test.tsx
git commit -m "refactor: improve mobile sidebar behavior and nav structure"
```

### Task 8: Wave 1 Verification Sweep And Documentation Update

**Files:**
- Modify: `apps/frontend/TECH_STACK.md`
- Modify: `apps/frontend/AGENTS.md`
- Modify: `docs/plans/2026-04-03-auth-ux-refactor-wave1.md` (status checklist update)
- Optional: `apps/backend/README.md` (if auth payload changed)

**Step 1: Run backend targeted test suite**

Run:  
`cd apps/backend && $env:PYTHONPATH='.'; pytest tests/test_user_repository.py tests/test_identity_access_acceptance.py tests/test_auth_otp_api.py tests/test_billing_plans_api.py -q`  
Expected: PASS.

**Step 2: Run frontend targeted test suite**

Run:  
`cd apps/frontend && npm.cmd run test -- LoginPage.test.tsx SubscriptionPage.test.tsx RealtimeDashboardPage.test.tsx sidebar.test.tsx AppShell.test.tsx`  
Expected: PASS.

**Step 3: Run local smoke checks**

Run:
- `docker compose up -d --build backend-api`
- `cd apps/frontend && npm.cmd run dev`

Expected:
- Login with `user_id` works
- Register flow completes with email verification
- Subscription page no runtime crash
- Mobile sidebar behaves correctly

**Step 4: Update docs to match behavior**

Add:
- `user_id` login contract
- email verification step model
- free/basic subscription behavior
- page skeleton policy

**Step 5: Commit**

```bash
git add apps/frontend/TECH_STACK.md apps/frontend/AGENTS.md apps/backend/README.md docs/plans/2026-04-03-auth-ux-refactor-wave1.md
git commit -m "docs: align frontend auth and ux guidance with wave1 refactor"
```

---

## Guardrails

- Apply @superpowers:test-driven-development in every task (RED -> GREEN -> REFACTOR).
- Apply @superpowers:verification-before-completion before declaring a task done.
- Keep each task to one commit; do not bundle multiple tasks in one commit.
- Use YAGNI: no WebSocket migration, no billing provider expansion, no multi-market scope in this wave.
- Preserve existing SSE and RBAC boundaries defined in `apps/frontend/AGENTS.md` and repo `AGENTS.md`.
