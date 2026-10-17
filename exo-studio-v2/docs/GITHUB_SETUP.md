# Publishing EXO Sample 3D on GitHub

The local Git history is preserved. Publish only **after** reviewing staged
source changes and signing into the GitHub account that should own the repo.
The public source is explicitly an experimental development release, not a
certified production garment simulator or factory export product.

## What belongs in this repository

- First-party React app, JavaScript CAD and fabric tools, scripts and tests
- Optional Rust PPF backend **integration** (not a copied third-party solver)
- Native app / experimental C++ sources, kept as optional research components
- Readmes, contributor guidance, license and GitHub Actions workflows

Generated binaries, Qt SDKs, CMake directories, proprietary CLO avatars,
locally cloned upstream code, model datasets, logs, video masters and credentials are
excluded by `.gitignore`; retain them on your workstation/backups.

## GitHub access and publication

The canonical repository is https://github.com/mikristian/exo-sample-3d.
Its historical working name was SAMPL3D. **Do not create a duplicate repository**;
these instructions are only for an entirely new fork or owner.

Install the official GitHub CLI (https://cli.github.com/) and authenticate:

```bash
gh auth login --web
gh auth status
```

From the EXO Sample 3D project directory, after its reviewed initial commit:

```bash
gh repo create exo-sample-3d --public --source=. --remote=origin --push
```

Do not run `gh repo create` twice. If the remote repository already exists,
configure its URL using `git remote add origin <your-repo-URL>` and use
`git push -u origin main` instead. Never force-push without reviewing the
remote history. Keep generated artifacts outside Git or in intentionally
managed release artifacts/storage if distribution is authorized.

Verify from GitHub that the `main` branch, documentation, source and
workflows are all visible. A passing source build does not certify factory
exports, fitted garments or collision-safe simulation.
