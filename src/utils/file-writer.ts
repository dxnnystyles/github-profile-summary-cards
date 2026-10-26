import * as core from '@actions/core';
import {mkdirSync, writeFileSync, readdirSync, existsSync} from 'fs';
import {isAbsolute, relative, resolve, sep} from 'path';
import {tmpdir} from 'os';
import {ThemeMap} from '../const/theme';
import {OwnerType} from '../github-api/owner-type';

export function resolveOutputPath(
    configuredValue: string | undefined = process.env.SUMMARY_CARDS_OUTPUT_PATH,
    tempRootValue: string = process.env.RUNNER_TEMP || tmpdir(),
    requireTemporary = false
): string {
    const configured = configuredValue?.trim();
    if (!configured) {
        if (requireTemporary)
            throw new Error('GitHub Actions generation requires SUMMARY_CARDS_OUTPUT_PATH under RUNNER_TEMP.');
        return './profile-summary-card-output/';
    }

    const target = resolve(configured);
    const tempRoot = resolve(tempRootValue);
    const rel = relative(tempRoot, target);
    if (!isAbsolute(configured) || !rel || rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) {
        throw new Error('SUMMARY_CARDS_OUTPUT_PATH must be a child directory of RUNNER_TEMP.');
    }
    return `${target}${sep}`;
}

export const OUTPUT_PATH = resolveOutputPath();
export function assertSafeOutputPath(): void {
    if (process.env.GITHUB_ACTIONS === 'true') {
        resolveOutputPath(process.env.SUMMARY_CARDS_OUTPUT_PATH, process.env.RUNNER_TEMP || tmpdir(), true);
    }
}
const GITHUB_REPOSITORY = process.env.GITHUB_REPOSITORY;

// If neither a branch or tag is available for the event type, the variable will not exist. https://docs.github.com/en/actions/configuring-and-managing-workflows/using-environment-variables
const GITHUB_BRANCH =
    process.env.GITHUB_REF == undefined
        ? core.getInput('BRANCH_NAME', {required: false})
        : process.env.GITHUB_REF.split('/').pop();

export const writeSVG = function (folder: string, filename: string, svgString: string) {
    const targetFolder = `${OUTPUT_PATH}${folder}/`;
    mkdirSync(targetFolder, {recursive: true});
    writeFileSync(`${targetFolder}${filename}.svg`, svgString);
};

function getAllFileInFolder(folder: string): string[] {
    const files: string[] = [];
    readdirSync(folder).forEach(file => {
        files.push(file);
    });
    return files;
}

// Theme folders that were actually generated this run, in ThemeMap order. When a
// single THEME is requested only its folder exists, so the preview must iterate
// what's on disk rather than every known theme (otherwise it reads a missing
// folder and throws).
function getGeneratedThemes(): string[] {
    return [...ThemeMap.keys()].filter(themeName => existsSync(`${OUTPUT_PATH}${themeName}`));
}

export const generatePreviewMarkdown = function (isInGithubAction: boolean, ownerType: OwnerType = 'User') {
    const targetFolder = `${OUTPUT_PATH}`;
    let readmeContent = '';
    const urlPrefix = isInGithubAction
        ? `https://raw.githubusercontent.com/${GITHUB_REPOSITORY}/${GITHUB_BRANCH}/profile-summary-card-output`
        : `.`;

    // First, we generate preview readme for each generated theme
    const generatedThemes = getGeneratedThemes();
    for (const themeName of generatedThemes) {
        generateThemePreviewReadme(urlPrefix, themeName, ownerType);
    }
    readmeContent += `
# Theme Preview

Here are all cards with themes.
| :bell: | If only show Top Languages card here, then you maybe forgot to use [Personal access token](https://docs.github.com/en/actions/configuring-and-managing-workflows/creating-and-storing-encrypted-secrets) instead of GITHUB_TOKEN in workflow. |
| :-------: | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |

`;

    for (const themeName of generatedThemes) {
        readmeContent += `## [${themeName}](./${themeName}/README.md)`;
        readmeContent += getThemeMarkdown(`${urlPrefix}/${themeName}`, ownerType);
    }

    writeFileSync(`${targetFolder}README.md`, readmeContent);
};

function generateThemePreviewReadme(urlPrefix: string, themeName: string, ownerType: OwnerType = 'User') {
    let themePreviewMarkdown = '';
    themePreviewMarkdown += `## ${themeName}`;
    themePreviewMarkdown += `\n`;
    themePreviewMarkdown += getThemeMarkdown('.', ownerType);
    themePreviewMarkdown += '### Now you can add this to your markdown';
    themePreviewMarkdown += `
\`\`\`
${getThemeMarkdown(`${urlPrefix}/${themeName}`, ownerType)}
\`\`\`
`;
    themePreviewMarkdown += `\n`;
    themePreviewMarkdown += `### Each card usage`;
    for (const file of getAllFileInFolder(OUTPUT_PATH + themeName)) {
        if (!file.endsWith('svg')) continue;
        themePreviewMarkdown += `
---

![](./${file})

\`\`\`
![](${urlPrefix}/${themeName}/${file})
\`\`\`

    `;
        themePreviewMarkdown += `\n`;
    }
    writeFileSync(`${OUTPUT_PATH}${themeName}/README.md`, themePreviewMarkdown);
}

function getThemeMarkdown(urlPrefix: string, ownerType: OwnerType = 'User'): string {
    let result = '';
    if (ownerType === 'Organization') {
        result += `
[![](${urlPrefix}/0-profile-details.svg)](https://github.com/vn7n24fzkq/github-profile-summary-cards)
[![](${urlPrefix}/1-repos-per-language.svg)](https://github.com/vn7n24fzkq/github-profile-summary-cards) [![](${urlPrefix}/2-most-commit-language.svg)](https://github.com/vn7n24fzkq/github-profile-summary-cards)
[![](${urlPrefix}/3-stats.svg)](https://github.com/vn7n24fzkq/github-profile-summary-cards)
`;
    } else {
        result += `
[![](${urlPrefix}/0-profile-details.svg)](https://github.com/vn7n24fzkq/github-profile-summary-cards)
[![](${urlPrefix}/1-repos-per-language.svg)](https://github.com/vn7n24fzkq/github-profile-summary-cards) [![](${urlPrefix}/2-most-commit-language.svg)](https://github.com/vn7n24fzkq/github-profile-summary-cards)
[![](${urlPrefix}/3-stats.svg)](https://github.com/vn7n24fzkq/github-profile-summary-cards) [![](${urlPrefix}/4-productive-time.svg)](https://github.com/vn7n24fzkq/github-profile-summary-cards)
`;
    }
    return result;
}
