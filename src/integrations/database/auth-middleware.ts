import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { db } from "./client";

export const requireDatabaseAuth = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    const request = getRequest();

    if (!request?.headers) {
      throw new Error("Unauthorized: No request headers available");
    }

    const authHeader = request.headers.get("authorization");
    let token = "";

    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.replace("Bearer ", "");
    }

    // Fallback to cookie
    if (!token || !token.startsWith("neon_token_")) {
      const cookieHeader = request.headers.get("cookie");
      if (cookieHeader) {
        const match = cookieHeader.match(/proaccess_neon_session=([^;]+)/);
        if (match && match[1]) {
          try {
            const sess = JSON.parse(decodeURIComponent(match[1]));
            token = sess?.access_token || "";
          } catch {
            // ignore
          }
        }
      }
    }

    if (!token || !token.startsWith("neon_token_")) {
      throw new Error("Unauthorized: Sessão de usuário não encontrada ou inválida.");
    }

    const userId = token.replace("neon_token_", "");

    return next({
      context: {
        db,
        userId,
        claims: { sub: userId },
      },
    });
  },
);
