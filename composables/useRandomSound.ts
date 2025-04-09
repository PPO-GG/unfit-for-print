type SoundsPaths = Parameters<typeof useSound>[0];

export function useRandomSound(paths: SoundsPaths[]) {
  const sounds = paths.map(p => useSound(p))
  return () => {
    const index = Math.floor(Math.random() * sounds.length)
    sounds[index].play()
  }
}
