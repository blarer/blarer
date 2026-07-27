## Blare

I write systems software and the tools around it. Most of it starts the same
way: something on my own machine is slower or more fragile than it should be,
and the fix turns out to live a layer below where people usually look.

If I can't measure it, I don't claim it.

---

**[storage-manager-swift](https://github.com/blarer/storage-manager-swift)** —
disk-usage treemap for Apple Silicon. Rust scanning core, SwiftUI front end.

Most scanners issue one `lstat` per file, so a million files means a million
kernel round-trips. This one uses `getattrlistbulk(2)`, which returns name,
type, size, inode and link count for a whole batch of directory entries at
once. 296 GB home directory, ~956k files, 12 cores, warm cache:

| Tool | Scan time |
|---|---|
| `du -sk` | 22.7 s |
| naive parallel `read_dir` + `lstat` | 3.5 s |
| storage-manager | 2.2 s |

10.3× faster than `du`, because batching directory attributes beats one syscall
per file — not because of threads. The naive parallel walker also has every
core and is still 1.6× slower. Sizes are allocated on-disk bytes
(`ATTR_FILE_ALLOCSIZE`), matching `du` byte-for-byte; hardlinks counted once,
symlinks never followed, firmlinks not double-counted.

**[mp4trim](https://github.com/blarer/mp4trim)** — trimming a hybrid Dolby
Vision / HDR10 file in a normal editor fails one of two ways: the preview
renders green and purple because the system decoder chokes on the DV profile,
or the export silently re-encodes and strips the DV metadata. Trimming here is
a pure stream copy (`-map 0 -c copy`), so every track and all the HDR metadata
survive bit-exact and a half-hour cut takes seconds. It was a stream-copy
problem, not an encoding problem.

**[nix-windows-config](https://github.com/blarer/nix-windows-config)** — the
Windows counterpart to my nix-darwin config. Dev environment reproduced exactly
by home-manager inside WSL2, ported 1:1 from the Darwin modules; the desktop
layer stays native. Both bootstrap scripts are idempotent.

**[my-homebase](https://github.com/blarer/my-homebase)** —
[louds.net](https://louds.net). The page argues instead of asserting: the hero
runs the benchmark above as a race on a shared time axis, and the work section
is a squarified treemap of my repositories sized by real source bytes from the
GitHub API. No brand accent colour, so every saturated colour is carrying data.

---

Right now I'm reading into machine learning properly: transformer internals,
self-attention, how inference actually spends its time, and where agents break
down. I'd rather understand the machine underneath it than treat it as a box
that returns answers.

[louds.net](https://louds.net) · [blare@louds.net](mailto:blare@louds.net)
