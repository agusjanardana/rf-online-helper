"use client";
import { useState } from "react";
import { useWords } from "./ui";
export function useListPage<T>(items: T[]) {
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(items.length / 10));
  const current = Math.min(page, pages - 1);
  return {
    rows: items.slice(current * 10, current * 10 + 10),
    page: current,
    pages,
    total: items.length,
    setPage,
  };
}
export function ListPagination({
  page,
  pages,
  total,
  setPage,
}: {
  page: number;
  pages: number;
  total: number;
  setPage: (page: number) => void;
}) {
  const w = useWords();
  if (total <= 10) return null;
  return (
    <nav
      className="raid-participant-pagination"
      aria-label={w("Halaman daftar", "List pages")}
    >
      <span>
        {page * 10 + 1}–{Math.min(page * 10 + 10, total)} / {total}
      </span>
      <div className="guild-links">
        <button
          type="button"
          disabled={!page}
          onClick={() => setPage(page - 1)}
        >
          {w("Sebelumnya", "Previous")}
        </button>
        <span>
          {page + 1} / {pages}
        </span>
        <button
          type="button"
          disabled={page + 1 >= pages}
          onClick={() => setPage(page + 1)}
        >
          {w("Berikutnya", "Next")}
        </button>
      </div>
    </nav>
  );
}
