import type { OrderStatus, PaymentStatus } from "@prisma/client";

export class InvalidStateTransitionError extends Error {
  constructor(
    public readonly entity: "order" | "payment",
    public readonly from: string,
    public readonly to: string
  ) {
    super(`${entity} status transition not allowed: ${from} -> ${to}`);
    this.name = "InvalidStateTransitionError";
  }
}

const ORDER_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  PENDING: ["PAID", "CANCELLED", "EXPIRED"],
  PAID: ["REFUNDED"],
  CANCELLED: [],
  REFUNDED: [],
  EXPIRED: [],
};

const PAYMENT_TRANSITIONS: Record<PaymentStatus, readonly PaymentStatus[]> = {
  WAITING: ["SUCCESS", "FAILED", "CLOSED"],
  SUCCESS: ["CLOSED"],
  FAILED: ["WAITING", "CLOSED"],
  CLOSED: [],
};

export function canTransitionOrder(from: OrderStatus, to: OrderStatus): boolean {
  if (from === to) return true;
  return ORDER_TRANSITIONS[from]?.includes(to) ?? false;
}

export function canTransitionPayment(from: PaymentStatus, to: PaymentStatus): boolean {
  if (from === to) return true;
  return PAYMENT_TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertOrderTransition(from: OrderStatus, to: OrderStatus): void {
  if (!canTransitionOrder(from, to)) {
    throw new InvalidStateTransitionError("order", from, to);
  }
}

export function assertPaymentTransition(from: PaymentStatus, to: PaymentStatus): void {
  if (!canTransitionPayment(from, to)) {
    throw new InvalidStateTransitionError("payment", from, to);
  }
}

/** 订单与支付成功态应对齐 */
export function pairedStatusesForPaid(): {
  orderStatus: OrderStatus;
  paymentStatus: PaymentStatus;
} {
  return { orderStatus: "PAID", paymentStatus: "SUCCESS" };
}

export function pairedStatusesForExpired(): {
  orderStatus: OrderStatus;
  paymentStatus: PaymentStatus;
} {
  return { orderStatus: "EXPIRED", paymentStatus: "CLOSED" };
}

export function pairedStatusesForFailed(): {
  orderStatus: OrderStatus;
  paymentStatus: PaymentStatus;
} {
  return { orderStatus: "PENDING", paymentStatus: "FAILED" };
}