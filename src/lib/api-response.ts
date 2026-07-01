import { NextResponse } from "next/server";

export type ApiPagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type ApiEnvelope<T> = {
  code: number;
  message: string;
  data: T | null;
  pagination?: ApiPagination;
};

export function ok<T>(data: T, pagination?: ApiPagination, status = 200) {
  const body: ApiEnvelope<T> = {
    code: 0,
    message: "ok",
    data,
    ...(pagination ? { pagination } : {})
  };

  return NextResponse.json(body, { status });
}

export function fail(message: string, code = 40000, status = 400) {
  const body: ApiEnvelope<never> = {
    code,
    message,
    data: null
  };

  return NextResponse.json(body, { status });
}
