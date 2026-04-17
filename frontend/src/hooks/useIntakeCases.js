import { useQuery } from "@tanstack/react-query";
import api from "../api";

export function useIntakeCases(params = {}) {
  return useQuery({
    queryKey: ["intake-cases", params],
    queryFn: async () => {
      const res = await api.get("/staff/intake-cases", { params });
      return res.data?.data || {};
    },
    placeholderData: (prev) => prev,
  });
}