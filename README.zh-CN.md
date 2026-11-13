# 简里社区主题

[English](./README.md) · **简体中文**

这里保存 67 套声明式社区主题。基础主题由 Resume One 迁移工具从固定上游版本生成，再逐套审校为 A4 版式，调整边距、文字层级及装饰。每个 `themes/community-*/` 目录都有最终主题、许可正文、出处和初始迁移记录，使用独立字体资源的主题也附有字体许可。`NOTICE.txt` 记录上游的许可声明和所附许可文本来源。Rick Osborne 主题使用 CC BY-NC-SA 4.0，出处和完整许可在对应目录。

从 [版本发布页](https://github.com/sctb512/resume-one-themes/releases) 下载 ZIP 后，解压并在简里的「管理」中将本地主题目录指向其中的 `themes/`。1.1.0 适配版以清楚易读为目标，保留每套的主要版式特征。逐套使用中文和英文样本检查 PDF 页宽及文字边界，并验证 DOCX 文件内容。

新版简里默认提供两个在线来源，都指向此仓库的 `main` 分支：

| 展示名称 | 清单路径 | 内容 |
| --- | --- | --- |
| 迁移版社区主题 | [migrated-index.json](./migrated-index.json) | 全部 67 套声明式主题及字体、许可和署名文件 |
| 原版 JSON Resume | [originals/index.json](./originals/index.json) | 13 套经本机兼容验收的上游渲染包 |

旧的 `index.json` 继续提供 22 套单文件主题，供旧版应用使用。`packages.json` 记录完整迁移包的文件摘要。下载后可离线使用。

主题文件格式见 [简里主题规范](https://github.com/sctb512/resume-one/blob/main/spec/resume-one-theme-spec-v2.zh-CN.md)。迁移工具与应用代码位于 [resume-one](https://github.com/sctb512/resume-one/blob/main/README.zh-CN.md)。

已安装的应用会按上述路径读取在线索引。适配主题位于 [`themes/`](./themes/)，原版主题位于 [`originals/`](./originals/)，校验与打包工具位于 [`tools/`](./tools/)。本仓库的 [Schema](./spec/schemas/) 是应用仓库中对应文件的副本，便于独立校验。共享 Schema 变更时需同步更新。

## 主题语言

67 套迁移主题在 `localizations.txt` 提供英文简介，以及原主题自带栏目标题的简体中文译名。文件内容为 UTF-8 JSON，与声明式主题的 `localizations` 字段结构一致，由在线索引校验哈希。应用按语言和原主题标题回退。已下载的主题包可以保留整个文件夹，旧版应用仍可读取其中的 `theme.json`。

## 原版 JSON Resume

`originals/index.json` 是简里默认在线源的索引。每个 `.original.theme.json` 保存固定版本的上游 npm 渲染器、模板及可离线使用的样式。主题包用本机简历渲染，由简里提供预览和 PDF。原始项目链接、上游许可声明及随包提供的许可正文见 `originals/notices/`。外部字体、照片和脚本只在随包且可在本机安全渲染时可用。

初始目录包含 Pro、Academic CV Lite、Executive Slate、Colophon、Elegant、Even、Flat (npm)、Kendall、Lucide、Macchiato、Minyma、Paper Plus Plus 和 Pumpkin。目录随本机兼容验收扩展。Flat 固定为 npm 版本，可能与官网目前部署的 Flat 不同。已有 67 套声明式主题继续从 `themes/` 交付。

在仓库根目录重建原版主题包：

```sh
(cd tools/originals && npm ci --ignore-scripts --no-audit --no-fund && node build.mjs)
```

`package-lock.json` 固定主题及依赖的完整性摘要。构建只绑定主题自身的静态模板、样式和运行所需接口，旧版的动态文件路径在构建时解析。Academic CV Lite 和 Executive Slate 的服务端模板使用受限的英文月年格式适配。新增主题须用合成简历验证预览和 PDF 后再进入索引。包格式见 [JSON Schema](./spec/schemas/json-resume-original-theme-v1.schema.json)。

## 验证和发布

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
.venv/bin/python tools/catalog.py
.venv/bin/python tools/catalog.py --pack dist/Resume-One-Community-Themes.zip
```

更新 `themes/` 后运行 `.venv/bin/python tools/catalog.py --write`，一并提交主题包和相关索引。流水线会重新打包原版主题，并校验两类主题的 Schema、许可说明、资源 SHA-256 和索引一致性。推送 `v*` 标签后生成 ZIP、校验文件和索引，并创建 GitHub 预发布。也可对同一标签手动运行发布；对分支手动运行只生成流水线制品。
