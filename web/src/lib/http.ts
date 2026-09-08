import axios, { isAxiosError } from "axios";

export const http = axios.create({
  withCredentials: true,
});

http.interceptors.response.use(
  (response) => response,
  (error) => {
    if (isAxiosError(error)) {
      const payload = error.response?.data as { error?: string } | undefined;
      if (payload?.error) {
        return Promise.reject(new Error(payload.error));
      }
    }
    return Promise.reject(error instanceof Error ? error : new Error("요청에 실패했습니다."));
  }
);
