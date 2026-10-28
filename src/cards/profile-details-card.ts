import {ThemeMap, ThemeColorOverride, resolveTheme} from '../const/theme';
import {abbreviateNumber} from 'js-abbreviation-number';
import {getProfileDetails, ProfileDetails} from '../github-api/profile-details';
import {getContributionTotals} from '../utils/contribution-history';
import {Card} from '../templates/card';
import {CardGenerationOptions, writeThemedCards} from '../utils/card-generation';
import {buildProfileTitle} from '../utils/profile-title';

const CARD_WIDTH = 700;
const CARD_HEIGHT = 200;

/**
 * Creates a compact Profile Details card with public account totals only.
 * @param {string} username GitHub login used to request public profile data.
 * @param {string} token GitHub API token supplied by the caller.
 * @param {CardGenerationOptions} options Card generation and output options.
 */
export const createProfileDetailsCard = async function (
    username: string,
    token: string,
    options: CardGenerationOptions = {}
) {
    const data = await getProfileDetailsData(username, token);
    const title = buildProfileTitle(username, null, options.displayName);
    writeThemedCards('0-profile-details', themeName => renderProfileDetailsSVG(title, data, themeName), options);
};

/**
 * Generates one theme variant for the compact Profile Details card.
 * @param {string} username GitHub login used to request public profile data.
 * @param {string} themeName Name of the configured card theme.
 * @param {string} token GitHub API token supplied by the caller.
 * @param {ThemeColorOverride} [override] Optional theme color overrides.
 * @param {string} [displayName] Optional visible display name.
 */
export const getProfileDetailsSVGWithThemeName = async function (
    username: string,
    themeName: string,
    token: string,
    override?: ThemeColorOverride,
    displayName?: string
): Promise<string> {
    if (!ThemeMap.has(themeName)) throw new Error('Theme does not exist');
    const data = await getProfileDetailsData(username, token);
    const title = buildProfileTitle(username, null, displayName);
    return renderProfileDetailsSVG(title, data, themeName, override);
};

export interface ProfileDetailsCardData {
    profile: ProfileDetails;
    allTimeContributions: number;
    accountAge: string;
}

export const renderProfileDetailsSVG = (
    title: string,
    data: ProfileDetailsCardData,
    themeName: string,
    override?: ThemeColorOverride
): string => {
    const theme = resolveTheme(themeName, override);
    const card = new Card(
        title,
        CARD_WIDTH,
        CARD_HEIGHT,
        theme,
        30,
        35,
        `Public GitHub profile details for ${title}: all-time contributions, original public repositories (forks excluded), and account age. Contact fields and the contribution chart are omitted.`
    );
    const root = card.getSVG();
    const columns = [
        {x: 125, label: ['All-time', 'contributions'], value: abbreviateNumber(data.allTimeContributions, 2)},
        {x: 350, label: ['Public repos', '(non-fork)'], value: abbreviateNumber(data.profile.totalPublicRepos, 2)},
        {x: 575, label: ['GitHub account age'], value: data.accountAge}
    ];

    columns.forEach(column => {
        const label = root
            .append('text')
            .attr('x', column.x)
            .attr('text-anchor', 'middle')
            .attr('fill', theme.text)
            .attr('font-size', '24px')
            .attr('font-weight', '500');
        column.label.forEach((line, index) => {
            const baseline = column.label.length === 1 ? 57 : 43 + index * 22;
            label.append('tspan').attr('x', column.x).attr('y', baseline).text(line);
        });
        root.append('text')
            .attr('x', column.x)
            .attr('y', 115)
            .attr('text-anchor', 'middle')
            .attr('fill', theme.title)
            .attr('font-size', '38px')
            .attr('font-weight', '650')
            .text(column.value);
    });

    return card.toString();
};

const getProfileDateJoined = (profile: ProfileDetails): string => {
    const created = new Date(profile.createdAt);
    const now = new Date();
    let months = (now.getUTCFullYear() - created.getUTCFullYear()) * 12 + now.getUTCMonth() - created.getUTCMonth();
    if (now.getUTCDate() < created.getUTCDate()) months -= 1;
    months = Math.max(0, months);
    const years = Math.floor(months / 12);
    return years ? `${years} yr${years === 1 ? '' : 's'}` : `${months} mo`;
};

const getProfileDetailsData = async (username: string, token: string): Promise<ProfileDetailsCardData> => {
    const profile = await getProfileDetails(username, token);
    const {totalContributions} = await getContributionTotals(username, profile.contributionYears, token);
    return {
        profile,
        allTimeContributions: totalContributions,
        accountAge: getProfileDateJoined(profile)
    };
};
