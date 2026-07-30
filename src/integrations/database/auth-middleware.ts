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

    let userId = "3c5fc7e9-39ce-4f7d-9076-30acaa0df902"; // default fallback master user ID

    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.replace("Bearer ", "");
      if (token.startsWith("neon_token_")) {
        userId = token.replace("neon_token_", "");
      }
    }

    return next({
      context: {
        db,
        userId,
        claims: { sub: userId },
      },
    });
  },
);
