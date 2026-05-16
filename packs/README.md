# packs/

Built dictionary `.db` files land here. They are produced by the pipeline and are not committed.

Naming: `<source>-<target>.db` — e.g. `spanish-en.db` is Spanish headwords with English glosses.

To build the Spanish pack:

```
python pipeline/build_pack.py --language spanish --output packs/spanish-en.db
```
