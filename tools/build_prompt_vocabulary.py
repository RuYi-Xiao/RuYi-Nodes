"""Build the bundled vocabulary from explicitly supplied local CSV files."""
import csv
import gzip
import hashlib
import json
from pathlib import Path
import sys

root = Path(__file__).resolve().parents[1]
local = Path(sys.argv[1])
target = root / 'data' / 'prompt'
translations = dict(csv.reader((local / 'danbooru-0-zh.csv').open(encoding='utf-8-sig', newline='')))
records = {}
provenance = []


def add(name, category, count, aliases, source):
    if not name: return
    key = name.replace('_', ' ').strip().casefold()
    row = records.setdefault(key, [name, category, 0, set(), translations.get(name, ''), set()])
    row[2] = max(row[2], int(count or 0))
    row[3].update(a.strip() for a in aliases.split(',') if a.strip() and a.strip() != name)
    row[5].add(source)


for name, category in [('danbooru_dataset_general.csv', 'general'), ('danbooru_character_tags.csv', 'character')]:
    path = local / name
    with path.open(encoding='utf-8-sig', newline='') as stream:
        for item in csv.DictReader(stream):
            add(item.get('tag') or item['character_tag'], item.get('category', category),
                item.get('post_count', 0), item.get('other_names', ''), 'local')
    provenance.append({'file':name, 'sha256':hashlib.sha256(path.read_bytes()).hexdigest()})

categories = {'0':'general','1':'artist','3':'copyright','4':'character','5':'meta'}
with (target / 'danbooru.csv').open(encoding='utf-8-sig', newline='') as stream:
    for row in csv.reader(stream):
        if len(row) >= 3: add(row[0], categories.get(row[1], row[1]), row[2], row[3] if len(row)>3 else '', 'danbooru')

rows = [[r[0],r[1],r[2],sorted(r[3]),r[4],sorted(r[5])] for r in records.values()]
rows.sort(key=lambda r:(-r[2],r[0]))
payload = json.dumps(rows,ensure_ascii=False,separators=(',',':')).encode('utf-8')
with (target / 'vocabulary.json.gz').open('wb') as stream:
    with gzip.GzipFile(fileobj=stream,mode='wb',mtime=0) as zipped: zipped.write(payload)
meta = {'records':len(rows),'local_inputs':provenance,'recent_snapshot':json.loads((target/'danbooru-meta.json').read_text()),
        'vocabulary_sha256':hashlib.sha256(payload).hexdigest(), 'translation_records':len(translations)}
(target / 'manifest.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2),encoding='utf-8')
print('Bundled vocabulary:',len(rows),'records;',len(payload),'uncompressed bytes')
