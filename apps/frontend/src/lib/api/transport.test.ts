import { shouldBlockInsecureTransport } from "@/lib/api/transport";

describe("shouldBlockInsecureTransport", () => {
  it("does not block relative API path", () => {
    expect(shouldBlockInsecureTransport("/api", "https:", true)).toBe(false);
  });

  it("does not block localhost HTTP in development", () => {
    expect(shouldBlockInsecureTransport("http://localhost:8000", "http:", false)).toBe(false);
    expect(shouldBlockInsecureTransport("http://127.0.0.1:8000", "http:", false)).toBe(false);
  });

  it("blocks non-localhost HTTP when app is served over HTTPS", () => {
    expect(shouldBlockInsecureTransport("http://api.example.com", "https:", false)).toBe(true);
  });

  it("blocks non-localhost HTTP in production even on HTTP page", () => {
    expect(shouldBlockInsecureTransport("http://api.example.com", "http:", true)).toBe(true);
  });
});
