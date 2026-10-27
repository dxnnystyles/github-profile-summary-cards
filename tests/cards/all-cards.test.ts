import {createProfileDetailsCard} from '../../src/cards/profile-details-card';
import {createReposPerLanguageCard} from '../../src/cards/repos-per-language-card';
import {createCommitsPerLanguageCard} from '../../src/cards/most-commit-language-card';
import {createProductiveTimeCard} from '../../src/cards/productive-time-card';
import {createStatsCard} from '../../src/cards/stats-card';
import {createOrganizationProfileDetailsCard} from '../../src/cards/organization-profile-details-card';
import {createOrganizationReposPerLanguageCard} from '../../src/cards/organization-repos-per-language-card';
import {createOrganizationCommitsPerLanguageCard} from '../../src/cards/organization-most-commit-language-card';
import {createOrganizationStatsCard} from '../../src/cards/organization-stats-card';
import {writeSVG} from '../../src/utils/file-writer';
import {getProfileDetails} from '../../src/github-api/profile-details';
import {getRepoLanguages} from '../../src/github-api/repos-per-language';
import {getCommitLanguageAllYears, getContributionYears} from '../../src/github-api/commits-per-language';
import {getProductiveTime} from '../../src/github-api/productive-time';
import {getContributionByYear} from '../../src/github-api/contributions-by-year';
import {getOrganizationDetails} from '../../src/github-api/organization-details';
import {getOrganizationRepoLanguages} from '../../src/github-api/organization-repos-per-language';
import {getOrganizationCommitLanguage} from '../../src/github-api/organization-commits-per-language';
import {aggregateContributionsByUtcMonth, createDetailCard} from '../../src/templates/profile-details-card';
import {Theme} from '../../src/const/theme';

// Mock all dependencies
jest.mock('../../src/utils/file-writer');
jest.mock('../../src/github-api/profile-details');
jest.mock('../../src/github-api/repos-per-language');
jest.mock('../../src/github-api/commits-per-language');
jest.mock('../../src/github-api/productive-time');
jest.mock('../../src/github-api/contributions-by-year');
jest.mock('../../src/github-api/organization-details');
jest.mock('../../src/github-api/organization-repos-per-language');
jest.mock('../../src/github-api/organization-commits-per-language');

const mockWriteSVG = writeSVG as jest.Mock;

