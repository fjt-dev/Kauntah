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
   * 初回作成Promiseとストレージトランザクションにより競合を防ぐ。
   */
  async increment(clientIp: string): Promise<IncrementResult> {
    await this.getCount();

    if (!this.initialized) {
      // ownerの初回作成だけIP単位の制限を消費する。同じDOへの同時初回要求は
      // 1つのPromiseを共有し、作成枠を重複消費しない。
      const isCreator = this.creationPromise === null;
      const creationPromise = this.creationPromise ??= this.createOwner(clientIp);
      let creationResult: IncrementResult;
      try {
        creationResult = await creationPromise;
      } finally {
        if (this.creationPromise === creationPromise) this.creationPromise = null;
      }

      // 作成者の要求はcreateOwner()が初回値1を書き込んでいる。待機していた
      // 各要求は、作成完了後にそれぞれ1回ずつ追加でインクリメントする。
      if (isCreator || !creationResult.incremented) return creationResult;
    }

    return this.incrementExistingOwner();
  }

  private async incrementExistingOwner(): Promise<IncrementResult> {
    // 同時要求も1件ずつ確実に加算されるようread-modify-writeを原子的に行う。
    const nextCount = await this.ctx.storage.transaction(async (txn) => {
      const currentCount = (await txn.get<number>("count")) ?? 0;
      const nextValue = currentCount + 1;
      await txn.put("count", nextValue);
      return nextValue;
    });
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
