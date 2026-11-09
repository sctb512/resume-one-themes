"""Verify declarative and original theme packages and build release archives."""

import argparse
import hashlib
import json
from pathlib import Path
import re
import zipfile

from jsonschema import Draft7Validator


ROOT = Path(__file__).resolve().parents[1]
THEMES = ROOT / "themes"
ID = re.compile(r"community-[a-z0-9][a-z0-9-]{0,52}")
FILE = re.compile(r"[A-Za-z0-9][A-Za-z0-9_.-]*\.(json|txt|md|ttf|otf)")
MAX_PACKAGE_SIZE = 64 * 1024 * 1024


def read_json(path):
    return json.loads(path.read_bytes())


def serialized(value):
    return (json.dumps(value, ensure_ascii=False, indent=2) + "\n").encode("utf-8")


def package_files(directory):
    entries = sorted(directory.iterdir())
    if len(entries) > 32:
        raise ValueError(f"{directory.name} has more than 32 files")
    sizes = 0
    hashes = {}
    for path in entries:
        if path.is_symlink() or not path.is_file() or not FILE.fullmatch(path.name):
            raise ValueError(f"Unexpected package entry {path.relative_to(ROOT)}")
        size = path.stat().st_size
        sizes += size
        if size > 16 * 1024 * 1024 or sizes > MAX_PACKAGE_SIZE:
            raise ValueError(f"{directory.name} exceeds package size limits")
        hashes[path.name] = hashlib.sha256(path.read_bytes()).hexdigest()
    return hashes


def catalogs():
    manifest_schema = Draft7Validator(read_json(ROOT / "spec/resume-one-theme-v2.schema.json"))
    source_schema = Draft7Validator(read_json(ROOT / "spec/resume-one-theme-source-v1.schema.json"))
    if THEMES.is_symlink() or not THEMES.is_dir():
        raise ValueError("The themes directory must be a regular directory")
    directories = sorted(THEMES.iterdir())
    if not 1 <= len(directories) <= 256:
        raise ValueError("Expected between 1 and 256 theme packages")

    packages = []
    online = []
    migrated = []
    for directory in directories:
        if directory.is_symlink() or not directory.is_dir() or not ID.fullmatch(directory.name):
            raise ValueError(f"Invalid package directory {directory.name}")
        hashes = package_files(directory)
        required = {"theme.json", "LICENSE.txt", "NOTICE.txt", "MIGRATION.json"}
        if missing := required.difference(hashes):
            raise ValueError(f"{directory.name} lacks {', '.join(sorted(missing))}")
        manifest_path = directory / "theme.json"
        if manifest_path.stat().st_size > 1024 * 1024:
            raise ValueError(f"{directory.name} manifest exceeds 1 MiB")
        manifest = read_json(manifest_path)
        manifest_schema.validate(manifest)
        provenance = manifest.get("provenance", {})
        if manifest["id"] != directory.name or provenance.get("fidelity") != "adapted":
            raise ValueError(f"{directory.name} must identify its migration package")
        if provenance.get("upstreamLicense") != manifest.get("license"):
            raise ValueError(f"{directory.name} license differs from its provenance")
        report = read_json(directory / "MIGRATION.json")
        if report.get("executedSourceCode") is not False or report.get("resumeModified") is not False:
            raise ValueError(f"{directory.name} lacks a static migration record")
        fonts = manifest.get("assets", {}).get("fonts", [])
        font_names = set()
        for font in fonts:
            path = font["path"]
            if path in font_names or hashes.get(path) != font["sha256"].lower():
                raise ValueError(f"{directory.name} has a missing, duplicate or changed font {path}")
            font_names.add(path)
        if font_names != {name for name in hashes if name.endswith((".ttf", ".otf"))}:
            raise ValueError(f"{directory.name} contains an unreferenced font")
        entry = {
            "id": manifest["id"],
            "name": manifest["name"],
            "manifest": manifest_path.relative_to(ROOT).as_posix(),
            "sha256": hashes["theme.json"],
        }
        packages.append({
            **entry, "license": manifest["license"],
            "upstream": provenance.get("upstreamUrl"), "files": hashes,
        })
        if not manifest.get("assets"):
            online.append(entry)
        resources = {name: digest for name, digest in hashes.items() if name != "theme.json" and not name.endswith(".json")}
        for name in resources:
            limit = 8 * 1024 * 1024 if name in font_names else 1024 * 1024
            if (directory / name).stat().st_size > limit:
                raise ValueError(f"{directory.name}/{name} exceeds the online resource limit")
        if sum((directory / name).stat().st_size for name in resources) + manifest_path.stat().st_size > 32 * 1024 * 1024:
            raise ValueError(f"{directory.name} exceeds the online package limit")
        migrated.append({**entry, "files": resources})
    source = {"version": 1, "themes": online}
    source_schema.validate(source)
    complete = {"version": 1, "themes": migrated}
    source_schema.validate(complete)
    return {
        "index.json": serialized(source),
        "migrated-index.json": serialized(complete),
        "packages.json": serialized({"version": 1, "status": "adapted", "packages": packages}),
    }, len(packages), len(migrated)


