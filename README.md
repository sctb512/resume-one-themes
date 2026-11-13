# Resume One Community Themes

**English** · [简体中文](./README.zh-CN.md)

This repository hosts 67 declarative community themes for [Resume One](https://github.com/sctb512/resume-one). The migration tool generates each base theme from a pinned upstream version. The adapted layouts are then reviewed for A4 margins, typography, and decoration. Each `themes/community-*/` folder includes the theme, license, attribution, and initial migration record. Font licenses are included where applicable. The Rick Osborne theme is distributed under CC BY-NC-SA 4.0.

## Using themes

Resume One has two default online sources on this repository’s `main` branch.

| Source | Catalog | Contents |
| --- | --- | --- |
| Adapted Community Themes | [migrated-index.json](./migrated-index.json) | 67 declarative themes with fonts, licenses, and attribution |
| Original JSON Resume | [originals/index.json](./originals/index.json) | 13 pinned upstream templates tested for local rendering |

To use themes offline, download a ZIP from [Releases](https://github.com/sctb512/resume-one-themes/releases), extract it, and point Resume One’s local theme directory at `themes/`. Keep each theme folder intact. The adapted layouts were reviewed with Chinese and English sample résumés for PDF page width and text boundaries. DOCX contents were also checked.

The legacy [index.json](./index.json) provides 22 single-file themes for older versions. [packages.json](./packages.json) lists file digests for the complete adapted packages. See the [declarative theme specification](https://github.com/sctb512/resume-one/blob/main/spec/resume-one-theme-spec-v2.md) for the file format.

The catalog paths are used by installed versions of the app. Adapted packages live in [`themes/`](./themes/), original packages in [`originals/`](./originals/), and validation tools in [`tools/`](./tools/). The standalone validator uses copies of the app's [schemas](./spec/schemas/). Update these copies from the app repository whenever the shared schemas change.

## Theme language

Each adapted theme includes a `localizations.txt` companion with an English description and Simplified Chinese translations of any section headings defined by the theme. The file contains UTF-8 JSON and is verified against the catalog digest. Resume One uses the active language and falls back to the original labels where needed. Older app versions can still read the `theme.json` in each folder.

## Original JSON Resume themes

Each `.original.theme.json` package contains a pinned upstream renderer, templates, and styles for offline use. Resume One renders the current résumé locally for preview and PDF. See [upstream notices](./originals/notices/) for project links and licenses. The Flat theme is pinned to the npm release and may look different from the template currently deployed by JSON Resume.

The catalog includes Pro, Academic CV Lite, Executive Slate, Colophon, Elegant, Even, Flat (npm), Kendall, Lucide, Macchiato, Minyma, Paper Plus Plus, and Pumpkin. It grows as more packages pass local compatibility checks.

Rebuild the original packages from the repository root:

```sh
(cd tools/originals && npm ci --ignore-scripts --no-audit --no-fund && node build.mjs)
```

The lockfile pins the themes and dependencies. The build resolves legacy dynamic file paths at build time and adapts month-year formatting for Academic CV Lite and Executive Slate. Add new packages to the catalog after checking their preview and PDF with a synthetic résumé. See the [original package JSON Schema](./spec/schemas/json-resume-original-theme-v1.schema.json).

## Validation and publishing

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
.venv/bin/python tools/catalog.py
.venv/bin/python tools/catalog.py --pack dist/Resume-One-Community-Themes.zip
```

After changing `themes/`, run `.venv/bin/python tools/catalog.py --write` and commit the packages and their updated catalogs together. GitHub Actions rebuilds the original catalog and verifies schemas, license notices, SHA-256 digests, and catalog consistency for both theme types. Pushing a `v*` tag publishes a preview release with the ZIP, checksum, and catalogs. A manual run on a branch generates workflow artifacts.
