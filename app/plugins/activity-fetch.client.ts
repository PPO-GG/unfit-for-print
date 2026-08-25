export default defineNuxtPlugin(() => {
  const activityFetch = $fetch.create({
    onRequest({ options }) {
      const { authHeaders } = useAuthHeaders();
      const headers = authHeaders();
      if (Object.keys(headers).length === 0) return;

      options.headers = new Headers(options.headers);
      for (const [key, value] of Object.entries(headers)) {
        options.headers.set(key, value);
      }
    },
  });

  return { provide: { activityFetch } };
});
