import { useCallback, useState } from "react";

export interface Bookmark {
  id: string;
  name: string;
}

const KEY = "wdn-bookmarks";

function load(): Bookmark[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Bookmark[]) : [];
  } catch {
    return [];
  }
}

export function useBookmarks() {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>(load);

  const addBookmark = useCallback((bk: Bookmark) => {
    setBookmarks((prev) => {
      if (prev.some((b) => b.id === bk.id)) return prev;
      const next = [...prev, bk];
      localStorage.setItem(KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const removeBookmark = useCallback((id: string) => {
    setBookmarks((prev) => {
      const next = prev.filter((b) => b.id !== id);
      localStorage.setItem(KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const isBookmarked = useCallback(
    (id: string) => bookmarks.some((b) => b.id === id),
    [bookmarks]
  );

  return { bookmarks, addBookmark, removeBookmark, isBookmarked };
}
