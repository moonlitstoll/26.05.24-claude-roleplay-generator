// Scripts generated without a topic were saved under these placeholder names.
export function sessionTitle(input: string | undefined): string {
  const title = input?.trim();
  return !title || title === 'Random' || title === 'Random Topic' ? '임의 주제' : title;
}
