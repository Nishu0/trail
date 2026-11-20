# Pipeline services (Go, DynamoDB, Kafka)

A learning project: Trail's pipeline (companies, stages, email drafts) served
by Go services on DynamoDB, with Kafka events added in later steps. Everything
runs locally in Docker. Nothing is deployed.

## Run it

```sh
# 1. Infrastructure: DynamoDB Local (:8000) and its browser (:8001)
docker compose -f services/docker-compose.yml up -d dynamodb dynamodb-admin

# 2. Copy your pipeline from the Next.js app (Postgres is only read; safe to rerun)
cd services/pipeline
go run ./cmd/import -from http://127.0.0.1:3002

# 3. Start the API on :8080
go run ./cmd/pipeline-api

# Tests (the store tests use DynamoDB Local and skip if it is not running)
go test ./...
```

Look at the table at http://localhost:8001.

## API

| Method and path | What it does | DynamoDB operation |
|---|---|---|
| `GET /jobs` | Every job with its drafts | One `Query` on the item collection |
| `GET /jobs?stage=Applied` | Jobs in one stage | `Query` on GSI2 |
| `GET /jobs/{id}` | One job and its drafts | `Query` with `begins_with` |
| `PUT /jobs/{id}` | Create a job (409 if it exists) | `PutItem` + `attribute_not_exists` |
| `PATCH /jobs/{id}/stage` | Move a job; send `expectedVersion` to avoid lost updates | `PutItem` + `Version = :v` |
| `POST /jobs/{id}/drafts` | Add a draft | `PutItem` |
| `PATCH /jobs/{id}/drafts/{draftId}` | Edit subject and body | `UpdateItem` |
| `GET /followups?until=2026-12-31` | Follow-ups due by a date | Range `Query` on sparse GSI1 |

## Table design (single table: `trail-pipeline`)

| PK | SK | Type |
|---|---|---|
| `USER#me` | `JOB#<jobId>` | Job |
| `USER#me` | `JOB#<jobId>#DRAFT#<createdAt>#<draftId>` | Draft |

| Index | Partition key | Sort key | Answers |
|---|---|---|---|
| GSI1 (sparse) | `FOLLOWUP#me` | `<followUp>#<jobId>` | "What follow-ups are due?" Only jobs waiting on a reply have these keys. |
| GSI2 | `USER#me#STAGE#<stage>` | `<addedAt>#<jobId>` | "All jobs in a stage, oldest first" |

Ideas to notice in the code (`internal/store`):

- **Design from access patterns.** Keys are chosen from the queries the app
  makes, not from entities. No `Scan` is used anywhere.
- **Item collections.** A job and its drafts share a partition and sort
  together, so one request returns both.
- **Sparse index.** A job enters GSI1 only while it awaits a reply; archiving
  it removes the keys, so the index is exactly the follow-up queue.
- **Optimistic locking.** Each job has a `Version`; writes are conditional on
  it, so two concurrent edits cannot silently overwrite each other
  (see `TestOptimisticLocking`).
- **Idempotent writes.** `attribute_not_exists(PK)` makes the importer safe to
  rerun.
- **Pagination.** Queries use the SDK paginator; DynamoDB returns at most 1 MB
  per page.

## Connecting the next.js app (step 2)

Set this in `.env.local` and the Pipeline page reads and writes through Go:

```
PIPELINE_API_URL=http://127.0.0.1:8080
```

Remove it and the page goes back to Postgres. With it on, the page shows a
"Go · DynamoDB" badge.

```
browser ── /api/pipeline (next.js) ──► pipeline-api (go) ──► dynamodb local
        └─ /api/draft (writes the email, then saves the draft to go)
```

- the browser never calls go directly. next.js proxies, so there are no CORS
  issues and the origin check still applies.
- stage changes send the version the page last saw (`expectedVersion`). if
  another tab changed the job first, the save fails with "changed by someone
  else" instead of overwriting.
- jobs are still found and saved through Postgres (Discover, Add company).
  when the pipeline loads, any saved job go has not seen yet is copied over.
- stage changes and drafts now live only in DynamoDB. Postgres keeps the old
  values, so the Overview page and the sidebar badge can lag behind. step 3
  fixes this with events.

## Kafka events (step 3)

```sh
docker compose -f services/docker-compose.yml up -d kafka kafka-ui
cd services/pipeline
go run ./cmd/pipeline-api     # now publishes events
go run ./cmd/job-checker      # checks listings
go run ./cmd/postgres-sync    # keeps postgres in step
```

Watch topics and messages at http://localhost:8081. `KAFKA_BROKERS=off` runs
the api without kafka.

```
pipeline-api ── job.saved ─────────┬─► job-checker ── job.health_checked
   (after each  job.stage_changed ─┤     (fetch page, SET health in dynamodb)
   dynamodb     draft.created      └─► postgres-sync
   write)                                (PATCH next.js /api/workspace)
```

| Topic | Published when | Consumed by |
|---|---|---|
| `job.saved` | a job is created in go | job-checker |
| `job.stage_changed` | a job moves stage | job-checker (to Saved or Applied), postgres-sync |
| `draft.created` | a draft is saved | nobody yet |
| `job.health_checked` | the checker finishes | nobody yet |

Ideas to notice (`internal/events`, `cmd/job-checker`, `cmd/postgres-sync`):

