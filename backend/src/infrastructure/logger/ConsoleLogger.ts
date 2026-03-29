import { ILogger } from "../../core/interfaces/ILogger";

export class ConsoleLogger implements ILogger {
  private getTimestamp(): string {
    return new Date()
      .toLocaleString("en-GB", {
        timeZone: "Asia/Ho_Chi_Minh",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      })
      .replace(",", "");
  }

  info(message: string): void {
    console.log(`[INFO] [${this.getTimestamp()}] - ${message}`);
  }

  error(message: string): void {
    console.error(`[ERROR] [${this.getTimestamp()}] - ${message}`);
  }
}
