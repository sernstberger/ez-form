# ez-form — working rules

Read `docs/PHILOSOPHY.md` first; it is the authority. The non-negotiables:

- **Extend, don't re-implement.** Props/types come from MUI, Base UI, react-hook-form. Audit before changing; keep deliberate deviations, delete identical copies.
- **No styling in `src/`.** No `sx`, ripple props, or literals a theme cannot override. Defaults go through `useDefaultProps` + `styled` slots + `<name>Classes` + `src/theme/augmentation.ts`. A slot default spread under `slotProps` is the pattern, not a violation. Stories may style. Styling taste lives in `DESIGN.md`; the preset in `src/theme/ezFormTheme.ts` is its code form.
- **a11y is verified, not assumed.** jest-axe in every component test; pristine test output.
- **The form owns the lifecycle.** Submission, loading, disabling, confirm, guard live on `<Form>`; fields read from context.
- **Backlog is GitHub Issues only.** Labels `area:*`, `priority:*`, `size:*`, `needs-design`, `follow-up`; milestones per version. Post the finalized plan on each issue before building; `needs-design` means brainstorm first.
- **Work is subagent-driven in parallel worktrees** (`.worktrees/<track>`), one review per task, one final whole-branch review, ledger under `.superpowers/sdd/<plan>/`, then a ledger doc under `docs/superpowers/reviews/`.
- **Record every ruling** as `Ruling: <what> — <why> — <cost if wrong>` and list them all when handing back.
- Push `main` when the final review is clean (standing rule); publishing and deleting remote branches are Steve's call, ask.

Commands: `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm build-storybook`, `pnpm format`. Storybook's script pins port 6006; a second instance is `pnpm exec storybook dev -p <port> --ci`.

**Never `cd <dir> && <cmd> <relative-path>`.** A relative path after a `cd` cannot be resolved
statically, so the permission checker falls back to a deny rule and prompts Steve for every
call. Pass absolute paths instead, and use each tool's own directory flag:

| Instead of | Use |
|---|---|
| `cd <wt> && grep -rn x src/foo.tsx` | `grep -rn x <wt>/src/foo.tsx` |
| `cd <wt> && pnpm test` | `pnpm --dir <wt> test` |
| `cd <wt> && pnpm exec vitest run src/x.test.tsx` | `pnpm --dir <wt> exec vitest run <wt>/src/x.test.tsx` |
| `cd <wt> && git status` | `git -C <wt> status` |

This matters most in worktree lanes, where every path sits under `.worktrees/<track>/`. Put the
rule in each lane's dispatch prompt — subagents inherit no memory of it.

Scratch test probes go in `src/__qa__/` (gitignored, excluded from tsconfig and eslint) because
vitest's `include` is `src/**/*.test.{ts,tsx}` — a probe in `/tmp` will not run. Delete them when
done; `git status` must stay clean.
