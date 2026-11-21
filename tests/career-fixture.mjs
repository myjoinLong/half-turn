export function markOpeningSeen(page) {
  return page.addInitScript(() => {
    const key = "half-turn.ski.v1";
    if (!localStorage.getItem(key))
      localStorage.setItem(key, JSON.stringify({ openingSeen: true }));
  });
}
