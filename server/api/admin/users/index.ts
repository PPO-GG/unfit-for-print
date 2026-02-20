// server/api/admin/users/index.ts

export default defineEventHandler(async (event) => {
  await assertAdmin(event);

  const { users } = createAppwriteClient();
  const result = await users.list();

  return { users: result.users };
});
