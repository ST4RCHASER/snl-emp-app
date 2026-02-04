import {
  queryOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { api } from "../client";
import { logAction } from "./audit";

export interface ComplaintMessage {
  id: string;
  content: string;
  isFromHR: boolean;
  isSelf: boolean;
  senderName: string;
  attachmentUrl?: string | null;
  attachmentName?: string | null;
  attachmentType?: string | null;
  attachmentSize?: number | null;
  createdAt: string;
}

export interface ComplaintDetail {
  id: string;
  subject: string;
  description: string;
  status: ComplaintStatus;
  messages: ComplaintMessage[];
  createdAt: string;
  updatedAt: string;
}

export const complaintQueries = {
  all: (view?: string, status?: string) =>
    queryOptions({
      queryKey: ["complaints", { view, status }],
      queryFn: async () => {
        const { data, error } = await api.api.complaints.get({
          query: { view, status },
        });
        if (error) throw error;
        return data;
      },
    }),

  detail: (id: string) =>
    queryOptions({
      queryKey: ["complaints", id],
      queryFn: async () => {
        const { data, error } = await api.api.complaints({ id }).get();
        if (error) throw error;
        if (!data || typeof data !== "object" || !("id" in data)) {
          throw new Error("Invalid complaint data");
        }
        return data as unknown as ComplaintDetail;
      },
    }),
};

export function useCreateComplaint() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      subject: string;
      description: string;
      isAnonymous?: boolean;
    }) => {
      const { data: result, error } = await api.api.complaints.post(data);
      if (error) throw error;
      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["complaints"] });
      logAction("submit_complaint", "form", "Submitted a complaint", {
        subject: variables.subject,
        isAnonymous: variables.isAnonymous,
      });
    },
  });
}

export type ComplaintStatus = "BACKLOG" | "IN_PROGRESS" | "DONE";

export function useUpdateComplaintStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      status,
    }: {
      id: string;
      status: ComplaintStatus;
    }) => {
      const { data, error } = await api.api
        .complaints({ id })
        .status.put({ status });
      if (error) throw error;
      return data;
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["complaints"] });
      queryClient.invalidateQueries({ queryKey: ["complaints", id] });
    },
  });
}

export interface SendMessagePayload {
  complaintId: string;
  content: string;
  attachmentUrl?: string;
  attachmentName?: string;
  attachmentType?: string;
  attachmentSize?: number;
}

export function useSendComplaintMessage() {
  return useMutation({
    mutationFn: async ({
      complaintId,
      content,
      attachmentUrl,
      attachmentName,
      attachmentType,
      attachmentSize,
    }: SendMessagePayload) => {
      const { data, error } = await api.api
        .complaints({ id: complaintId })
        .messages.post({
          content,
          attachmentUrl,
          attachmentName,
          attachmentType,
          attachmentSize,
        });
      if (error) throw error;
      return data;
    },
    // No query invalidation - SSE handles real-time updates
    // and we use optimistic updates for the sender
  });
}

export function useUploadFile() {
  return useMutation({
    mutationFn: async (file: File) => {
      const { data, error } = await api.api.upload.post({ file });
      if (error) throw error;
      return data;
    },
  });
}

export function useUpdateComplaintResponse() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, response }: { id: string; response: string }) => {
      const { data, error } = await api.api
        .complaints({ id })
        .response.put({ response });
      if (error) throw error;
      return data;
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["complaints"] });
      queryClient.invalidateQueries({ queryKey: ["complaints", id] });
    },
  });
}
