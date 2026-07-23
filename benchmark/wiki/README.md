# On-wiki page sources

Canonical source for the Wikipedia pages this project owns. These files are the
authority; the on-wiki pages are published copies. Edit here, then publish.

| File | On-wiki title |
| --- | --- |
| `Row.wikitext` | `User:Alaexis/AI Source Verification/Benchmark/Row` |
| `Row.doc.wikitext` | `User:Alaexis/AI Source Verification/Benchmark/Row/doc` |
| `Benchmark.wikitext` | `User:Alaexis/AI Source Verification/Benchmark` |

Publishing is manual: open the page, paste the file contents, save. There is no
sync script — these change rarely, and an automated writer would need credentials
the repo deliberately does not hold.

The suite page's row content is **not** mirrored here. `Benchmark.wikitext` holds
only the header and the empty table wrapper; the rows live on-wiki and are pulled
back into the repo as frozen snapshots under `benchmark/suites/` (see
`benchmark/suite.js`).
