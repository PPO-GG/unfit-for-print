/**
 * Constructs a public URL for a decoration image stored in Appwrite Storage.
 * Uses the 'decoration-images' bucket.
 */
export function getDecorationImageUrl(fileId: string): string {
  const config = useRuntimeConfig();
  const endpoint = config.public.appwriteEndpoint as string;
  const projectId = config.public.appwriteProjectId as string;
  return `${endpoint}/storage/buckets/decoration-images/files/${fileId}/view?project=${projectId}`;
}
