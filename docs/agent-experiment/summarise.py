import json, os, re, sys
root = sys.argv[1]
rows = []
for name in sorted(os.listdir(root)):
    d = os.path.join(root, name)
    if not os.path.isdir(d) or not os.path.exists(os.path.join(d, 'a11y.exit')):
        continue
    read = lambda f: open(os.path.join(d, f)).read() if os.path.exists(os.path.join(d, f)) else ''
    lint = json.loads(read('eslint.json') or '[]')
    by_rule = {}
    for f in lint:
        for m in f['messages']:
            if m.get('severity') == 2:
                by_rule[m.get('ruleId') or 'parse'] = by_rule.get(m.get('ruleId') or 'parse', 0) + 1
    slip_lint = sum(v for k, v in by_rule.items() if k.startswith('slip/'))
    other_lint = sum(v for k, v in by_rule.items() if not k.startswith('slip/'))
    repo_items = re.findall(r'^\+\s+"([^"]+)",?$', read('repository.log'), re.M)
    axe = re.search(r'axe checked (\d+) stories: (\d+) serious or critical', read('a11y.log'))
    tests = re.search(r'Tests\s+(?:(\d+) failed \| )?(\d+) passed', read('test.log'))
    fmt = len(re.findall(r'^\[warn\] (?!Code style)', read('format.log'), re.M))
    stat = read('diffstat.txt').strip().splitlines()
    rows.append({
        'run': name,
        'slip_lint': slip_lint,
        'lint_rules': {k: v for k, v in by_rule.items() if k.startswith('slip/')},
        'other_lint': other_lint,
        'css_and_states': repo_items,
        'typecheck_ok': read('typecheck.exit').strip() == '0',
        'tests_failed': int(tests.group(1) or 0) if tests else None,
        'format_files': fmt,
        'storybook_ok': read('storybook.exit').strip() == '0',
        'axe_stories': int(axe.group(1)) if axe else None,
        'axe_serious': int(axe.group(2)) if axe else None,
        'axe_findings': re.findall(r'^FAIL  (.+?): ([a-z-]+) \((\w+)\)', read('a11y.log'), re.M),
        'files_changed': stat[-1] if stat else '',
        'stories_changed': len(re.findall(r'stories\.tsx', read('diffstat.txt'))),
        'ui_package_changed': len(re.findall(r'packages/ui/src/components', read('diffstat.txt'))),
        'commits': read('commits.txt').strip().splitlines(),
    })
print(json.dumps(rows, indent=2))
