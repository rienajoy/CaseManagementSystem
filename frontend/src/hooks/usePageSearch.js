import { useSearchParams } from "react-router-dom";

export default function usePageSearch(defaultValue = "") {
  const [searchParams, setSearchParams] = useSearchParams();

  const search = searchParams.get("search") || defaultValue;
  const page = Number(searchParams.get("page") || 1);

  const setSearch = (nextSearch) => {
    const params = new URLSearchParams(searchParams);

    if (nextSearch?.trim()) {
      params.set("search", nextSearch.trim());
    } else {
      params.delete("search");
    }

    params.set("page", "1");
    setSearchParams(params);
  };

  const setPage = (nextPage) => {
    const params = new URLSearchParams(searchParams);
    params.set("page", String(nextPage));
    setSearchParams(params);
  };

  return {
    search,
    page,
    setSearch,
    setPage,
    searchParams,
    setSearchParams,
  };
}