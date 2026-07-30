import "@/lib/polyfill";
import { createStart, createMiddleware } from "@tanstack/react-start";
import { isRedirect, isNotFound } from "@tanstack/react-router";

import { renderErrorPage } from "./lib/error-page";
import { attachDatabaseAuth } from "@/integrations/database/auth-attacher";

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (
      isRedirect(error) ||
      isNotFound(error) ||
      (error != null &&
        typeof error === "object" &&
        ("statusCode" in error || "status" in error || "isRedirect" in error || "headers" in error))
    ) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

export const startInstance = createStart(() => ({
  functionMiddleware: [attachDatabaseAuth],
  requestMiddleware: [errorMiddleware],
}));
