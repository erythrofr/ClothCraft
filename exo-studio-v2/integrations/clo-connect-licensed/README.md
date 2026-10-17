# Manual CLO-SET CONNECT asset library

This is an isolated **local** intake manager for files downloaded manually through an account's normal, authorized CLO-SET CONNECT interface. It neither accesses the website nor requests credentials, scrapes listings, redistributes assets, or installs them into the EXO garment library. Download permissions and each creator's terms remain the operator's responsibility.

## Requirements and CLI

Requires Node.js 20 or newer. From the repository root:

```sh
node integrations/clo-connect-licensed/library.mjs help
node integrations/clo-connect-licensed/library.mjs import --source ~/Downloads/clo-manual --library ~/Documents/clo-licensed --dry-run
node integrations/clo-connect-licensed/library.mjs import --source ~/Downloads/clo-manual --library ~/Documents/clo-licensed --metadata ~/Downloads/clo-metadata.json
node integrations/clo-connect-licensed/library.mjs list --library ~/Documents/clo-licensed
node integrations/clo-connect-licensed/library.mjs verify --library ~/Documents/clo-licensed
node integrations/clo-connect-licensed/library.mjs stage --library ~/Documents/clo-licensed --id YOUR_SHA256 --ack-license
node --test integrations/clo-connect-licensed/library.test.mjs
```

Example metadata file, prepared from the download page and license provided by the creator:

```json
{
  "defaults": { "seller": "Example creator", "license": "", "licenseUrl": "", "originalUri": "" },
  "files": {
    "my-fabric.zfab": {
      "seller": "Example creator",
      "license": "Personal project use permitted under creator's terms",
      "licenseUrl": "https://example.org/terms",
      "originalUri": "https://example.org/original-item"
    }
  }
}
```

Metadata is preserved verbatim as supplied and **is not a verified license assessment**. Record the actual item URI, seller and license for each downloaded item; generic default metadata is intended only for items that truly share those details. An empty license becomes `unknown`. A supplied license remains `unreviewed` until `stage` is run with `--ack-license`, confirming a human reviewed the applicable terms and verified that the planned usage is permitted. Free price does not imply redistribution or commercial rights. Never stage an item whose license is unknown or unsuitable.

`import` recursively inspects supported extensions: `.zpac`, `.zfab`, `.zprj`, `.zmod`, `.zacs`, `.zavt`, `.zip`, `.dxf`, `.obj`, `.fbx`, `.glb`, `.gltf`, `.png`, `.jpg`, `.jpeg`, `.tif`, `.tiff`, `.exr`, `.sbsar`. Files are stored in `intake/` under their SHA256 plus original extension, deduplicated by content across imports. `manifest.json` records original basename, relative source path, original item URI, seller, license details, size, digest, archive checks and staging status. `stage` copies a reviewed asset to `staged/`; it does not publish, extract or import it into project code. Source downloads remain untouched. Keep the library outside the git repository if it will contain licensed content.

The importer performs SHA256 integrity checks on all supported files. For ZIP-compatible packages beginning with ZIP local headers it also validates central directory entries, entry paths, supported compression, CRC32 and declared uncompressed sizes, with file-size and expansion limits. CLO proprietary packages that do not expose a standard ZIP directory are treated as opaque; for these, `sha256-only` means the tool can check byte integrity but cannot certify that CLO can open or parse the internal format. ZIP64 and encrypted ZIP archives are rejected for ZIP validation. Unsupported extensions are skipped. Failed files are reported as rejected without being copied. `verify` repeats the checks on intake copies and reports errors; always inspect its results before consuming staged content.
