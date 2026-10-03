#!/usr/bin/env python3
"""Validate a Sancta Maria ZIP and restore to a new local directory only."""
import argparse
import hashlib
import io
import json
import shutil
import sqlite3
import sys
import zipfile
from pathlib import Path, PurePosixPath


def fail(message):
    raise ValueError(message)


def sha(data):
    return hashlib.sha256(data).hexdigest()


def safe_name(name):
    parts = PurePosixPath(name)
    if not name or parts.is_absolute() or ".." in parts.parts or "\\" in name or ":" in name:
        fail(f"Unsafe archive path: {name!r}")
    return parts


def verify_archive(archive):
    names = archive.namelist()
    if len(names) != len(set(names)):
        fail("Duplicate archive paths")
    for name in names:
        safe_name(name)
    manifest = json.loads(archive.read("manifest.json"))
    if manifest.get("format") != "sancta-maria-complete-backup-v1" or manifest.get("status") != "complete":
        fail("This is not a complete Sancta Maria backup")
    expected = {"manifest.json"}
    for item in manifest["files"]:
        path = item["path"]
        if path in expected:
            fail("Duplicate manifest entry")
        expected.add(path)
        content = archive.read(path)
        if len(content) != item["bytes"] or sha(content) != item["sha256"]:
            fail(f"Checksum mismatch: {path}")
    if set(names) != expected:
        fail("Archive content differs from its manifest")
    source_bytes = archive.read("source.zip")
    if sha(source_bytes) != manifest["source"]["sha256"]:
        fail("Source ZIP checksum mismatch")
    with zipfile.ZipFile(io.BytesIO(source_bytes)) as source:
        source_names = source.namelist()
        if len(source_names) != len(set(source_names)):
            fail("Duplicate source paths")
        index = json.loads(source.read("source-manifest.json"))
        source_expected = {"source-manifest.json"}
        for item in index["files"]:
            name = item["path"]
            safe_name(name)
            if name in source_expected:
                fail("Duplicate source manifest entry")
            source_expected.add(name)
            content = source.read(name)
            if len(content) != item["bytes"] or sha(content) != item["sha256"]:
                fail(f"Source checksum mismatch: {name}")
        if set(source_names) != source_expected:
            fail("Source file list mismatch")
        tree = json.dumps(index["files"], ensure_ascii=False, separators=(",", ":")).encode()
        if sha(tree) != index["sourceTreeSha256"] or sha(tree) != manifest["source"]["treeSha256"]:
            fail("Source tree checksum mismatch")
    media = json.loads(archive.read("media-index.json"))
    if len(media) != manifest["mediaObjects"] or len({x["key"] for x in media}) != len(media):
        fail("Media inventory mismatch")
    for item in media:
        content = archive.read(item["file"])
        if len(content) != item["bytes"] or sha(content) != item["sha256"]:
            fail(f"Media checksum mismatch: {item['file']}")
    database = json.loads(archive.read("database.json"))
    if {name: len(rows) for name, rows in database["tables"].items()} != manifest["tables"]:
        fail("Database row counts differ from manifest")
    return manifest, database


def quoted(name):
    return '"' + name.replace('"', '""') + '"'


def restore_database(path, database):
    con = sqlite3.connect(path)
    try:
        con.execute("PRAGMA foreign_keys=OFF")
        con.execute("BEGIN")
        for item in database["schema"]:
            if item["type"] == "table":
                con.execute(item["sql"])
        for table, rows in database["tables"].items():
            for row in rows:
                columns = list(row)
                values = [bytes(row[key]) if isinstance(row[key], list) else row[key] for key in columns]
                sql = f"INSERT INTO {quoted(table)} ({','.join(map(quoted, columns))}) VALUES ({','.join('?' for _ in columns)})"
                con.execute(sql, values)
        for item in database["schema"]:
            if item["type"] != "table":
                con.execute(item["sql"])
        con.commit()
        if con.execute("PRAGMA integrity_check").fetchall() != [("ok",)]:
            fail("SQLite integrity check failed")
        if con.execute("PRAGMA foreign_key_check").fetchall():
            fail("SQLite foreign-key check failed")
        for table, rows in database["tables"].items():
            count = con.execute(f"SELECT count(*) FROM {quoted(table)}").fetchone()[0]
            if count != len(rows):
                fail(f"Row count mismatch: {table}")
    finally:
        con.close()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("backup", type=Path)
    parser.add_argument("--check-only", action="store_true")
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    if not args.check_only and not args.output:
        parser.error("Choose --check-only or --output NEW_DIRECTORY")
    if args.output and args.output.exists():
        fail("Output directory already exists; nothing was changed")
    with zipfile.ZipFile(args.backup) as archive:
        manifest, database = verify_archive(archive)
        if args.check_only:
            # Check actual SQLite restoration too, without leaving files behind.
            restore_database(":memory:", database)
        else:
            args.output.mkdir(parents=True, exist_ok=False)
            try:
                for name in archive.namelist():
                    target = args.output / safe_name(name)
                    target.parent.mkdir(parents=True, exist_ok=True)
                    target.write_bytes(archive.read(name))
                source_directory = args.output / "source"
                with zipfile.ZipFile(io.BytesIO(archive.read("source.zip"))) as source:
                    for name in source.namelist():
                        target = source_directory / safe_name(name)
                        target.parent.mkdir(parents=True, exist_ok=True)
                        target.write_bytes(source.read(name))
                for script in (source_directory / "scripts").glob("*.sh"):
                    script.chmod(script.stat().st_mode | 0o100)
                restore_database(str(args.output / "database.sqlite"), database)
            except Exception:
                shutil.rmtree(args.output)
                raise
    print(json.dumps({"status": "verified", "captured_at": manifest["databaseCapturedAt"], "tables": len(manifest["tables"]), "rows": sum(manifest["tables"].values()), "media_objects": manifest["mediaObjects"], "output": str(args.output) if args.output else None}, ensure_ascii=False))


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"Backup verification failed: {error}", file=sys.stderr)
        sys.exit(1)
