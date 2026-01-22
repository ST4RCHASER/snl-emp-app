import {
  queryOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { api } from "../client";

export interface UpdateProfileData {
  fullName?: string;
  nickname?: string;
  phone?: string;
  dateOfBirth?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

export const employeeQueries = {
  all: queryOptions({
    queryKey: ["employees"],
    queryFn: async () => {
      const { data, error } = await api.api.employees.get();
      if (error) throw error;
      return data;
    },
  }),

  me: queryOptions({
    queryKey: ["employees", "me"],
    queryFn: async () => {
      const { data, error } = await api.api.employees.me.get();
      if (error) throw error;
      return data;
    },
  }),

  detail: (id: string) =>
    queryOptions({
      queryKey: ["employees", id],
      queryFn: async () => {
        const { data, error } = await api.api.employees({ id }).get();
        if (error) throw error;
        return data;
      },
    }),

  managers: (id: string) =>
    queryOptions({
      queryKey: ["employees", id, "managers"],
      queryFn: async () => {
        const { data, error } = await api.api.employees({ id }).managers.get();
        if (error) throw error;
        return data;
      },
    }),
};

export function useUpdateEmployee() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Record<string, unknown>;
    }) => {
      const { data: result, error } = await api.api.employees({ id }).put(data);
      if (error) throw error;
      return result;
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      queryClient.invalidateQueries({ queryKey: ["employees", id] });
    },
  });
}

export function useAssignManagers() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      managerIds,
    }: {
      id: string;
      managerIds: string[];
    }) => {
      const { data, error } = await api.api
        .employees({ id })
        .managers.put({ managerIds });
      if (error) throw error;
      return data;
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({
        queryKey: ["employees", id, "managers"],
      });
    },
  });
}

export function useUpdateMyProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: UpdateProfileData) => {
      const { data: result, error } = await api.api.employees.me.put(data);
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      queryClient.invalidateQueries({ queryKey: ["employees", "me"] });
    },
  });
}

export function useUpdateUserRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      role,
    }: {
      id: string;
      role: "EMPLOYEE" | "HR" | "MANAGEMENT" | "DEVELOPER";
    }) => {
      const { data, error } = await api.api
        .employees({ id })
        .role.put({ role });
      if (error) throw error;
      return data;
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      queryClient.invalidateQueries({ queryKey: ["employees", id] });
    },
  });
}
