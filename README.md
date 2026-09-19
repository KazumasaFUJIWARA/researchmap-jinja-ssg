# researchmap-jinja-ssg

藤原和将（龍谷大学 先端理工学部）の研究者個人サイトのソースです。

ResearchMap API で業績を取得し、**Jinja で静的 HTML を生成（SSG）**して公開します。サーバー上ではビルドしません。完成品だけを `deploy` ブランチ経由で配信します。

ResearchMap API をひな形にしたサイトを運用している場合、**SSG 化の参考**にしてください。旧来のようにブラウザで `fetch(json)` する構成から、ビルド時に HTML へ焼き込む形へ移行する一例です。

公開リポジトリ: https://github.com/KazumasaFUJIWARA/researchmap-jinja-ssg

---

## 公開の流れ

```
ResearchMap API
    → updater/update_merge.py → json/data.json
json/*.json + templates/ + static/
    → scripts/build.py → dist/
    → GitHub Actions が orphan ブランチ `deploy` へ force-push
サーバー
    → deploy を浅い clone / 日次 sync（fetch + reset --hard）
    → document root で静的配信
```

`deploy` は履歴を共有しない orphan ブランチです。サーバー側は `git pull` ではなく `git fetch --depth 1 && git reset --hard origin/deploy` で追従します。

---

## ページ構成

| ページ | 英語 | 日本語 | 内容 |
|--------|:----:|:------:|------|
| ホーム | `index.html` | `ja/index.html` | 所属・研究テーマ・連絡先・ニュース |
| CV | `cv.html` | `ja/cv.html` | 経歴・学位・職歴・受賞など |
| 論文 | `articles.html` | `ja/articles.html` | 論文リスト・BibTeX |
| 講演 | `talks.html` | `ja/talks.html` | 国際 / 国内講演 |
| リンク | `links.html` | `ja/links.html` | 外部リンク・GitHub（GitHub タブは日本語のみ） |
| 講義 | — | `ja/lectures.html` | 講義情報・オフィスアワー |
| ノート | — | `ja/notes.html` | 覚書・数値シミュレーション |
| 予定 | — | `ja/schedule.html` | カレンダー |

ビルド成果物には `json/` を載せません。表示に必要な文字列は HTML 生成時に埋め込みます。ノート内のインタラクティブ部分など、必要なクライアント JS だけを `static/js/` から同梱します。

---

## ディレクトリ構成（ソース）

```
.
├── templates/           # Jinja テンプレート（*.jinja）
├── static/              # ビルドにコピーする静的ファイル（CSS / JS / 画像など）
├── json/                # データ（公開ブランチ deploy には含めない）
│   ├── data.json        # ResearchMap から取得（直接編集禁止）
│   ├── profile.json     # 連絡先・リンク・オフィスなど（手動）
│   ├── news.json        # ニュース（手動）
│   └── note.json        # 覚書（手動）
├── scripts/
│   ├── build.py         # dist/ を生成
│   └── verify.py        # 成果物の検査
├── updater/             # ResearchMap 取得スクリプト
├── site.json            # ナビ・ページメタなどサイト設定
├── dist/                # ローカルビルド出力（gitignore）
└── .github/workflows/   # build-deploy / ResearchMap 更新
```

---

## ローカルでのビルド

```bash
pip install -r requirements-build.txt
python scripts/build.py
python scripts/verify.py dist
python -m http.server 8000 --directory dist
```

ResearchMap データの再取得:

```bash
cd updater
python3 update_merge.py   # 推奨（セクション別取得）
```

`json/data.json` の手編集はしないでください。

---

## データ更新の目安

| 対象 | 編集・実行 |
|------|------------|
| 論文・講演・CV 等 | `updater/update_merge.py` |
| ニュース | `json/news.json` |
| 覚書 | `json/note.json` |
| 連絡先・リンク・オフィス | `json/profile.json` |
| 見た目・文言の枠 | `templates/` / `site.json` / `static/` |

`main` への push（および月次スケジュール）で Actions が build → `deploy` 更新します。

---

## 本番サーバー（概要）

想定レイアウト（旧 whale のパスを踏襲）:

```
~/mypage-deploy                          # deploy ブランチの浅い clone
/var/www/fujiwara-kazumasa.math.ryukoku.ac.jp/html
    → ~/mypage-deploy へのシンボリックリンク
```

詳細なサーバー作業メモは運用側の `DEPLOY-README` 等を参照してください。

---

## 参考

- [ResearchMap API](https://api.researchmap.jp/KazumasaFUJIWARA/)
- [Zenn: researchmap API の使い方](https://zenn.dev/nakamura196/articles/bb91ead115b920)
- [GitHub Primer](https://primer.style/)（UI の雰囲気の参考）

---

## ライセンス

MIT License
