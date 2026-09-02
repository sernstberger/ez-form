# ez-form — working rules

Read `docs/PHILOSOPHY.md` first; it is the authority. The non-negotiables:

- **Extend, don't re-implement.** Props/types come from MUI, Base UI, react-hook-form. Audit before changing; keep deliberate deviations, delete identical copies.
- **No styling in `src/`.** No `sx`, ripple props, or literals a theme cannot override. Defaults go through `useDefaultProps` + `styled` slots + `<name>Classes` + `src/theme/augmentation.ts`. A slot default spread under `slotProps` is the pattern, not a violation. Stories may style.
- **a11y is verified, not assumed.** jest-axe in every component test; pristine test output.
- **The form owns the lifecycle.** Submission, loading, disabling, confirm, guard live on `<Form>`; fields read from context.
- **Backlog is GitHub Issues only.** Labels `area:*`, `priority:*`, `size:*`, `needs-design`, `follow-up`; milestones per version. Post the finalized plan on each issue before building; `needs-design` means brainstorm first.
- **Work is subagent-driven in parallel worktrees** (`.worktrees/<track>`), one review per task, one final whole-branch review, ledger under `.superpowers/sdd/<plan>/`, then a ledger doc under `docs/superpowers/reviews/`.
- **Record every ruling** as `Ruling: <what> — <why> — <cost if wrong>` and list them all when handing back.
- Pushing, publishing, and deleting remote branches are Steve's call; ask.

Commands: `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm build-storybook`, `pnpm format`. Storybook's script pins port 6006; a second instance is `pnpm exec storybook dev -p <port> --ci`.
