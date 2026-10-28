import {getProfileDetails} from '../../src/github-api/profile-details';
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';

const mock = new MockAdapter(axios);
const profile = {
    id: 'userID',
    name: 'dxnnystyles',
    createdAt: '2016-07-01T10:46:25Z',
    repositories: {totalCount: 7},
    contributionsCollection: {contributionYears: [2024, 2025, 2026]},
    issues: {totalCount: 10},
    repositoriesContributedTo: {totalCount: 30},
    pullRequests: {totalCount: 40}
};
const graphqlData = {data: {user: profile}};
const repoPages = [
    {fork: false, stargazers_count: 11},
    {fork: true, stargazers_count: 50}
];

function mockStars(login: string): void {
    mock.onGet(`https://api.github.com/users/${login}/repos`).reply(config => {
        const page = Number(config.params?.page ?? 1);
        return [200, page === 1 ? repoPages : []];
    });
}

afterEach(() => mock.reset());

describe('public profile details API', () => {
    it('fetches only public account fields needed by the profile and stats cards', async () => {
        mock.onPost('https://api.github.com/graphql').reply(200, graphqlData);
        mockStars('dxnnystyles');

        const result = await getProfileDetails('dxnnystyles', 'token');
        const query = JSON.parse(mock.history.post[0].data).query as string;
        expect(query).toContain('privacy: PUBLIC');
        expect(query).toContain('isFork: false');
        expect(query).toContain('contributionYears');
        expect(query).not.toMatch(
            /contributionCalendar|contributionDays|\bemail\b|company|location|websiteUrl|twitterUsername/i
        );
        expect(result).toEqual({
            id: 'userID',
            name: 'dxnnystyles',
            createdAt: '2016-07-01T10:46:25Z',
            totalPublicRepos: 7,
            totalStars: 11,
            totalIssueContributions: 10,
            totalPullRequestContributions: 40,
            totalRepositoryContributions: 30,
            contributionYears: [2024, 2025, 2026]
        });
    });

    it('retains the lower-cost split fallback when GitHub rejects the combined query', async () => {
        const resourceLimit = {errors: [{message: 'Resource limits for this query exceeded.'}]};
        mock.onPost('https://api.github.com/graphql').reply(config => {
            const query = JSON.parse(config.data).query as string;
            if (query.includes('query UserDetails(')) return [200, resourceLimit];
            if (query.includes('UserDetailsCore'))
                return [
                    200,
                    {
                        data: {
                            user: {
                                id: profile.id,
                                name: profile.name,
                                createdAt: profile.createdAt,
                                repositories: profile.repositories
                            }
                        }
                    }
                ];
            if (query.includes('UserDetailsYears'))
                return [
                    200,
                    {
                        data: {
                            user: {
                                contributionsCollection: profile.contributionsCollection
                            }
                        }
                    }
                ];
            if (query.includes('UserDetailsCounts'))
                return [
                    200,
                    {
                        data: {
                            user: {
                                issues: profile.issues,
                                pullRequests: profile.pullRequests,
                                repositoriesContributedTo: profile.repositoriesContributedTo
                            }
                        }
                    }
                ];
            return [500, {errors: [{message: 'unexpected query'}]}];
        });
        mockStars('dxnnystyles');

        const result = await getProfileDetails('dxnnystyles', 'token');
        expect(mock.history.post).toHaveLength(4);
        expect(result.totalPublicRepos).toBe(7);
        expect(result.contributionYears).toEqual([2024, 2025, 2026]);
        expect(result.totalStars).toBe(11);
    });

    it('fails closed when GitHub returns an account error', async () => {
        mock.onPost('https://api.github.com/graphql').reply(200, {
            errors: [{type: 'NOT_FOUND', message: 'GitHub api failed'}]
        });
        mockStars('dxnnystyles');
        await expect(getProfileDetails('dxnnystyles', 'token')).rejects.toThrow('GitHub api failed');
    });
});
