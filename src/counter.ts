// src/counter.ts
//
// Durable Object によるアトミックなカウンター実装。
// 1つのDOインスタンスが1つのownerに対応する。
// Workers KV と異なり、強整合性が保証される。
/// <reference types="@cloudflare/workers-types" />

export class CounterDO implements DurableObject {
  private count: number | null = null;
  private ctx: DurableObjectState;

  constructor(ctx: DurableObjectState, _env: unknown) {
    this.ctx = ctx;
  }

  /**
   * カウントを+1して新しい値を返す。
   * DO内はシングルスレッドで動作するため競合は発生しない。
   */
  async increment(): Promise<number> {
    if (this.count === null) {
      // 初回または再起動後: ストレージから復元
      this.count = (await this.ctx.storage.get<number>("count")) ?? 0;
    }
    const nextCount = this.count + 1;
    // SQLite-backed DO storageを唯一の永続ストアとして使用する。
    await this.ctx.storage.put("count", nextCount);
    this.count = nextCount;
    return nextCount;
  }

  async fetch(_request: Request): Promise<Response> {
    const count = await this.increment();
    return new Response(String(count), { status: 200 });
  }
}
