/**
 * PayGuard PayPal Sandbox Service
 * Handles server-side order creation & capture, with offline demo fallback.
 * 
 * SECURITY MANDATE:
 * Production and Sandbox Client Secrets are NEVER kept on the frontend.
 * PayGuard's AI Risk clearance is distinct from PayPal's financial capture result.
 */

import { DemoPaymentOrder, PayPalExecutionResult } from '../types/payguardAuth';

// Test override state for automated tests
let testPayPalOverride: {
  forcedSuccess?: boolean;
  forcedFailureReason?: string;
  forcedMode?: 'SANDBOX' | 'OFFLINE_DEMO';
} | null = null;

export function setTestPayPalOverride(override: {
  forcedSuccess?: boolean;
  forcedFailureReason?: string;
  forcedMode?: 'SANDBOX' | 'OFFLINE_DEMO';
} | null) {
  testPayPalOverride = override;
}

export class PayPalSandboxService {
  private static isOfflineDemoMode: boolean = true; // Defaults to offline demo mode for safe testing

  public static isOffline(): boolean {
    return this.isOfflineDemoMode;
  }

  public static setOfflineMode(enabled: boolean): void {
    this.isOfflineDemoMode = enabled;
  }

  /**
   * Executes or captures payment via PayPal Sandbox or Offline Demo mode.
   */
  public static async executeOrder(
    order: DemoPaymentOrder,
    payguardCleared: boolean
  ): Promise<PayPalExecutionResult> {
    const timestamp = new Date().toISOString();

    // Check test overrides
    if (testPayPalOverride) {
      if (testPayPalOverride.forcedSuccess === false) {
        return {
          success: false,
          orderId: order.orderId,
          status: 'FAILED',
          mode: testPayPalOverride.forcedMode || 'SANDBOX',
          amount: order.amount,
          currency: order.currency,
          timestamp,
          message: testPayPalOverride.forcedFailureReason || 'PayPal Sandbox API returned 422 UNPROCESSABLE_ENTITY (Instrument Declined)'
        };
      }
      if (testPayPalOverride.forcedSuccess === true) {
        return {
          success: true,
          orderId: order.orderId,
          captureId: `CAPTURE-TEST-${Math.floor(100000 + Math.random() * 900000)}`,
          status: 'COMPLETED',
          mode: testPayPalOverride.forcedMode || 'SANDBOX',
          amount: order.amount,
          currency: order.currency,
          timestamp,
          message: 'PayPal Sandbox payment captured successfully.'
        };
      }
    }

    // PayGuard security gate check
    if (!payguardCleared) {
      return {
        success: false,
        orderId: order.orderId,
        status: 'FAILED',
        mode: this.isOfflineDemoMode ? 'OFFLINE_DEMO' : 'SANDBOX',
        amount: order.amount,
        currency: order.currency,
        timestamp,
        message: 'Payment rejected: PayGuard AI Risk Engine did not clear transaction.'
      };
    }

    // Offline Demo Mode: simulates local sandbox execution with high fidelity
    if (this.isOfflineDemoMode) {
      await new Promise(r => setTimeout(r, 650)); // simulate network latency
      const captureId = `PP-OFFLINE-CAP-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      return {
        success: true,
        orderId: order.orderId,
        captureId,
        status: 'OFFLINE_DEMO_APPROVED',
        mode: 'OFFLINE_DEMO',
        amount: order.amount,
        currency: order.currency,
        timestamp,
        message: 'Simulated payment completed locally in Labeled Offline Demo Mode.'
      };
    }

    // Live Sandbox API endpoint call to backend
    try {
      const response = await fetch('/api/paypal/create-and-capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: order.amount,
          currency: order.currency,
          merchant: order.merchantName,
          orderId: order.orderId
        })
      });

      if (!response.ok) {
        throw new Error(`PayPal Sandbox server responded with HTTP ${response.status}`);
      }

      const data = await response.json();
      return {
        success: true,
        orderId: data.id || order.orderId,
        captureId: data.captureId || `CAP-${Date.now()}`,
        status: 'COMPLETED',
        mode: 'SANDBOX',
        amount: order.amount,
        currency: order.currency,
        timestamp,
        message: 'PayPal Sandbox order captured and verified via server API.'
      };
    } catch (err: any) {
      // Graceful fallback to offline notice
      return {
        success: false,
        orderId: order.orderId,
        status: 'FAILED',
        mode: 'SANDBOX',
        amount: order.amount,
        currency: order.currency,
        timestamp,
        message: `PayPal Sandbox backend unreachable (${err?.message || 'Network error'}). Use Offline Demo Mode to test.`
      };
    }
  }
}
