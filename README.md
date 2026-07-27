## Blare

I write systems software and the tools around it. Most of it starts the same
way: something on my own machine is slower or more fragile than it should be,
and the fix turns out to live a layer below where people usually look.

If I can't measure it, I don't claim it.

---

### storage-manager-swift

A disk-usage treemap for Apple Silicon. Rust scanning core, SwiftUI front end.

Most scanners issue one `lstat` per file, so a million files means a million
kernel round-trips. This one uses `getattrlistbulk(2)`, which returns name,
type, size, inode and link count for a whole batch of directory entries at
once. Directories are walked in parallel with rayon.

296 GB home directory, ~956k files, M-series MacBook, 12 cores, warm cache:

| Tool | Scan time |
|---|---|
| `du -sk` | 22.7 s |
| naive parallel `read_dir` + `lstat` | 3.5 s |
| storage-manager | 2.2 s |

10.3× faster than `du`, because batching directory attributes beats one syscall
per file. Not because of threads: the naive parallel walker also has every
core, and it is still 1.6× slower.

Sizes are allocated on-disk bytes (`ATTR_FILE_ALLOCSIZE`), matching `du`
byte-for-byte. Hardlinks are counted once, symlinks are never followed, and
scanning `/` handles macOS firmlinks without double-counting. The Rust test
suite covers `du` parity, unicode and JSON-hostile filenames, symlink loops,
sparse files, and FFI leaks under stress.

WizTree gets its speed by reading NTFS's Master File Table directly. APFS has
no user-readable equivalent, so a filesystem walk is the floor on macOS.

### mp4trim

Trimming a hybrid Dolby Vision / HDR10 file in a normal editor fails one of two
ways: the preview renders green and purple because the system decoder chokes on
the DV profile, or the export silently re-encodes and strips the DV metadata.

Trimming here is a pure stream copy (`-map 0 -c copy`). No re-encode, so every
track and all the HDR metadata survive bit-exact, and a half-hour cut takes
seconds. Playback runs on QtMultimedia and falls back to ffmpeg-decoded frame
previews when the system decoder gives up, so the colours are always right.

It was a stream-copy problem, not an encoding problem.

### nix-windows-config

The Windows counterpart to my nix-darwin config. The dev environment is
reproduced exactly by home-manager inside WSL2, ported 1:1 from the Darwin
modules and filtered for macOS-only dependencies; the desktop layer stays
native. Both bootstrap scripts are idempotent.

### my-homebase

[louds.net](https://louds.net). The page argues instead of asserting: the hero
runs the benchmark above as a race on a shared time axis, and the work section
is a squarified treemap of my repositories, each tile sized by real source
bytes from the GitHub API. There is no brand accent colour, so every saturated
colour on the page is carrying data.

---

Right now I'm reading into machine learning properly: transformer internals,
self-attention, how inference actually spends its time, and where agents break
down. I use this stuff daily and would rather understand the machine underneath
it than treat it as a box that returns answers.

[louds.net](https://louds.net) · [blare@louds.net](mailto:blare@louds.net)
