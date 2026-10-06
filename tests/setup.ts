// Unit tests are offline. Any outbound request, above all one to the Anthropic API,
// is a bug (SPEC.md section 12), so it fails the test instead of spending money.
const blockedFetch: typeof fetch = async (input) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  throw new Error(
    `Unit tests must not make network requests (attempted ${url}). Stub the dependency instead.`,
  );
};

globalThis.fetch = blockedFetch;
