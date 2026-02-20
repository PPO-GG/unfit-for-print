// server/api/admin/teams/index.ts

export default defineEventHandler(async (event) => {
  // Check if the user is an admin before proceeding
  await assertAdmin(event);

  const { teams } = createAppwriteClient();
  return await teams.list();
});
