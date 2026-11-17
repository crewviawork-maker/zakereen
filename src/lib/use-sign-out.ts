import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { logout } from "./roster.functions";

export function useSignOut() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const logoutFn = useServerFn(logout);
  return async () => {
    await queryClient.cancelQueries();
    await logoutFn();
    queryClient.clear();
    navigate({ to: "/", replace: true });
  };
}
