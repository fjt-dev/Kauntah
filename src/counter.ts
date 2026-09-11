// src/counter.ts
//
// Durable Object によるアトミックなカウンター実装。
// 1つのDOインスタンスが1つのownerに対応する。
// Workers KV と異なり、強整合性が保証される。
/// <reference types="@cloudflare/workers-types" />

import { CLIENT_IP_HEADER } from "./types.ts";

interface CounterEnv {
  /** 新規owner作成を接続元IPごとに制限する */
  OWNER_RATE_LIMITER: RateLimit;
}

interface IncrementResult {
  count: number;
  incremented: boolean;
}

export class CounterDO implements DurableObject {
  private count: number | null = null;
  private initialized: boolean | null = null;
  private creationPromise: Promise<IncrementResult> | null = null;
  private ctx: DurableObjectState;
  private env: CounterEnv;

  constructor(ctx: DurableObjectState, env: CounterEnv) {
    this.ctx = ctx;
    this.env = env;
  }

  /**
   * 永続ストレージから現在のカウントを読み込む。
   */
  async getCount(): Promise<number> {
    if (this.count === null || this.initialized === null) {
      // 初回または再起動後: ストレージから復元
      const storedCount = await this.ctx.storage.get<number>("count");
      this.count = storedCount ?? 0;
      this.initialized = storedCount !== undefined;
    }
    return this.count;
  }

  /**
   * カウントを+1して新しい値を返す。
   * ストレージゲートと初回作成Promiseにより競合を防ぐ。
   */
  async increment(clientIp: string): Promise<IncrementResult> {
    const currentCount = await this.getCount();

    if (!this.initialized) {
      // ownerの初回作成だけIP単位の制限を消費する。同じDOへの同時初回要求は
      // 1つのPromiseを共有し、作成枠と初回カウントを重複消費しない。
      const creationPromise = this.creationPromise ??= this.createOwner(clientIp);
      try {
        return await creationPromise;
      } finally {
        if (this.creationPromise === creationPromise) this.creationPromise = null;
      }
    }

    const nextCount = currentCount + 1;
    // SQLite-backed DO storageを唯一の永続ストアとして使用する。
    await this.ctx.storage.put("count", nextCount);
    this.count = nextCount;
    return { count: nextCount, incremented: true };
  }

  private async createOwner(clientIp: string): Promise<IncrementResult> {
    const { success } = await this.env.OWNER_RATE_LIMITER.limit({ key: clientIp });
    if (!success) return { count: 0, incremented: false };

    await this.ctx.storage.put("count", 1);
    this.count = 1;
    this.initialized = true;
    return { count: 1, incremented: true };
  }

  async fetch(request: Request): Promise<Response> {
    const { pathname } = new URL(request.url);

    if (pathname === "/current") {
      return new Response(String(await this.getCount()), {
        status: 200,
        headers: { "X-Count-Incremented": "false" },
      });
    }

    if (pathname === "/increment") {
      const clientIp = request.headers.get(CLIENT_IP_HEADER) ?? "unknown";
      const result = await this.increment(clientIp);
      return new Response(String(result.count), {
        status: result.incremented ? 200 : 429,
        headers: { "X-Count-Incremented": String(result.incremented) },
      });
    }

    return new Response("Not Found", { status: 404 });
  }
}
