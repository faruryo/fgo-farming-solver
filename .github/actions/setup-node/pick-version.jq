# nodejs.org/dist/index.json から、Node $major.x のうちセキュリティリリースか $cutoff（YYYY-MM-DD）以前に出た最新版を返す
[.[] | select((.version | startswith("v\($major).")) and (.security or .date <= $cutoff))]
| max_by(.version | ltrimstr("v") | split(".") | map(tonumber))
| .version
| ltrimstr("v")
