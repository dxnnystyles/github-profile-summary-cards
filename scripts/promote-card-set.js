#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {CARD_DIMENSIONS, validateCardSet} = require('./validate-card-set');

function digest(file) {
    return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function sameSet(source, destination) {
    if (!fs.existsSync(destination)) return false;
    for (const filename of CARD_DIMENSIONS.keys()) {
        const left = path.join(source, filename);
        const right = path.join(destination, filename);
        if (!fs.existsSync(right) || digest(left) !== digest(right)) return false;
    }
    return true;
}

function promoteCardSet(sourceDirectory, destinationDirectory) {
    const source = path.resolve(sourceDirectory);
    const destination = path.resolve(destinationDirectory);
    if (source === destination || destination.startsWith(`${source}${path.sep}`)) {
        throw new Error('Destination must be separate from the generated source directory.');
    }
    validateCardSet(source);
    if (sameSet(source, destination)) return {changed: false, destination};

    const parent = path.dirname(destination);
    fs.mkdirSync(parent, {recursive: true});
    const stage = path.join(parent, `.${path.basename(destination)}.stage-${process.pid}`);
    const backup = path.join(parent, `.${path.basename(destination)}.backup-${process.pid}`);
    fs.rmSync(stage, {recursive: true, force: true});
    fs.rmSync(backup, {recursive: true, force: true});
    fs.mkdirSync(stage, {recursive: true});
    try {
        for (const filename of CARD_DIMENSIONS.keys()) {
            fs.copyFileSync(path.join(source, filename), path.join(stage, filename));
        }
        validateCardSet(stage);
        const hadDestination = fs.existsSync(destination);
        if (hadDestination) fs.renameSync(destination, backup);
        try {
            fs.renameSync(stage, destination);
        } catch (error) {
            if (hadDestination && fs.existsSync(backup)) fs.renameSync(backup, destination);
            throw error;
        }
        fs.rmSync(backup, {recursive: true, force: true});
        return {changed: true, destination};
    } finally {
        fs.rmSync(stage, {recursive: true, force: true});
    }
}

if (require.main === module) {
    try {
        const [source, destination] = process.argv.slice(2);
        if (!source || !destination)
            throw new Error('Usage: node scripts/promote-card-set.js <generated-card-dir> <destination-dir>');
        const result = promoteCardSet(source, destination);
        console.log(`${result.changed ? 'Promoted' : 'Unchanged'} five-card set at ${result.destination}.`);
    } catch (error) {
        console.error(error instanceof Error ? error.message : error);
        process.exitCode = 1;
    }
}

module.exports = {promoteCardSet};
