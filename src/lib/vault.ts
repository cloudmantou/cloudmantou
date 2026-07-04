import type { VaultEntry, VaultEntryType } from "@prisma/client";
import {
  decryptVaultField,
  encryptVaultField,
  hasVaultSecret,
} from "@/lib/vault-crypto";

export type VaultEntryInput = {
  title: string;
  type: VaultEntryType;
  account?: string | null;
  secret?: string | null;
  url?: string | null;
  content?: string | null;
  remark?: string | null;
  pinned?: boolean;
};

export type VaultListItem = {
  id: string;
  title: string;
  type: VaultEntryType;
  account: string | null;
  url: string | null;
  remark: string | null;
  pinned: boolean;
  hasSecret: boolean;
  hasContent: boolean;
  createdAt: string;
  updatedAt: string;
};

export type VaultDetail = VaultListItem & {
  secret: string;
  content: string;
};

export function toVaultListItem(row: VaultEntry): VaultListItem {
  return {
    id: row.id,
    title: row.title,
    type: row.type,
    account: row.account,
    url: row.url,
    remark: row.remark,
    pinned: row.pinned,
    hasSecret: hasVaultSecret(row.secretEnc),
    hasContent: hasVaultSecret(row.contentEnc),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toVaultDetail(row: VaultEntry): VaultDetail {
  return {
    ...toVaultListItem(row),
    secret: decryptVaultField(row.secretEnc),
    content: decryptVaultField(row.contentEnc),
  };
}

export function buildVaultWriteData(input: VaultEntryInput, existing?: VaultEntry) {
  const data: {
    title: string;
    type: VaultEntryType;
    account: string | null;
    url: string | null;
    remark: string | null;
    pinned: boolean;
    secretEnc?: string | null;
    contentEnc?: string | null;
  } = {
    title: input.title.trim(),
    type: input.type,
    account: input.account?.trim() || null,
    url: input.url?.trim() || null,
    remark: input.remark?.trim() || null,
    pinned: input.pinned ?? false,
  };

  if (input.secret !== undefined) {
    const trimmed = input.secret?.trim() ?? "";
    if (!trimmed) {
      data.secretEnc = null;
    } else {
      data.secretEnc = encryptVaultField(trimmed);
    }
  }

  if (input.content !== undefined) {
    const trimmed = input.content?.trim() ?? "";
    if (!trimmed) {
      data.contentEnc = null;
    } else {
      data.contentEnc = encryptVaultField(trimmed);
    }
  }

  return data;
}

export const VAULT_TYPE_LABELS: Record<VaultEntryType, string> = {
  ACCOUNT: "账号密码",
  SECRET: "密钥令牌",
  NOTE: "保密笔记",
};