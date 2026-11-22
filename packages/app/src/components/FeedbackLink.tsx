import { useLocation } from "react-router";

/** What a feedback report carries about where the tester was. */
export type FeedbackFields = { page: string; build: string; browser: string };

const FIELDS: (keyof FeedbackFields)[] = ["page", "build", "browser"];

/**
 * The feedback form link with the fields filled in. The template is the
 * form's prefilled link (ORC-293): each field that the app fills holds
 * `{page}`, `{build}` or `{browser}`, plain or URL-encoded as the form
 * writes it (`%7Bpage%7D`).
 */
export function feedbackUrl(template: string, fields: FeedbackFields): string {
  let url = template;
  for (const name of FIELDS) {
    const value = encodeURIComponent(fields[name]);
    url = url.replace(new RegExp(`\\{${name}\\}|%7B${name}%7D`, "gi"), () => value);
  }
  return url;
}

/**
 * The "Send feedback" link of a beta build. It shows only when the build has
 * a feedback form (`VITE_FEEDBACK_URL`) and a commit (`VITE_BUILD_COMMIT`),
 * and it opens the form in a new tab, so that the tester keeps the page.
 */
export function FeedbackLink() {
  const { pathname, search } = useLocation();
  const template = import.meta.env.VITE_FEEDBACK_URL;
  const build = import.meta.env.VITE_BUILD_COMMIT;
  if (!template || !build) return null;
  const href = feedbackUrl(template, { page: pathname + search, build, browser: navigator.userAgent });
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="font-sans text-xs font-semibold text-ink-muted underline underline-offset-2 hover:text-ink"
    >
      Send feedback
    </a>
  );
}
