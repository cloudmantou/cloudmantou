/** 服务端 / 客户端通用的角色判断 */

export type AppRole = "USER" | "EDITOR" | "ADMIN" | string | undefined;

export function isAdminRole(role: AppRole): boolean {
  return role === "ADMIN";
}

export function canPublishContent(role: AppRole): boolean {
  return isAdminRole(role);
}

export function canComment(role: AppRole): boolean {
  return !!role;
}