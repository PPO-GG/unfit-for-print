module.exports = {
    branches: ['master'],
    plugins: [
        '@semantic-release/commit-analyzer',
        '@semantic-release/release-notes-generator',
        '@semantic-release/changelog',
        '@semantic-release/git',
        [
            '@semantic-release/exec',
            {
                publishCmd: 'echo "You could run a deployment script here if needed"',
            },
        ],
    ],
};
