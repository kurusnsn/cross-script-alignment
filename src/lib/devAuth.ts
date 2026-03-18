const enabledByEnv = process.env.NEXT_PUBLIC_ENABLE_DEV_MOCK_USER === "true";

export const DEV_MOCK_AUTH_ENABLED =
  process.env.NODE_ENV === "development" || enabledByEnv;

export const DEV_MOCK_USER = {
  id: "1",
  email: "dev@test.com",
  name: "Dev User",
  accessToken: "dev-mock-token",
} as const;