def original_catalog_files():
    directory = ROOT / "originals"
    index = directory / "index.json"
    source = read_json(index)
    Draft7Validator(read_json(ROOT / "spec/resume-one-theme-source-v1.schema.json")).validate(source)
    validator = Draft7Validator(read_json(ROOT / "spec/json-resume-original-theme-v1.schema.json"))
    if not source["themes"] or directory.is_symlink() or (directory / "notices").is_symlink():
        raise ValueError("Missing or invalid original theme catalog")
    files = {index}
    seen_ids = set()
    for entry in source["themes"]:
        match = re.fullmatch(r"([a-z0-9-]+)\.original\.theme\.json", entry["manifest"])
        if not match or entry["id"] in seen_ids:
            raise ValueError(f"Invalid original theme catalog entry {entry['id']}")
        seen_ids.add(entry["id"])
        manifest = directory / entry["manifest"]
        notice = directory / "notices" / (match[1] + ".txt")
        if manifest in files or any(path.is_symlink() or not path.is_file() for path in (manifest, notice)):
            raise ValueError(f"Missing, duplicate or unsafe original package {manifest.name}")
        if manifest.stat().st_size > 1024 * 1024 or not notice.stat().st_size:
            raise ValueError(f"Invalid original package size or empty notice {manifest.name}")
        if hashlib.sha256(manifest.read_bytes()).hexdigest() != entry.get("sha256"):
            raise ValueError(f"Original theme checksum mismatch for {manifest.name}")
        original = read_json(manifest)
        validator.validate(original)
        if (original["id"], original["name"]) != (entry["id"], entry["name"]):
            raise ValueError(f"Original theme identity mismatch for {manifest.name}")
        files.update((manifest, notice))
    actual = {*directory.glob("*.original.theme.json"), *(directory / "notices").glob("*.txt"), index}
    if files != actual:
        raise ValueError("Unindexed original packages or notices")
    return sorted(files), len(seen_ids)



def pack(output, documents, originals):
    output.parent.mkdir(parents=True, exist_ok=True)
    # Avoid overwriting an earlier artifact. A fixed timestamp keeps repeated
    # runs with the same inputs reproducible.
    with zipfile.ZipFile(output, "x") as archive:
        files = [ROOT / name for name in documents] + [ROOT / "README.md"]
        files.extend(sorted((ROOT / "spec").glob("*.schema.json")))
        files.extend(path for directory in sorted(THEMES.iterdir()) for path in sorted(directory.iterdir()))
        files.extend(originals)
        for path in files:
            info = zipfile.ZipInfo(path.relative_to(ROOT).as_posix(), (1980, 1, 1, 0, 0, 0))
            info.create_system = 3
            info.external_attr = 0o100644 << 16
            archive.writestr(info, path.read_bytes(), compress_type=zipfile.ZIP_DEFLATED)
    digest = hashlib.sha256(output.read_bytes()).hexdigest()
    output.with_name("SHA256SUMS").write_text(f"{digest}  {output.name}\n", encoding="ascii")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--write", action="store_true", help="Regenerate the checked-in catalogs.")
    mode.add_argument("--pack", type=Path, help="Create a ZIP from the verified catalogs and packages.")
    args = parser.parse_args()
    documents, count, online = catalogs()
    for name, content in documents.items():
        path = ROOT / name
        if args.write:
            path.write_bytes(content)
        elif path.read_bytes() != content:
            raise ValueError(f"{name} is out of date. Run tools/catalog.py --write.")
    originals, original_count = original_catalog_files()
    if args.pack:
        pack(args.pack, documents, originals)
    print(f"Validated {count} adapted packages, {online} adapted online entries and {original_count} originals.")


if __name__ == "__main__":
    main()
