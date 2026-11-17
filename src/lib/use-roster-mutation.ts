import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { adminDataQuery } from "./queries";

/** Wraps an admin write: shows errors as toasts and refreshes admin data on success. */
export function useRosterMutation<TVars, TResult>(
  fn: (vars: TVars) => Promise<TResult>,
  opts?: { success?: string | ((r: TResult) => string); onDone?: (r: TResult) => void },
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: async (result) => {
      await qc.invalidateQueries({ queryKey: adminDataQuery.queryKey });
      const msg = typeof opts?.success === "function" ? opts.success(result) : opts?.success;
      if (msg) toast.success(msg);
      opts?.onDone?.(result);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Something went wrong"),
  });
}
