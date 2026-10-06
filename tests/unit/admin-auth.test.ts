import { describe, expect, it } from "vitest";
import { isAdminAuthorized } from "@/lib/admin-auth";

const basic = (user: string, password: string) =>
  `Basic ${Buffer.from(`${user}:${password}`).toString("base64")}`;

describe("admin basic auth", () => {
  it("accepts the right password with any username", () => {
    expect(isAdminAuthorized(basic("admin", "correct horse"), "correct horse")).toBe(true);
    expect(isAdminAuthorized(basic("", "correct horse"), "correct horse")).toBe(true);
  });

  it("rejects a wrong, empty or partial password", () => {
    expect(isAdminAuthorized(basic("admin", "wrong"), "correct horse")).toBe(false);
    expect(isAdminAuthorized(basic("admin", ""), "correct horse")).toBe(false);
    expect(isAdminAuthorized(basic("admin", "correct hors"), "correct horse")).toBe(false);
    expect(isAdminAuthorized(basic("admin", "correct horse!"), "correct horse")).toBe(false);
  });

  it("rejects missing or malformed headers", () => {
    expect(isAdminAuthorized(null, "correct horse")).toBe(false);
    expect(isAdminAuthorized("", "correct horse")).toBe(false);
    expect(isAdminAuthorized("Bearer abc", "correct horse")).toBe(false);
    expect(isAdminAuthorized("Basic not-base64!", "correct horse")).toBe(false);
    expect(isAdminAuthorized(`Basic ${Buffer.from("nocolon").toString("base64")}`, "x")).toBe(
      false,
    );
  });

  it("denies everyone when ADMIN_PASSWORD is not set", () => {
    expect(isAdminAuthorized(basic("admin", ""), "")).toBe(false);
    expect(isAdminAuthorized(basic("admin", "anything"), undefined)).toBe(false);
  });
});
