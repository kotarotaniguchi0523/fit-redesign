import { z } from "zod";

/**
 * 複数機能横断の共有 API スキーマ。
 * userId クエリのみを取る GET（answer/status・answer/history・timer/load）で共通利用する。
 */
export const UserIdQuerySchema = z.object({ userId: z.string().min(1) });
