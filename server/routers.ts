import { z } from "zod";
import { COOKIE_NAME } from "../shared/const.js";
import * as db from "./db";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";

const snapshotInput = z.object({
  snapshotKey: z.string().min(1).max(64).default("default"),
});

const saveSnapshotInput = snapshotInput.extend({
  payload: z.string().min(2).max(5_000_000),
  baseUpdatedAt: z.string().datetime().optional(),
  clientId: z.string().min(1).max(128).optional(),
  force: z.boolean().optional(),
});

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  sync: router({
    get: protectedProcedure.input(snapshotInput.optional()).query(async ({ ctx, input }) => {
      return db.getGameSnapshot(ctx.user.id, input?.snapshotKey ?? "default");
    }),
    save: protectedProcedure.input(saveSnapshotInput).mutation(async ({ ctx, input }) => {
      const result = await db.upsertGameSnapshot(ctx.user.id, input.payload, input.snapshotKey, { baseUpdatedAt: input.baseUpdatedAt, clientId: input.clientId, force: input.force });
      return {
        success: result.status === "saved",
        conflict: result.status === "conflict",
        payload: result.snapshot.payload,
        revision: result.snapshot.revision,
        clientId: result.snapshot.clientId,
        updatedAt: result.snapshot.updatedAt.toISOString(),
      } as const;
    }),
  }),
});

export type AppRouter = typeof appRouter;
