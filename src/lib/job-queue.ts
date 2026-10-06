// Developer by: Buildnexdev.in
// Devevloper : Nandhakumar@gmail.com
// Last Edited : 06-10-2026
/**
 * Small in-process job queue with bounded concurrency and retries.
 * Job state is persisted on the domain rows (e.g. photos.status), so pending work is re-queued at startup.
 * For multi-instance deployments swap this for BullMQ/SQS behind the same enqueue() interface.
 */
export class JobQueue<T> {
    private readonly pending: { payload: T; attempt: number }[] = [];
    private readonly queued = new Set<string>();
    private running = 0;
    private idleResolvers: (() => void)[] = [];

    constructor(
        private readonly name: string,
        private readonly worker: (payload: T) => Promise<void>,
        private readonly concurrency = 2,
        private readonly maxAttempts = 3,
        private readonly keyOf: (payload: T) => string = (p) => JSON.stringify(p),
    ) {}

    enqueue(payload: T): void {
        const key = this.keyOf(payload);
        if (this.queued.has(key)) return;
        this.queued.add(key);
        this.pending.push({ payload, attempt: 1 });
        this.pump();
    }

    get size(): number {
        return this.pending.length + this.running;
    }

    /** Resolves when the queue is empty (used by tests and graceful shutdown). */
    idle(): Promise<void> {
        if (this.size === 0) return Promise.resolve();
        return new Promise((resolve) => this.idleResolvers.push(resolve));
    }

    private pump(): void {
        while (this.running < this.concurrency && this.pending.length) {
            const job = this.pending.shift()!;
            this.running++;
            this.worker(job.payload)
                .then(() => this.queued.delete(this.keyOf(job.payload)))
                .catch((err) => {
                    if (job.attempt < this.maxAttempts) {
                        setTimeout(() => {
                            this.pending.push({ payload: job.payload, attempt: job.attempt + 1 });
                            this.pump();
                        }, 500 * 2 ** job.attempt);
                    } else {
                        this.queued.delete(this.keyOf(job.payload));
                        console.error(`[queue:${this.name}] job failed after ${job.attempt} attempts`, err);
                    }
                })
                .finally(() => {
                    this.running--;
                    this.pump();
                    if (this.size === 0) {
                        const resolvers = this.idleResolvers.splice(0);
                        resolvers.forEach((r) => r());
                    }
                });
        }
    }
}
