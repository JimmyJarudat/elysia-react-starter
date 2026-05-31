import { Elysia } from "elysia";
import { authMiddleware } from "@/middleware/auth-middleware";
import { router } from "@/routes";

const app = new Elysia()
  .get("/", () => ({
    service: "it-utils-api",
    status: "ok",
  }))
  .use(authMiddleware)
  .use(router)
  .listen(3000);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);
