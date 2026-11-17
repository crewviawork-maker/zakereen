import { queryOptions } from "@tanstack/react-query";
import { getAdminData, getMyGroup } from "./roster.functions";

export const adminDataQuery = queryOptions({
  queryKey: ["admin-data"],
  queryFn: () => getAdminData(),
});

export const myGroupQuery = queryOptions({
  queryKey: ["my-group"],
  queryFn: () => getMyGroup(),
});
