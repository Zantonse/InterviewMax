import { describe, expect, it, vi } from "vitest";
import { Auth0DeleteError, deleteAuth0Users } from "./management";

const ENV = {
  AUTH0_DOMAIN: "https://imax.example.auth0.com/",
  AUTH0_MGMT_CLIENT_ID: "id",
  AUTH0_MGMT_CLIENT_SECRET: "secret",
};

function respond(status: number, body: unknown = {}) {
  return new Response(status === 204 ? null : JSON.stringify(body), { status });
}

describe("deleteAuth0Users", () => {
  it("does nothing for magic-link users, who have no Auth0 sign-in", async () => {
    const fetchFn = vi.fn();
    await deleteAuth0Users([], {}, fetchFn);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("gets a Management API token, then deletes each sign-in", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(respond(200, { access_token: "tok" }))
      .mockResolvedValueOnce(respond(204))
      .mockResolvedValueOnce(respond(404));
    await deleteAuth0Users(["google-oauth2|1", "email|2"], ENV, fetchFn);

    const [tokenUrl, tokenInit] = fetchFn.mock.calls[0];
    expect(tokenUrl).toBe("https://imax.example.auth0.com/oauth/token");
    expect(JSON.parse(tokenInit.body)).toMatchObject({
      grant_type: "client_credentials",
      audience: "https://imax.example.auth0.com/api/v2/",
    });
    expect(fetchFn.mock.calls[1][0]).toBe(
      "https://imax.example.auth0.com/api/v2/users/google-oauth2%7C1",
    );
    expect(fetchFn.mock.calls[1][1]).toMatchObject({
      method: "DELETE",
      headers: { authorization: "Bearer tok" },
    });
    expect(fetchFn.mock.calls[2][0]).toBe("https://imax.example.auth0.com/api/v2/users/email%7C2");
  });

  it("stops when Auth0 isn't set up or refuses", async () => {
    await expect(deleteAuth0Users(["x"], {}, vi.fn())).rejects.toBeInstanceOf(Auth0DeleteError);
    const refused = vi
      .fn()
      .mockResolvedValueOnce(respond(200, { access_token: "tok" }))
      .mockResolvedValueOnce(respond(403));
    await expect(deleteAuth0Users(["x"], ENV, refused)).rejects.toThrow(/403/);
  });
});
