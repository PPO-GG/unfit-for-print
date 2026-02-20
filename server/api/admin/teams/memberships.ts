// server/api/admin/teams/memberships.ts

export default defineEventHandler(async (event) => {
  // Check if the user is an admin before proceeding
  await assertAdmin(event);

  const { userId } = await readBody(event);
  const { teams } = createAppwriteClient();

  const allTeams = await teams.list();
  const userTeams: { teamId: string; membershipId: string }[] = [];

  for (const team of allTeams.teams) {
    const memberships = await teams.listMemberships(team.$id);
    const match = memberships.memberships.find((m: any) => m.userId === userId);
    if (match) {
      userTeams.push({ teamId: team.$id, membershipId: match.$id });
    }
  }

  return userTeams;
});
