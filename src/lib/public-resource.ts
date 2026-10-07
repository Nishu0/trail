import { lookup } from "node:dns/promises";
import { request } from "node:https";
import { privateAddress, projectURL } from "./project-import";

export type PublicResource = {
  url: string;
  status: number;
  type: string;
  body: Buffer;
};
// Status-aware counterpart to the project importer, also used for small brand images.
export async function fetchPublicResource(
  value: string,
  signal?: AbortSignal,
  image = false,
  redirects = 0,
): Promise<PublicResource> {
  const url = projectURL(value);
  signal?.throwIfAborted();
  const addresses = await lookup(url.hostname, { all: true });
  if (!addresses.length || addresses.some((a) => privateAddress(a.address)))
    throw new Error("Not a public website.");
  const pinned = addresses.find((a) => a.family === 4) || addresses[0];
  const result = await new Promise<PublicResource & { location?: string }>(
    (resolve, reject) => {
      const req = request(
        url,
        {
          signal,
          headers: {
            "User-Agent": "Trail-public-check/1.0",
            Accept: image ? "image/*" : "text/html,application/json",
          },
          family: pinned.family,
          lookup: (_host, options, callback) => {
            if (typeof options === "object" && options.all)
              (callback as unknown as (e: null, a: typeof addresses) => void)(
                null,
                [pinned],
              );
            else callback(null, pinned.address, pinned.family);
          },
        },
        (res) => {
          const status = res.statusCode || 500;
          const type = String(res.headers["content-type"] || "").split(";")[0];
          if (status >= 300 && status < 400) {
            res.resume();
            resolve({
              url: url.href,
              status,
              type,
              location: res.headers.location,
              body: Buffer.alloc(0),
            });
            return;
          }
          if (status !== 200) {
            res.resume();
            resolve({ url: url.href, status, type, body: Buffer.alloc(0) });
            return;
          }
          if (
            image
              ? !/^image\/(png|jpeg|gif|webp|svg\+xml|x-icon|vnd\.microsoft\.icon|avif)$/.test(
                  type,
                )
              : !/text\/html|application\/xhtml\+xml|application\/json/.test(
                  type,
                )
          ) {
            res.resume();
            reject(new Error("Unsupported public response."));
            return;
          }
          let size = 0;
          const chunks: Buffer[] = [];
          res.on("data", (chunk: Buffer) => {
            size += chunk.length;
            if (size > (image ? 1024 * 1024 : 4 * 1024 * 1024))
              req.destroy(new Error("Public response too large."));
            else chunks.push(chunk);
          });
          res.on("error", reject);
          res.on("end", () =>
            resolve({
              url: url.href,
              status,
              type,
              body: Buffer.concat(chunks),
            }),
          );
        },
      );
      const timeout = setTimeout(
        () => req.destroy(new Error("Public check timed out.")),
        15000,
      );
      req.on("close", () => clearTimeout(timeout));
      req.on("error", reject);
      req.end();
    },
  );
  if (result.status >= 300 && result.status < 400) {
    if (!result.location || redirects >= 4)
      throw new Error("Too many public redirects.");
    return fetchPublicResource(
      new URL(result.location, url).href,
      signal,
      image,
      redirects + 1,
    );
  }
  return result;
}
