/** Build-time values that the beta deploy sets (ORC-293, .github/workflows/beta.yml). */
interface ImportMetaEnv {
  /** The prefilled link of the feedback form. Without it, the app has no feedback link. */
  readonly VITE_FEEDBACK_URL?: string;
  /** The commit that the build is from. */
  readonly VITE_BUILD_COMMIT?: string;
}
