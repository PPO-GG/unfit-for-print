export const branches = ['master'];
export const plugins = [
    '@semantic-release/commit-analyzer', // figure out bump type from commits
    '@semantic-release/release-notes-generator', // generate changelog text
    '@semantic-release/changelog', // write to CHANGELOG.md
    '@semantic-release/git', // commit CHANGELOG.md + version bump
    [
        '@semantic-release/exec',
        {
            publishCmd: 'echo "You could run a deployment script here if needed"',
        },
    ],
];