- **Keys give ordering.** every event is keyed by job id, so one job's events
  share a partition and arrive in order. that is why postgres-sync can apply
  stage changes one by one and end on the right stage.
- **Partitions give parallelism.** each topic has 3 partitions. job-checker
  runs 3 consumers in one group, one per partition. a 4th would sit idle.
- **At-least-once.** consumers commit the offset only after the handler
  succeeds (`FetchMessage` then `CommitMessages`). a crash replays an event,
  never skips one, so handlers are idempotent.
- **Retries vs permanent errors.** failures retry with backoff (200ms, 400ms,
  ...). errors that can never succeed (bad json, a 400) are wrapped with
  `Permanent` and not retried.
- **Separate consumer groups.** job-checker and postgres-sync both read
  `job.stage_changed` and each gets every event, at its own pace.
- **Writers touch only their own attributes.** `ChangeStage` updates stage
  fields with a version check, and `SetHealth` only sets `health`. so a health
  check landing between your read and your click does not cause a conflict.
- **The dual write.** the api writes dynamodb, then publishes. if kafka is down
  the write stays and the event is lost (logged as "event not published").
  step 4 closes this gap with dynamodb streams.

Replay a topic (how a fixed checker re-checked old events):

```sh
# stop job-checker first; a group can only be rewound while it has no members
docker exec trail-services-kafka-1 /opt/kafka/bin/kafka-consumer-groups.sh \
  --bootstrap-server localhost:9092 --group job-checker \
  --reset-offsets --to-earliest --topic job.stage_changed --execute
```

## Streams, follow-ups and dead letters (step 4)

Run everything (one terminal each, from `services/pipeline`):

```sh
go run ./cmd/pipeline-api          # writes dynamodb only
go run ./cmd/stream-relay          # dynamodb stream -> kafka
go run ./cmd/job-checker
go run ./cmd/postgres-sync
go run ./cmd/followup-scheduler    # -every 1m
go run ./cmd/notifier              # -desktop for a macos notification
go run ./cmd/dlq                   # list dead letters; -replay to retry them
```

```
pipeline-api ─┐                      ┌─► job-checker ──► SET health
              ├─► dynamodb ─stream─► stream-relay ─► kafka ─┼─► postgres-sync ─► next.js
scheduler ────┘  (followUpDue)       (checkpoints)          └─► notifier
                                                    failures ─► events.dlq ─► dlq -replay
```

| Topic | Comes from | Consumed by |
|---|---|---|
| `job.saved` | relay: new Job item | job-checker |
| `job.stage_changed` | relay: Job stage differs between old and new image | job-checker, postgres-sync |
| `draft.created` | relay: new Draft item | nobody yet |
| `followup.due` | relay: `followUpDue` set by the scheduler | notifier |
| `job.health_checked` | job-checker | nobody yet |
| `events.dlq` | any consumer that gave up | `dlq` tool |

Ideas to notice:

- **No more dual write.** the api only writes dynamodb. dynamodb streams is the
  table's own change log, so a saved change always reaches the relay, even if
  kafka or the relay was down at the time. this is change data capture, the
  same idea as the transactional outbox pattern. `EVENT_SOURCE=direct` brings
  back step 3's behaviour for comparison.
- **Old vs new image.** stream records hold the item before and after the
  write (`NEW_AND_OLD_IMAGES`). the relay compares them: a health or note edit
  changes the item but is not an event; a stage difference is.
- **Checkpoints.** after publishing a batch the relay saves the last sequence
  number per shard in `trail-pipeline-relay-checkpoints`. a restart resumes
  there. publish first, checkpoint second: a crash in between republishes,
  never loses. the checkpoint table is separate so its own writes do not feed
  the stream.
- **Stable event ids.** relayed ids are `<stream record id>#<type>`, so a
  republished record has the same id and a consumer could drop the duplicate.
- **A conditional write as a once-only lock.** `MarkFollowUpDue` sets
  `followUpDue` only if it is not already that date. run the scheduler every
  10 seconds or in two terminals: each follow-up fires once (see
  `TestMarkFollowUpDueOnce`). the scheduler never touches kafka.
- **Dead letters.** an event that fails every retry, or is permanently bad,
  goes to `events.dlq` with headers saying where it came from and why, then
  the consumer moves on instead of blocking the partition. if the dlq write
  itself fails, the offset is not committed, so nothing is lost. `dlq -replay`
  sends them back once the cause is fixed; its own consumer group remembers
  what it already replayed.
- **Streams retention is 24 hours.** a relay that is down longer than that
  misses records. on aws you would alarm on relay lag.

## Where to go next

- watch a rebalance: run `go run ./cmd/job-checker -workers 1 -name checker-a`
  and the same with `checker-b`, then
  `docker exec trail-services-kafka-1 /opt/kafka/bin/kafka-consumer-groups.sh --bootstrap-server localhost:9092 --describe --group job-checker`
  shows which client owns each partition. stop one and its partitions move.
- add a consumer for `job.health_checked` that archives closed listings.
- add a dedupe table keyed by event id, so handlers skip repeats instead of
  relying on being idempotent.
- swap DynamoDB Local for real aws with `DYNAMO_ENDPOINT` unset and real
  credentials, or kafka for redpanda: the code does not change.
