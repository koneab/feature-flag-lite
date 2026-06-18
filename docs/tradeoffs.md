# Design Tradeoffs

This document captures key architectural decisions made in Feature Flag Lite, the alternatives considered, and the rationale behind each choice.

---

## 1. In-Memory Storage (Map) vs Database

**Decision:** Use an in-memory `Map<string, FeatureFlag>` for flag storage.

**Alternatives Considered:**

| Option | Pros | Cons |
|--------|------|------|
| PostgreSQL | Durable, queryable, production-ready | Requires running a database server, connection pooling, migrations |
| Redis | Fast, supports TTL, pub/sub for cache invalidation | External dependency, adds operational complexity |
| SQLite | File-based, no server needed | Limited concurrency, not ideal for containerized deployments |

**Rationale:**

- Zero operational dependencies — the service starts with `npm start` and nothing else.
- O(1) lookups via Map provide excellent read performance for flag evaluation.
- Simple to understand and reason about for a portfolio project.
- The repository interface pattern (`FlagRepository`) makes it straightforward to swap in a persistent store later without changing business logic.
- Acceptable tradeoff: data is lost on restart, which is fine for an MVP/demo context.

---

## 2. SHA-256 vs CRC32 for Deterministic Hashing

**Decision:** Use SHA-256 via Node.js built-in `crypto` module for deterministic user bucketing.

**Alternatives Considered:**

| Option | Pros | Cons |
|--------|------|------|
| CRC32 | Very fast, small output | Higher collision rates, less uniform distribution |
| MurmurHash | Fast, good distribution | Requires external dependency (`murmurhash` package) |
| FNV-1a | Simple implementation, fast | Less uniform than SHA-256 for percentage bucketing |

**Rationale:**

- Built into Node.js — no external dependencies required.
- Excellent uniform distribution ensures accurate percentage-based rollouts across user populations.
- Well-understood cryptographic properties guarantee negligible collision rates.
- Performance is more than adequate: hashing a short string (flagName + userId) takes microseconds, and feature flag evaluation is not a hot path requiring nanosecond optimization.
- Correctness matters more than raw speed for a feature flag system — incorrect bucketing could expose features to the wrong users.

---

## 3. Express vs Fastify Framework

**Decision:** Use Express as the HTTP framework.

**Alternatives Considered:**

| Option | Pros | Cons |
|--------|------|------|
| Fastify | Higher throughput, built-in schema validation | Smaller ecosystem, less familiar to most developers |
| Koa | Lightweight, modern async/await design | Smaller community, fewer middleware options |
| Hapi | Configuration-driven, built-in validation | Heavier, steeper learning curve |

**Rationale:**

- Most widely adopted Node.js framework with the largest ecosystem of middleware and plugins.
- Familiar to the majority of developers who may review this portfolio project.
- Extensive documentation and community support make onboarding trivial.
- Adequate performance for a feature flag service — flag evaluation latency is dominated by business logic, not HTTP framework overhead.
- Mature error handling patterns and middleware composition model are well-suited to the layered architecture.
- The performance gap with Fastify is irrelevant at the scale this service operates (feature flag APIs rarely need extreme throughput).
