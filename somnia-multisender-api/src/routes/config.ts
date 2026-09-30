import { Hono } from "hono";
import { getPublicConfig } from "../services/configService.js";

export const configRouter = new Hono();

configRouter.get("/", (c) => {
  const publicConfig = getPublicConfig();
  return c.json(publicConfig);
});
