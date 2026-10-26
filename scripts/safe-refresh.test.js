const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const {promoteCardSet} = require('./promote-card-set');
const {validateCardSet} = require('./validate-card-set');

const cards = [
    ['0-profile-details.svg', 700, 'Profile Details'],
    ['1-repos-per-language.svg', 340, 'Repositories per Language'],
    ['2-most-commit-language.svg', 340, 'Most Commit Language'],
    ['3-stats.svg', 340, 'GitHub Stats'],
    ['4-productive-time.svg', 340, 'Commits by Hour']
];

function writeSet(directory, revision) {
    fs.mkdirSync(directory, {recursive: true});
    for (const [filename, width, title] of cards) {
        const extra =
            filename === '0-profile-details.svg'
                ? '<text>dxnnystyles · 494 Contributions on GitHub · 5 Public Repos · Joined GitHub · daily chart last year</text>'
                : filename === '1-repos-per-language.svg'
                  ? `<text>Top Languages by Repo ${revision}</text>`
                  : filename === '2-most-commit-language.svg'
                    ? `<text>Top Languages by Commit ${revision}</text>`
                    : filename === '3-stats.svg'
                      ? '<text>Total Stars: 0 · Total Commits: 155 · Total PRs: 43 · Total Issues: 1 · Contributed to: 33</text>'
                      : `<text>Commits by Hour · America/Los_Angeles · trailing year ${revision}</text>`;
        fs.writeFileSync(
            path.join(directory, filename),
            `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="200" role="img" aria-labelledby="title desc"><title id="title">${title}</title><desc id="desc">Verified public profile chart.</desc><rect fill="#161b22" stroke="#30363d"/><g>${extra}</g></svg>`
        );
    }
}

test('validates and promotes the complete five-card set, then no-ops on identical output', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gpsc-safe-'));
    const generated = path.join(root, 'generated');
    const published = path.join(root, 'published');
    try {
        writeSet(generated, 'first');
        assert.equal(validateCardSet(generated).cards, 5);
        assert.deepEqual(promoteCardSet(generated, published).changed, true);
        const lastGood = fs.readFileSync(path.join(published, '1-repos-per-language.svg'), 'utf8');
        assert.equal(promoteCardSet(generated, published).changed, false);
        assert.equal(fs.readFileSync(path.join(published, '1-repos-per-language.svg'), 'utf8'), lastGood);
        writeSet(generated, 'second');
        assert.equal(promoteCardSet(generated, published).changed, true);
        assert.match(fs.readFileSync(path.join(published, '1-repos-per-language.svg'), 'utf8'), /second/);
    } finally {
        fs.rmSync(root, {recursive: true, force: true});
    }
});

test('rejects a partial or malformed generation without changing the last good set', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gpsc-failure-'));
    const generated = path.join(root, 'generated');
    const published = path.join(root, 'published');
    try {
        writeSet(generated, 'good');
        promoteCardSet(generated, published);
        const before = fs.readFileSync(path.join(published, '3-stats.svg'), 'utf8');
        fs.writeFileSync(path.join(generated, '3-stats.svg'), '<svg><title>broken');
        assert.throws(() => promoteCardSet(generated, published), /well-formed SVG/);
        assert.equal(fs.readFileSync(path.join(published, '3-stats.svg'), 'utf8'), before);
        fs.rmSync(path.join(generated, '4-productive-time.svg'));
        assert.throws(() => promoteCardSet(generated, published), /Expected exactly five/);
        assert.equal(fs.readFileSync(path.join(published, '3-stats.svg'), 'utf8'), before);
    } finally {
        fs.rmSync(root, {recursive: true, force: true});
    }
});

test('rejects contact metadata in Profile Details before promotion', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gpsc-privacy-'));
    try {
        writeSet(root, 'safe');
        const profile = path.join(root, '0-profile-details.svg');
        fs.writeFileSync(
            profile,
            fs
                .readFileSync(profile, 'utf8')
                .replace('</g>', '<text data-contact="person@example.com">omitted</text></g>')
        );
        assert.throws(() => validateCardSet(root), /contact metadata/);
    } finally {
        fs.rmSync(root, {recursive: true, force: true});
    }
});
