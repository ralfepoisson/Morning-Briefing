import 'dotenv/config';
import { createSnapshotJobProcessor } from '../src/modules/snapshots/snapshot-runtime.js';
import { createSnapshotSqsClient } from '../src/modules/snapshots/snapshot-sqs-client.js';
import { runSnapshotWorkerLoop } from '../src/modules/snapshots/snapshot-worker.js';

await runSnapshotWorkerLoop(createSnapshotSqsClient(), createSnapshotJobProcessor());
