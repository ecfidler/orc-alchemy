---
type: How-to
title: Beta deploy
description: How the beta of Alchemy 5e deploys to Cloudflare Pages, and the steps that the owner does once to set it up.
tags: [deploy, beta, ci]
status: stable
generated: { by: claude-code/agent, at: 2026-11-22T23:30:00Z }
resource: https://linear.app/orc-alchemy/issue/ORC-293
---

# Beta deploy

The beta is a live copy of Alchemy 5e for tests and for feedback from
testers (ORC-293). It is on Cloudflare Pages, in the Pages project
`alchemy-5e-beta`. A Cloudflare Access login keeps it private.

# How it deploys

The workflow `.github/workflows/beta.yml` builds the app and uploads
`packages/app/dist` with `wrangler pages deploy`.

| Event | Deployment | URL |
|---|---|---|
| A push to `main` | The beta (the production branch) | `https://alchemy-5e-beta.pages.dev` |
| A push to a pull request from this repository | A preview of the pull request branch | `https://<branch>.alchemy-5e-beta.pages.dev` |

- The pull request shows the preview URL under "Deployments". The run
  summary also shows it.
- If the name `alchemy-5e-beta` is taken on `pages.dev`, Cloudflare adds a
  suffix to the URL. The run summary shows the real URL.
- The build uses the Bun version of the root `package.json`, the same as CI.
  Cloudflare's own Git builds use a newer Bun, which refuses `bun.lockb`
  with `--frozen-lockfile`. Thus GitHub Actions does the build.
- Deep links, for example `/sheet/<id>`, work because the build has no
  top-level `404.html`. Pages then sends `index.html` for each path that is
  not a file.
- `packages/app/public/_headers` tells search engines not to index the beta.
- If the Cloudflare secrets do not exist, the deploy job does not run, and
  the workflow passes.

## The feedback link

A build with `VITE_FEEDBACK_URL` shows "Send feedback" next to the logo. The
link opens the feedback form in a new tab. The workflow sets
`VITE_FEEDBACK_URL` from the repository variable `BETA_FEEDBACK_URL`. A
local build has no feedback link.

The app fills three fields of the form:

| Placeholder | Value |
|---|---|
| `{page}` | The path and query of the page, for example `/sheet/c7?tab=spells`. |
| `{build}` | The commit of the build. |
| `{browser}` | The user agent of the browser. |

## Characters on the beta

Alchemy 5e keeps characters in the browser. The beta URL and each preview
URL are different sites to the browser. Thus a character that a tester makes
on a preview is not on the beta. Tell testers to export a character before
they clear the site data.

# Set up the beta

Do these steps one time. Only the owner can do them, because they need the
owner's accounts.

## 1. Make the Cloudflare token

1. Make a free account at <https://dash.cloudflare.com/sign-up>.
2. In the dashboard, open **Workers & Pages**. Copy the **Account ID**.
3. Open **My Profile > API Tokens**. Select **Create Token**, then **Create
   Custom Token**.
4. Give the token the name `orc-alchemy beta deploy`.
5. Under **Permissions**, set **Account**, **Cloudflare Pages**, **Edit**.
6. Under **Account Resources**, include your account.
7. Select **Continue to summary**, then **Create Token**. Copy the token.

## 2. Add the GitHub secrets

1. Open <https://github.com/ecfidler/orc-alchemy/settings/secrets/actions>.
2. Add the repository secret `CLOUDFLARE_API_TOKEN` with the token.
3. Add the repository secret `CLOUDFLARE_ACCOUNT_ID` with the account ID.

## 3. Make the feedback form

1. Make a Google Form, for example "Alchemy 5e beta feedback".
2. Add a **Paragraph** question "What happened?" and make it required.
3. Add three **Short answer** questions: "Page", "Build" and "Browser".
4. Open the **⋮** menu and select **Get pre-filled link**.
5. Type `{page}`, `{build}` and `{browser}` in the three short answers.
6. Select **Get link**, then **Copy link**.
7. Open <https://github.com/ecfidler/orc-alchemy/settings/variables/actions>.
8. Add the repository variable `BETA_FEEDBACK_URL` with the link.

To see the answers in a sheet, open the **Responses** tab of the form and
select **Link to Sheets**.

## 4. Deploy the beta

1. Open the **Actions** tab of the repository and select **Beta deploy**.
2. Select **Run workflow** on `main`.
3. When the run is done, open the URL in its summary.

The first run makes the Pages project. After that, each merge to `main`
deploys.

## 5. Put the login in front of the beta

Cloudflare Access is free for up to 50 users. Testers sign in with a code
that Access sends to their email.

1. In the dashboard, open **Workers & Pages > alchemy-5e-beta > Settings**.
2. Under **General > Access policy**, select **Enable access policy**. This
   protects the previews, `*.alchemy-5e-beta.pages.dev`.
3. If Cloudflare asks you to set up Zero Trust, choose a team name and the
   **Free** plan.
4. In **Zero Trust**, open **Access > Applications**. Edit the application
   for `alchemy-5e-beta`.
5. Add a second public hostname, `alchemy-5e-beta.pages.dev`. This protects
   the beta itself. Save the application.
6. Edit the policy of the application. Under **Include**, select **Emails**
   and add your email and the email of each tester. Save the policy.
7. Open the beta URL in a private window. Make sure that Access asks for an
   email before it shows the app.

To add a tester later, add their email to the policy.

# Roll back the beta

1. Open **Workers & Pages > alchemy-5e-beta > Deployments**.
2. Find a production deployment that worked.
3. Open its **⋯** menu and select **Rollback to this deployment**.
