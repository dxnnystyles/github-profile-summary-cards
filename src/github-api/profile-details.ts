import request, {assertNoGraphQLErrors, isTooExpensive, restRequest} from '../utils/request';
import {shouldFetchNextPage} from '../const/pagination';
import {withDataCache, kvGetFlag, kvSetFlag, requestStartedAt} from '../utils/data-cache';

/** Public profile fields shared by the Profile Details and GitHub Stats cards. */
export class ProfileDetails {
    id: string;
    name: string | null;
    createdAt: string;
    totalPublicRepos = 0;
    totalStars = 0;
    totalIssueContributions = 0;
    totalPullRequestContributions = 0;
    totalRepositoryContributions = 0;
    contributionYears: number[] = [];

    constructor(id: string, name: string | null, createdAt: string) {
        this.id = id;
        this.name = name;
        this.createdAt = createdAt;
    }
}

const userDetailsFetcher = (token: string, variables: {login: string}) =>
    request(
        {Authorization: `bearer ${token}`},
        {
            query: `
      query UserDetails($login: String!) {
        user(login: $login) {
          id
          name
          createdAt
          repositories(first: 1, privacy: PUBLIC, isFork: false, ownerAffiliations: OWNER) { totalCount }
          contributionsCollection { contributionYears }
          repositoriesContributedTo(first: 1, includeUserRepositories: true, privacy: PUBLIC, contributionTypes: [COMMIT, ISSUE, PULL_REQUEST, REPOSITORY]) { totalCount }
          pullRequests(first: 1) { totalCount }
          issues(first: 1) { totalCount }
        }
      }
      `,
            variables
        }
    );

const coreFetcher = (token: string, variables: {login: string}) =>
    request(
        {Authorization: `bearer ${token}`},
        {
            query: `
      query UserDetailsCore($login: String!) {
        user(login: $login) {
          id
          name
          createdAt
          repositories(first: 1, privacy: PUBLIC, isFork: false, ownerAffiliations: OWNER) { totalCount }
        }
      }
      `,
            variables
        }
    );

const yearsFetcher = (token: string, variables: {login: string}) =>
    request(
        {Authorization: `bearer ${token}`},
        {
            query: `query UserDetailsYears($login: String!) { user(login: $login) { contributionsCollection { contributionYears } } }`,
            variables
        }
    );

const countsFetcher = (token: string, variables: {login: string}) =>
    request(
        {Authorization: `bearer ${token}`},
        {
            query: `
      query UserDetailsCounts($login: String!) {
        user(login: $login) {
          repositoriesContributedTo(first: 1, includeUserRepositories: true, privacy: PUBLIC, contributionTypes: [COMMIT, ISSUE, PULL_REQUEST, REPOSITORY]) { totalCount }
          pullRequests(first: 1) { totalCount }
          issues(first: 1) { totalCount }
        }
      }
      `,
            variables
        }
    );

async function fetchSplitUser(username: string, token: string): Promise<any> {
    const variables = {login: username};
    const [core, years, counts] = await Promise.all([
        coreFetcher(token, variables),
        yearsFetcher(token, variables),
        countsFetcher(token, variables)
    ]);
    assertNoGraphQLErrors(core, 'GetProfileDetails (core) failed');
    assertNoGraphQLErrors(years, 'GetProfileDetails (years) failed');
    assertNoGraphQLErrors(counts, 'GetProfileDetails (counts) failed');
    const user = core.data.data.user;
    const countData = counts.data.data.user;
    return {
        ...user,
        repositoriesContributedTo: countData.repositoriesContributedTo,
        pullRequests: countData.pullRequests,
        issues: countData.issues,
        contributionsCollection: years.data.data.user.contributionsCollection
    };
}

const FETCH_BUDGET_MS = 20 * 1000;
const SPLIT_FLAG_TTL_SECONDS = 30 * 24 * 60 * 60;
const splitFlagKey = (username: string) => `v1:pdx:${username.toLowerCase()}`;

async function fetchTotalStars(username: string, token: string, startedAt: number): Promise<number> {
    let stars = 0;
    let page = 0;
    let hasNextPage = true;
    while (hasNextPage) {
        const response = await restRequest(token, `/users/${encodeURIComponent(username)}/repos`, {
            per_page: 100,
            page: page + 1,
            type: 'owner'
        });
        const repositories: any[] = Array.isArray(response.data) ? response.data : [];
        for (const repository of repositories) {
            if (!repository.fork) stars += repository.stargazers_count ?? 0;
        }
        page += 1;
        hasNextPage = shouldFetchNextPage(repositories.length === 100, page, undefined, startedAt, FETCH_BUDGET_MS);
    }
    return stars;
}

export async function getProfileDetails(username: string, token: string): Promise<ProfileDetails> {
    // v4 prevents old cached calendar/contact payloads from being mistaken for this smaller public-only shape.
    const compact = await withDataCache(`v4:pd:${username.toLowerCase()}`, async () => {
        const startedAt = requestStartedAt() ?? Date.now();
        if (process.env.VERCEL && Date.now() - startedAt > FETCH_BUDGET_MS) {
            throw new Error(`Profile fetch for ${username} timed out before completion`);
        }
        const starsPromise = fetchTotalStars(username, token, startedAt);
        starsPromise.catch(() => undefined);

        let user: any;
        if (await kvGetFlag(splitFlagKey(username))) {
            user = await fetchSplitUser(username, token);
        } else {
            try {
                const response = await userDetailsFetcher(token, {login: username});
                assertNoGraphQLErrors(response, 'GetProfileDetails failed');
                user = response.data.data.user;
            } catch (error) {
                if (!isTooExpensive(error)) throw error;
                void kvSetFlag(splitFlagKey(username), SPLIT_FLAG_TTL_SECONDS);
                user = await fetchSplitUser(username, token);
            }
        }
        const totalStars = await starsPromise;
        return {
            id: user.id,
            name: user.name,
            createdAt: user.createdAt,
            totalPublicRepos: user.repositories.totalCount,
            totalStars,
            totalIssueContributions: user.issues.totalCount,
            totalPullRequestContributions: user.pullRequests.totalCount,
            totalRepositoryContributions: user.repositoriesContributedTo.totalCount,
            contributionYears: user.contributionsCollection.contributionYears
        };
    });

    const profile = new ProfileDetails(compact.id, compact.name, compact.createdAt);
    profile.totalPublicRepos = compact.totalPublicRepos;
    profile.totalStars = compact.totalStars;
    profile.totalIssueContributions = compact.totalIssueContributions;
    profile.totalPullRequestContributions = compact.totalPullRequestContributions;
    profile.totalRepositoryContributions = compact.totalRepositoryContributions;
    profile.contributionYears = compact.contributionYears;
    return profile;
}