describe('Cards Generation (Integration)', () => {
    const TOKEN = 'dummy_token';
    const USERNAME = 'testuser';

    beforeEach(() => {
        jest.resetAllMocks();

        // Setup default mock returns
        (getProfileDetails as jest.Mock).mockResolvedValue({
            name: 'Test User',
            email: 'test@example.com',
            company: 'Test Company',
            location: 'Test Location',
            websiteUrl: 'https://private.example',
            twitterUsername: 'private_handle',
            contributionYears: [2024],
            totalPublicRepos: 10,
            totalStars: 100,
            totalPullRequestContributions: 5,
            totalIssueContributions: 5,
            totalRepositoryContributions: 2,
            contributions: [{date: new Date(), contributionCount: 5}],
            createdAt: '2020-01-01T00:00:00Z'
        });
        (getContributionByYear as jest.Mock).mockResolvedValue({
            totalContributions: 500,
            totalCommitContributions: 400
        });
        (getRepoLanguages as jest.Mock).mockResolvedValue({
            getLanguageMap: () => new Map([['TypeScript', {count: 100, color: '#abcdef'}]])
        });
        (getContributionYears as jest.Mock).mockResolvedValue([2024]);
        (getCommitLanguageAllYears as jest.Mock).mockResolvedValue({
            getLanguageMap: () => new Map([['TypeScript', {count: 500, color: '#abcdef'}]])
        });
        (getProductiveTime as jest.Mock).mockResolvedValue({
            productiveDate: [new Date().toISOString()]
        });
        (getOrganizationDetails as jest.Mock).mockResolvedValue({
            id: 'orgID',
            login: 'acme',
            name: 'Acme Corp',
            description: 'A test organization',
            email: 'contact@acme.example',
            location: 'Internet',
            websiteUrl: 'https://acme.example',
            twitterUsername: 'acme',
            createdAt: '2015-01-01T00:00:00Z',
            isVerified: true,
            totalPublicRepos: 10,
            totalStars: 100,
            totalForks: 25,
            totalOpenIssues: 5,
            repoCreatedAt: [new Date('2020-01-01T00:00:00Z'), new Date('2021-06-15T00:00:00Z')]
        });
        (getOrganizationRepoLanguages as jest.Mock).mockResolvedValue({
            getLanguageMap: () => new Map([['TypeScript', {count: 100, color: '#abcdef'}]])
        });
        (getOrganizationCommitLanguage as jest.Mock).mockResolvedValue({
            getLanguageMap: () => new Map([['TypeScript', {count: 500, color: '#abcdef'}]])
        });
    });

    it('keeps daily contribution input unchanged while building monthly chart values', () => {
        const contributions = [
            {date: new Date('2025-10-01T00:00:00Z'), contributionCount: 2},
            {date: new Date('2025-10-31T23:59:00Z'), contributionCount: 3},
            {date: new Date('2025-11-01T00:00:00Z'), contributionCount: 4},
            {date: new Date('2026-01-01T00:00:00Z'), contributionCount: 5}
        ];
        const originalDates = contributions.map(day => day.date.toISOString());
        const monthly = aggregateContributionsByUtcMonth(contributions);
        expect(monthly.map(month => [month.date.toISOString(), month.contributionCount])).toEqual([
            ['2025-10-01T00:00:00.000Z', 5],
            ['2025-11-01T00:00:00.000Z', 4],
            ['2026-01-01T00:00:00.000Z', 5]
        ]);
        expect(monthly.reduce((sum, month) => sum + month.contributionCount, 0)).toBe(14);
        const svg = createDetailCard(
            'dxnnystyles',
            [
                {index: 0, icon: '', name: 'Contributions', value: '494 Contributions on GitHub'},
                {index: 1, icon: '', name: 'Public Repos', value: '5 Public Repos'},
                {index: 2, icon: '', name: 'JoinedAt', value: 'Joined GitHub 1 year ago'}
            ],
            contributions,
            new Theme('#d97757', '#c9d1d9', '#161b22', '#30363d', 1, '#8b949e', '#3fb950'),
            undefined,
            380
        );

        expect(contributions.map(day => day.date.toISOString())).toEqual(originalDates);
        expect(contributions.map(day => day.contributionCount)).toEqual([2, 3, 4, 5]);
        expect(svg).toContain('monthly totals aggregated');
        expect(svg).toContain('All-time');
        expect(svg).toContain('height="150"');
        expect(svg).toContain('text-anchor="start" dx="6px"');
        expect(svg).toContain('25/10');
    });

    it('createProfileDetailsCard should write SVG', async () => {
        await createProfileDetailsCard(USERNAME, TOKEN);
        // Expect writeSVG to be called for each theme (we have ~30 themes)
        expect(mockWriteSVG).toHaveBeenCalled();
        expect(mockWriteSVG).toHaveBeenCalledWith(
            expect.any(String),
            '0-profile-details',
            expect.stringContaining('<svg')
        );
    });

    it('suppresses personal and contact metadata from Profile Details output', async () => {
        await createProfileDetailsCard(USERNAME, TOKEN, {theme: 'dxnnystyles'});
        const svg = mockWriteSVG.mock.calls.find((call: unknown[]) => call[1] === '0-profile-details')?.[2] as string;
        expect(svg).toContain('width="700" height="380" viewBox="0 0 700 380"');
        expect(svg).toContain('aria-labelledby="gpsc-card-title gpsc-card-description"');
        expect(svg).toContain('contributions in the last year');
        expect(svg).toContain('font-size: 24px');
        expect(svg).toContain('font-size: 28px');
        expect(svg).toContain('All-time');
        expect(svg).toContain('contributions');
        expect(svg).toContain('Public repos');
        expect(svg).toContain('Joined GitHub');
        expect(svg).not.toMatch(/test@example\.com|Test Company|Test Location|private\.example|private_handle/i);
        expect(svg).not.toMatch(/Email|Company|Location|Website|Twitter/i);
    });

    it('createReposPerLanguageCard should write SVG', async () => {
        await createReposPerLanguageCard(USERNAME, [], TOKEN);
        expect(mockWriteSVG).toHaveBeenCalled();
        expect(mockWriteSVG).toHaveBeenCalledWith(
            expect.any(String),
            '1-repos-per-language',
            expect.stringContaining('<svg')
        );
    });

    it('createCommitsPerLanguageCard should write SVG', async () => {
        await createCommitsPerLanguageCard(USERNAME, [], TOKEN);
        expect(mockWriteSVG).toHaveBeenCalled();
        expect(mockWriteSVG).toHaveBeenCalledWith(
            expect.any(String),
            '2-most-commit-language',
            expect.stringContaining('<svg')
        );
    });

    it('createStatsCard should write SVG', async () => {
        await createStatsCard(USERNAME, TOKEN);
        expect(mockWriteSVG).toHaveBeenCalled();
        expect(mockWriteSVG).toHaveBeenCalledWith(expect.any(String), '3-stats', expect.stringContaining('<svg'));
    });

    it('createProductiveTimeCard should write SVG', async () => {
        await createProductiveTimeCard(USERNAME, 0, TOKEN);
        expect(mockWriteSVG).toHaveBeenCalled();
        expect(mockWriteSVG).toHaveBeenCalledWith(
            expect.any(String),
            '4-productive-time',
            expect.stringContaining('<svg')
        );
    });

    it('createOrganizationProfileDetailsCard should write SVG', async () => {
        await createOrganizationProfileDetailsCard('acme', TOKEN);
        expect(mockWriteSVG).toHaveBeenCalled();
        const svg = mockWriteSVG.mock.calls.find((call: unknown[]) => call[1] === '0-profile-details')?.[2] as string;
        expect(svg).toContain('width="700" height="200" viewBox="0 0 700 200"');
        expect(mockWriteSVG).toHaveBeenCalledWith(
            expect.any(String),
            '0-profile-details',
            expect.stringContaining('<svg')
        );
    });

    it('createOrganizationReposPerLanguageCard should write SVG', async () => {
        await createOrganizationReposPerLanguageCard('acme', [], TOKEN);
        expect(mockWriteSVG).toHaveBeenCalled();
        expect(mockWriteSVG).toHaveBeenCalledWith(
            expect.any(String),
            '1-repos-per-language',
            expect.stringContaining('<svg')
        );
    });

    it('createOrganizationCommitsPerLanguageCard should write SVG', async () => {
        await createOrganizationCommitsPerLanguageCard('acme', [], TOKEN);
        expect(mockWriteSVG).toHaveBeenCalled();
        expect(mockWriteSVG).toHaveBeenCalledWith(
            expect.any(String),
            '2-most-commit-language',
            expect.stringContaining('<svg')
        );
    });

    it('createOrganizationStatsCard should write SVG', async () => {
        await createOrganizationStatsCard('acme', TOKEN);
        expect(mockWriteSVG).toHaveBeenCalled();
        expect(mockWriteSVG).toHaveBeenCalledWith(expect.any(String), '3-stats', expect.stringContaining('<svg'));
    });
});
