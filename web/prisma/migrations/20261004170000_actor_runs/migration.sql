-- Actor runs and dataset items for the MCP actor runtime.

CREATE TABLE "ActorRun" (
    "id" TEXT NOT NULL,
    "actorName" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "input" JSONB NOT NULL,
    "datasetId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "log" TEXT,
    "jobsFound" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ActorRun_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ActorRun_datasetId_key" ON "ActorRun"("datasetId");
CREATE INDEX "ActorRun_actorName_startedAt_idx" ON "ActorRun"("actorName", "startedAt");

CREATE TABLE "DatasetItem" (
    "id" TEXT NOT NULL,
    "datasetId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DatasetItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DatasetItem_datasetId_idx" ON "DatasetItem"("datasetId");

ALTER TABLE "DatasetItem" ADD CONSTRAINT "DatasetItem_runId_fkey" FOREIGN KEY ("runId") REFERENCES "ActorRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
