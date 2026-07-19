import { createContainer, asClass, asValue, InjectionMode } from "awilix";
import type { PrismaClient } from "@prisma/client";
import { ILogger } from "../core/interfaces/ILogger";
import { ConsoleLogger } from "../infrastructure/logger/ConsoleLogger";
import { prisma } from "./prisma";
import { UserRepository } from "../modules/user/user.repository";
import { AuthService } from "../modules/auth/auth.service";
import { AuthController } from "../modules/auth/auth.controller";
import { CategoryRepository } from "../modules/category/category.repository";
import { CategoryService } from "../modules/category/category.service";
import { CategoryController } from "../modules/category/category.controller";
import { ProductRepository } from "../modules/product/product.repository";
import { ProductService } from "../modules/product/product.service";
import { ProductController } from "../modules/product/product.controller";
import { LocalUploadService } from "../modules/upload/upload.service";
import { UploadController } from "../modules/upload/upload.controller";
import { InventoryRepository } from "../modules/inventory/inventory.repository";
import { InventoryService } from "../modules/inventory/inventory.service";
import { InventoryController } from "../modules/inventory/inventory.controller";
import { CartRepository } from "../modules/cart/cart.repository";
import { CartService } from "../modules/cart/cart.service";
import { CartController } from "../modules/cart/cart.controller";
import { OrderRepository } from "../modules/order/order.repository";
import { OrderService } from "../modules/order/order.service";
import { OrderController } from "../modules/order/order.controller";
import { PaymentRepository } from "../modules/payment/payment.repository";
import { PaymentService } from "../modules/payment/payment.service";
import { PaymentController } from "../modules/payment/payment.controller";
import type { IPaymentGateway } from "../modules/payment/payment.interface";
import { WebhookService } from "../modules/webhook/webhook.service";
import { WebhookController } from "../modules/webhook/webhook.controller";
import { DashboardRepository } from "../modules/dashboard/dashboard.repository";
import { DashboardService } from "../modules/dashboard/dashboard.service";
import { DashboardController } from "../modules/dashboard/dashboard.controller";
import { SellerService } from "../modules/seller/seller.service";
import { SellerController } from "../modules/seller/seller.controller";
import { NotificationRepository } from "../modules/notification/notification.repository";
import { NotificationService } from "../modules/notification/notification.service";
import { NotificationController } from "../modules/notification/notification.controller";
import { MoMoAdapter } from "../modules/payment/adapters/momo.adapter";
import { VNPayAdapter } from "../modules/payment/adapters/vnpay.adapter";

const momoConfig = {
  partnerCode: process.env.MOMO_PARTNER_CODE as string,
  accessKey: process.env.MOMO_ACCESS_KEY as string,
  secretKey: process.env.MOMO_SECRET_KEY as string,
  apiUrl: process.env.MOMO_API_URL as string,
  ipnUrl: process.env.MOMO_IPN_URL as string,
};

const vnpayConfig = {
  tmnCode: process.env.VNP_TMN_CODE ?? "",
  hashSecret: process.env.VNP_HASH_SECRET ?? "",
  payUrl:
    process.env.VNP_URL ?? "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html",
};

// Awilix DI container — Prisma-injected.
//
// The previous Kysely-based `db: Kysely<DatabaseSchema>` is replaced by
// `prisma: PrismaClient`. All repositories now take `PrismaClient`
// instead of `Kysely<DatabaseSchema>` in their constructor.
// Services/controllers are unaware of the swap.
export interface ICradle {
  logger: ILogger;
  prisma: PrismaClient;

  // User
  userRepository: UserRepository;
  // Auth
  authService: AuthService;
  authController: AuthController;
  // Category
  categoryRepository: CategoryRepository;
  categoryService: CategoryService;
  categoryController: CategoryController;
  // Product
  productRepository: ProductRepository;
  productService: ProductService;
  productController: ProductController;
  // Upload
  uploadService: LocalUploadService;
  uploadController: UploadController;
  // Inventory
  inventoryRepository: InventoryRepository;
  inventoryService: InventoryService;
  inventoryController: InventoryController;
  // Cart
  cartRepository: CartRepository;
  cartService: CartService;
  cartController: CartController;
  // Order
  orderRepository: OrderRepository;
  orderService: OrderService;
  orderController: OrderController;
  // Payment
  paymentRepository: PaymentRepository;
  paymentService: PaymentService;
  paymentController: PaymentController;
  gateway: IPaymentGateway;
  // Webhook
  webhookService: WebhookService;
  webhookController: WebhookController;
  // Dashboard
  dashboardRepository: DashboardRepository;
  dashboardService: DashboardService;
  dashboardController: DashboardController;
  // Seller profile
  sellerService: SellerService;
  sellerController: SellerController;
  // Notifications
  notificationRepository: NotificationRepository;
  notificationService: NotificationService;
  notificationController: NotificationController;
}

const container = createContainer<ICradle>({
  injectionMode: InjectionMode.CLASSIC,
});

container.register({
  logger: asClass(ConsoleLogger).singleton(),
  prisma: asValue(prisma),
  // User
  userRepository: asClass(UserRepository).scoped(),
  // Auth
  authService: asClass(AuthService).scoped(),
  authController: asClass(AuthController).scoped(),
  // Category
  categoryRepository: asClass(CategoryRepository).scoped(),
  categoryService: asClass(CategoryService).scoped(),
  categoryController: asClass(CategoryController).scoped(),
  // Product
  productRepository: asClass(ProductRepository).scoped(),
  productService: asClass(ProductService).scoped(),
  productController: asClass(ProductController).scoped(),
  // Upload
  uploadService: asClass(LocalUploadService).singleton(),
  uploadController: asClass(UploadController).scoped(),
  // Inventory
  inventoryRepository: asClass(InventoryRepository).scoped(),
  inventoryService: asClass(InventoryService).scoped(),
  inventoryController: asClass(InventoryController).scoped(),
  // Cart
  cartRepository: asClass(CartRepository).scoped(),
  cartService: asClass(CartService).scoped(),
  cartController: asClass(CartController).scoped(),
  // Order
  orderRepository: asClass(OrderRepository).scoped(),
  orderService: asClass(OrderService).scoped(),
  orderController: asClass(OrderController).scoped(),
  // Aliased for `OrderService`'s `notifications` constructor parameter.
  // Awilix CLASSIC mode resolves constructor params by name, so we
  // expose the same `NotificationService` under both keys.
  notifications: asClass(NotificationService).scoped(),
  // Payment
  paymentRepository: asClass(PaymentRepository).scoped(),
  paymentService: asClass(PaymentService).scoped(),
  paymentController: asClass(PaymentController).scoped(),
  gateway: asValue(new VNPayAdapter(vnpayConfig)),
  // Webhook
  webhookService: asClass(WebhookService).scoped(),
  webhookController: asClass(WebhookController).scoped(),
  // Dashboard
  dashboardRepository: asClass(DashboardRepository).scoped(),
  dashboardService: asClass(DashboardService).scoped(),
  dashboardController: asClass(DashboardController).scoped(),
  // Seller profile
  sellerService: asClass(SellerService).scoped(),
  sellerController: asClass(SellerController).scoped(),
  // Notifications
  notificationRepository: asClass(NotificationRepository).scoped(),
  notificationService: asClass(NotificationService).scoped(),
  notificationController: asClass(NotificationController).scoped(),
});

export { container };
