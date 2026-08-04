export type RemoteImageFailureReason =
  | "UNSAFE_URL"
  | "FETCH_FAILED"
  | "TOO_LARGE"
  | "INVALID_IMAGE"
  | "PROCESS_FAILED";

export type ImportedRemoteImageItem = {
  sourceUrl: string;
  status: "imported";
  url: string;
  width: number;
  height: number;
  originalBytes: number;
  compressedBytes: number;
  compressionRatio: number;
};

export type FailedRemoteImageItem = {
  sourceUrl: string;
  status: "failed";
  reason: RemoteImageFailureReason;
};

export type RemoteImageImportItem = ImportedRemoteImageItem | FailedRemoteImageItem;

export type RemoteImageImportResult = {
  items: RemoteImageImportItem[];
  importedCount: number;
  failedCount: number;
};
