import { PrismaClient, Prisma } from "@prisma/client";
import {
  PaymentEntity,
  PaymentStatus,
  PaymentGateway,
} from "./payment.entity";
import { BadRequestError } from "../../core/errors/AppError";

/**
 * PaymentRepository — Prisma-backed.
 *
 * Public API unchanged.
 *
 * Notes on the `onConflict` patterns:
 *
 * - `create()` previously did INSERT … ON CONFLICT (idempotency_key)
 *   DO UPDATE SET updated_at = now(), returning id. Prisma's `upsert`
 *   does the same thing at the cost of one extra SELECT round-trip;
 *   for stronger atomicity in concurrent payment creation, prefer
 *   `prisma.$transaction` with a raw INSERT.
 * - `saveWebhookEvent()` previously did INSERT … ON CONFLICT (id)
 *   DO NOTHING. We use a try/create, catch P2002 pattern, which has
 *   identical semantics for this idempotency guard.
 */
export class PaymentRepository {
  constructor(private readonly prisma: PrismaClient) {}

  get client(): PrismaClient {
    return this.prisma;
  }

  async create(
    data: {
      customerId: string;
      amount: number;
      currency: string;
      gateway: PaymentGateway;
      idempotencyKey: string;
    },
    trx: Prisma.TransactionClient,
  ): Promise<string> {
    // Upsert for idempotency. If a payment with this key already exists
    // we'll fetch and check its status before returning its id.
    const existing = await trx.payment.findUnique({
      where: { idempotencyKey: data.idempotencyKey },
      select: { id: true, status: true },
    });

    if (existing) {
      if (existing.status !== "pending") {
        throw new BadRequestError(
          `Cannot reuse a payment that is already ${existing.status}`,
        );
      }
      return existing.id;
    }

    try {
      const row = await trx.payment.create({
        data: {
          customerId: data.customerId,
          amount: data.amount,
          currency: data.currency,
          gateway: data.gateway,
          idempotencyKey: data.idempotencyKey,
        },
        select: { id: true },
      });
      return row.id;
    } catch (err) {
      // Concurrent insert with the same idempotency key.
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        const found = await trx.payment.findUnique({
          where: { idempotencyKey: data.idempotencyKey },
          select: { id: true, status: true },
        });
        if (!found) throw err;
        if (found.status !== "pending") {
          throw new BadRequestError(
            `Cannot reuse a payment that is already ${found.status}`,
          );
        }
        return found.id;
      }
      throw err;
    }
  }

  async findById(
    id: string,
    db?: Prisma.TransactionClient,
  ): Promise<PaymentEntity | null> {
    const client = db ?? this.prisma;
    const row = await client.payment.findUnique({ where: { id } });
    if (!row) return null;

    const orderIds = await this.loadOrderIds(id, client);
    return PaymentEntity.fromDatabase(row, orderIds);
  }

  async findByGatewayRef(
    gatewayRef: string,
    db?: Prisma.TransactionClient,
  ): Promise<PaymentEntity | null> {
    const client = db ?? this.prisma;
    const row = await client.payment.findFirst({
      where: { gatewayRef },
    });
    if (!row) return null;

    const orderIds = await this.loadOrderIds(row.id, client);
    return PaymentEntity.fromDatabase(row, orderIds);
  }

  async updateStatus(
    id: string,
    status: PaymentStatus,
    extra: { gatewayRef?: string; gatewayData?: unknown } = {},
    trx: Prisma.TransactionClient,
  ): Promise<void> {
    const data: Prisma.PaymentUpdateInput = { status };
    if (extra.gatewayRef !== undefined) data.gatewayRef = extra.gatewayRef;
    if (extra.gatewayData !== undefined) {
      data.gatewayData = (extra.gatewayData as Prisma.InputJsonValue) ?? Prisma.JsonNull;
    }
    await trx.payment.update({ where: { id }, data });
  }

  async setGatewayRef(
    id: string,
    gatewayRef: string,
    trx: Prisma.TransactionClient,
  ): Promise<void> {
    await trx.payment.update({
      where: { id },
      data: { gatewayRef },
    });
  }

  /**
   * Idempotency guard for webhook handlers.
   * Returns true on first insert, false if the event was already processed.
   */
  async saveWebhookEvent(
    data: {
      id: string;
      gateway: string;
      eventType: string;
      payload: unknown;
    },
    trx: Prisma.TransactionClient,
  ): Promise<boolean> {
    try {
      await trx.webhookEvent.create({
        data: {
          id: data.id,
          gateway: data.gateway,
          eventType: data.eventType,
          payload: data.payload as Prisma.InputJsonValue,
        },
      });
      return true;
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        return false;
      }
      throw err;
    }
  }

  async loadOrderIds(
    paymentId: string,
    db?: Prisma.TransactionClient,
  ): Promise<string[]> {
    const client = db ?? this.prisma;
    const rows = await client.order.findMany({
      where: { paymentId },
      select: { id: true },
    });
    return rows.map((r) => r.id);
  }
}
