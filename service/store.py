import os
from contextlib import contextmanager

import psycopg
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb

DATABASE_URL = os.getenv("DATABASE_URL", "")

SCHEMA = """
create table if not exists actor_run (
  id text primary key,
  actor_name text not null,
  status text not null,
  input jsonb not null,
  dataset_id text unique not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  error_message text,
  jobs_found int not null default 0
);
create table if not exists dataset_item (
  id text primary key,
  dataset_id text not null,
  run_id text not null references actor_run(id) on delete cascade,
  data jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists dataset_item_dataset_id_idx on dataset_item(dataset_id);
"""


def database_url() -> str:
    if not DATABASE_URL:
        raise RuntimeError("DATABASE_URL is required")
    return DATABASE_URL


@contextmanager
def connect():
    with psycopg.connect(database_url(), row_factory=dict_row) as conn:
        yield conn


def init_db() -> None:
    with connect() as conn:
        conn.execute(SCHEMA)
        conn.commit()


def create_run(run_id: str, dataset_id: str, actor_name: str, payload: dict) -> None:
    with connect() as conn:
        conn.execute(
            """
            insert into actor_run (id, actor_name, status, input, dataset_id)
            values (%s, %s, 'RUNNING', %s, %s)
            """,
            (run_id, actor_name, Jsonb(payload), dataset_id),
        )
        conn.commit()


def finish_run(run_id: str, status: str, jobs_found: int, error: str | None = None) -> None:
    with connect() as conn:
        conn.execute(
            """
            update actor_run
            set status = %s, finished_at = now(), jobs_found = %s, error_message = %s
            where id = %s
            """,
            (status, jobs_found, error, run_id),
        )
        conn.commit()


def add_items(run_id: str, dataset_id: str, items: list[dict]) -> None:
    if not items:
        return
    with connect() as conn:
        with conn.cursor() as cur:
            cur.executemany(
                """
                insert into dataset_item (id, dataset_id, run_id, data)
                values (%s, %s, %s, %s)
                """,
                [(item["id"], dataset_id, run_id, Jsonb(item["data"])) for item in items],
            )
        conn.commit()


def get_run(run_id: str) -> dict | None:
    with connect() as conn:
        row = conn.execute("select * from actor_run where id = %s", (run_id,)).fetchone()
    return dict(row) if row else None


def get_items(dataset_id: str, limit: int, offset: int) -> tuple[int, list[dict]]:
    with connect() as conn:
        total = conn.execute(
            "select count(*) as n from dataset_item where dataset_id = %s",
            (dataset_id,),
        ).fetchone()["n"]
        rows = conn.execute(
            """
            select data from dataset_item
            where dataset_id = %s
            order by created_at
            limit %s offset %s
            """,
            (dataset_id, limit, offset),
        ).fetchall()
    return total, [row["data"] for row in rows]
