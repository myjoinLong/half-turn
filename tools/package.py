"""Package an existing Vite dist with index.html at the archive root."""
import hashlib, json, sys, zipfile
from pathlib import Path
root = Path(__file__).resolve().parents[1]
dist = root / 'dist'
assert (dist / 'index.html').is_file()
release = root / 'release'
release.mkdir(exist_ok=True)
label = sys.argv[1] if len(sys.argv) > 1 else json.loads((root / 'package.json').read_text())['version']
archive = release / ('half-turn-' + label + '.zip')
with zipfile.ZipFile(archive, 'w', compression=zipfile.ZIP_DEFLATED) as bundle:
    for path in sorted(dist.rglob('*')):
        if path.is_file():
            info = zipfile.ZipInfo(path.relative_to(dist).as_posix(), (2026, 11, 21, 0, 0, 0))
            bundle.writestr(info, path.read_bytes(), zipfile.ZIP_DEFLATED)
with zipfile.ZipFile(archive) as bundle:
    assert bundle.testzip() is None
print(archive.name, archive.stat().st_size, hashlib.sha256(archive.read_bytes()).hexdigest())

