# grafik_vichoda

## GitHub Pages: почему может падать `pages build and deployment`

Если в настройках репозитория выбран режим `Deploy from a branch` и источник `/docs`,
GitHub запускает Jekyll-сборку. Когда папки `docs` нет, job падает с ошибкой вида:

- `No such file or directory @ dir_chdir0 - /github/workspace/docs`

Репозиторий уже содержит workflow `Deploy to GitHub Pages` через GitHub Actions
(`.github/workflows/deploy-pages.yml`), поэтому правильный вариант:

1. Открыть `Settings → Pages`.
2. В блоке `Build and deployment` выбрать `Source: GitHub Actions`.
3. Сохранить и запустить workflow повторно.

> В репозитории добавлены `docs/.nojekyll` и `docs/index.html` как защитный fallback,
> чтобы branch-mode с `/docs` не падал мгновенно из-за отсутствующей директории.
