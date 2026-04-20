import { Kysely, Transaction } from "kysely";
import {
  DatabaseSchema,
  NewWebhookEvent,
  PaymentRow,
} from "../../infrastructure/database/db.schema";
import { PaymentEntity, PaymentStatus, PaymentGateway } from "./payment.entity";

type DbOrTrx = Kysely<DatabaseSchema> | Transaction<DatabaseSchema>;

export class PaymentRepository {
  constructor(private db: Kysely<DatabaseSchema>) {}

  get client(): Kysely<DatabaseSchema> {
    return this.db;
  }

  // Create payment record
}
