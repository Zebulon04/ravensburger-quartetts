#!/usr/bin/env python3
"""make_data.py - builds the "own host" data folder of the Quartett Archive (what js/loader.js reads from data/).

Input : a local copy of the card repo (git clone / unzipped download of Zebulon04/ravensburger-quartetts).
Output: a folder (default ./data_for_upload) and, with --zip, a zip of it. Upload its CONTENT to <site>/quartett/data/ :

  tree.json                      the repo's file list: {"v":1,"built":"...","paths":[...]} (replaces the GitHub API tree call)
  grouped_cards_extended.json    search index, copied from the repo root
  country_list.json              country list, copied from the repo root
  <year|MINI|PROMO>/<collection>/<x>.json   every set file, same layout as the repo (images are NOT copied, they stay on GitHub)
  .htaccess                      compress + "no-cache, must-revalidate" for the .json files

Run it again (and re-upload) whenever the card repo changed. The race engine app (engine.z3bvln.hr) reads tree.json too.

Usage:  python3 make_data.py <repo folder> [output folder] [--zip]
"""
import json, os, shutil, sys, time, zipfile

HTACCESS = """# Search index + country list, uploaded by hand next to index.html.
# - compress on the fly (the index is ~2 MB as plain text, ~340 KB compressed)
# - "no-cache" = the browser keeps a copy but asks the server first (cheap 304 answer when unchanged),
#   so a re-uploaded file is used at once and an unchanged one is not downloaded again.
<IfModule mod_deflate.c>
  AddOutputFilterByType DEFLATE application/json text/plain
</IfModule>
<IfModule mod_headers.c>
  <FilesMatch "\\.json$">
    Header set Cache-Control "no-cache, must-revalidate"
  </FilesMatch>
</IfModule>
"""
ROOT_FILES = ['grouped_cards_extended.json', 'country_list.json']      # copied from the repo root


def main(argv):
    args = [a for a in argv if not a.startswith('--')]
    make_zip = '--zip' in argv
    if not args:
        print(__doc__); return 1
    repo = os.path.abspath(args[0])
    out = os.path.abspath(args[1]) if len(args) > 1 else os.path.abspath('data_for_upload')
    if not os.path.isdir(repo):
        print('Not a folder: ' + repo); return 1
    if out == repo or out.startswith(repo + os.sep):
        print('The output folder must be outside the repo folder.'); return 1

    # 1. every file of the repo (dot files / folders such as .git are not part of the file list)
    paths = []
    for d, ds, fs in os.walk(repo):
        ds[:] = sorted(x for x in ds if not x.startswith('.'))
        for f in fs:
            if f.startswith('.'): continue
            paths.append(os.path.relpath(os.path.join(d, f), repo).replace(os.sep, '/'))
    paths.sort()
    if not paths:
        print('The folder is empty.'); return 1

    # 2. output folder (emptied first, so a deleted set does not stay behind)
    if os.path.isdir(out): shutil.rmtree(out)
    os.makedirs(out)
    bad = 0; sets = 0
    for p in paths:
        # set files = json files at least two folders deep (1997/Motorsport/x.json, MINI/Serie 2/Jets/x.json); the site's own languages/*.json and manifest.json are not data
        if p.lower().endswith('.json') and p.count('/') >= 2:
            src = os.path.join(repo, *p.split('/'))
            try:
                with open(src, encoding='utf-8') as fh: json.load(fh)
            except Exception as e:
                print('  skipped (not valid JSON): %s  (%s)' % (p, e)); bad += 1; continue
            dst = os.path.join(out, *p.split('/')); os.makedirs(os.path.dirname(dst), exist_ok=True); shutil.copyfile(src, dst); sets += 1
    for name in ROOT_FILES:
        src = os.path.join(repo, name)
        if not os.path.isfile(src):
            print('  MISSING in the repo root: ' + name + '  (the site then asks GitHub for it)'); continue
        try:
            with open(src, encoding='utf-8') as fh: json.load(fh)
        except Exception as e:
            print('  skipped (not valid JSON): %s  (%s)' % (name, e)); bad += 1; continue
        shutil.copyfile(src, os.path.join(out, name))
    with open(os.path.join(out, 'tree.json'), 'w', encoding='utf-8') as fh:
        json.dump({'v': 1, 'built': time.strftime('%Y-%m-%d %H:%M:%S'), 'paths': paths}, fh, ensure_ascii=False, separators=(',', ':'))
    with open(os.path.join(out, '.htaccess'), 'w', encoding='utf-8', newline='\n') as fh: fh.write(HTACCESS)
    print('%d files in tree.json, %d set files copied%s -> %s' % (len(paths), sets, (', %d skipped' % bad) if bad else '', out))

    if make_zip:
        zp = out.rstrip(os.sep) + '.zip'
        with zipfile.ZipFile(zp, 'w', zipfile.ZIP_DEFLATED) as z:
            for d, ds, fs in os.walk(out):
                ds.sort()
                for f in sorted(fs):
                    p = os.path.join(d, f); z.write(p, os.path.relpath(p, out))
        print('zip: ' + zp)
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
