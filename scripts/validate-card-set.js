#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const {JSDOM} = require('jsdom');

const CARD_DIMENSIONS = new Map([
    ['0-profile-details.svg', [700, 200]],
    ['1-repos-per-language.svg', [340, 200]],
    ['2-most-commit-language.svg', [340, 200]],
    ['3-stats.svg', [340, 200]],
    ['4-productive-time.svg', [340, 200]]
]);
const CONTACT_FIELDS = /\b(?:email|company|location|website|twitter)\b|[\w.+-]+@[\w.-]+\.[a-z]{2,}/i;
const REQUIRED_TEXT = new Map([
    ['1-repos-per-language.svg', ['Top Languages by Repo']],
    ['2-most-commit-language.svg', ['Top Languages by Commit']],
    ['3-stats.svg', ['Total Stars:', 'Total Commits:', 'Total PRs:', 'Total Issues:', 'Contributed to:']],
    ['4-productive-time.svg', ['Commits by Hour', 'America/Los_Angeles', 'trailing year']]
]);

function validateCardSet(directory) {
    const root = path.resolve(directory);
    if (!fs.statSync(root).isDirectory()) throw new Error(`Card directory does not exist: ${root}`);
    const files = [...fs.readdirSync(root)].filter(file => file.endsWith('.svg')).sort();
    const expected = [...CARD_DIMENSIONS.keys()].sort();
    if (files.length !== expected.length || files.some((file, index) => file !== expected[index])) {
        throw new Error(
            `Expected exactly five card SVGs (${expected.join(', ')}); found ${files.join(', ') || '(none)'}.`
        );
    }

    for (const [filename, [width, height]] of CARD_DIMENSIONS) {
        const content = fs.readFileSync(path.join(root, filename), 'utf8');
        let document;
        try {
            document = new JSDOM(content, {contentType: 'image/svg+xml'}).window.document;
        } catch {
            throw new Error(`${filename} is not well-formed SVG.`);
        }
        const svg = document.documentElement;
        if (svg.localName !== 'svg' || document.querySelector('parsererror')) {
            throw new Error(`${filename} is not well-formed SVG.`);
        }
        if (svg.getAttribute('width') !== String(width) || svg.getAttribute('height') !== String(height)) {
            throw new Error(`${filename} must have dimensions ${width}x${height}.`);
        }
        const title = svg.querySelector('title');
        const description = svg.querySelector('desc');
        if (svg.getAttribute('role') !== 'img' || !title?.textContent?.trim() || !description?.textContent?.trim()) {
            throw new Error(`${filename} needs an accessible SVG title and description.`);
        }
        const labels = (svg.getAttribute('aria-labelledby') || '').split(/\s+/);
        if (!labels.includes(title.id) || !labels.includes(description.id)) {
            throw new Error(`${filename} does not reference its title and description.`);
        }
        if (!svg.querySelector('rect[fill="#161b22"][stroke="#30363d"]')) {
            throw new Error(`${filename} is missing the approved charcoal surface and border.`);
        }
        if (filename === '0-profile-details.svg') {
            const fullMarkup = content;
            const allText = svg.textContent || '';
            if (CONTACT_FIELDS.test(fullMarkup)) throw new Error('Profile Details contains contact metadata.');
            for (const required of [
                'dxnnystyles',
                'Contributions on GitHub',
                'Public Repos',
                'Joined GitHub',
                'last year'
            ]) {
                if (!allText.includes(required)) throw new Error(`Profile Details is missing ${required}.`);
            }
        }
        for (const required of REQUIRED_TEXT.get(filename) || []) {
            if (!(svg.textContent || '').includes(required))
                throw new Error(`${filename} is missing expected label or period: ${required}.`);
        }
        if (filename === '4-productive-time.svg' && !svg.textContent?.includes('Commits by Hour')) {
            throw new Error('Productive Time has no readable title.');
        }
    }
    return {directory: root, cards: expected.length, files: expected};
}

if (require.main === module) {
    try {
        const result = validateCardSet(process.argv[2]);
        console.log(`Validated ${result.cards} cards in ${result.directory}.`);
    } catch (error) {
        console.error(error instanceof Error ? error.message : error);
        process.exitCode = 1;
    }
}

module.exports = {CARD_DIMENSIONS, validateCardSet};
