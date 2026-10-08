import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const url = new URL(request.url);

      // Dedicated endpoint to download Neon database dump copies
      if (url.pathname === "/api/download-neon-dump") {
        const cookie = request.headers.get("cookie") || "";
        const authHeader = request.headers.get("authorization") || "";
        const urlToken = url.searchParams.get("token") || "";
        const hasSession =
          cookie.includes("proaccess_neon_session") ||
          authHeader.startsWith("Bearer neon_token_") ||
          urlToken.startsWith("neon_token_");

        if (!hasSession) {
          return new Response(
            "Não autorizado: É necessário estar autenticado para exportar cópia do banco de dados.",
            { status: 401, headers: { "content-type": "text/plain; charset=utf-8" } },
          );
        }

        const format = (url.searchParams.get("format") || "sql.gz") as
          "sql" | "sql.gz" | "json" | "json.gz";

        const { getOrGenerateDumpFile } = await import("./lib/neon-dump");
        const { buffer, filename, mimeType } = await getOrGenerateDumpFile(format);

        return new Response(buffer, {
          status: 200,
          headers: {
            "Content-Type": mimeType,
            "Content-Disposition": `attachment; filename="${filename}"`,
            "Content-Length": String(buffer.length),
            "Cache-Control": "no-cache, no-store, must-revalidate",
          },
        });
      }

      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
