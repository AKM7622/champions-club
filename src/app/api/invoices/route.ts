import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { PaymentMethod, PaymentStatus, TransactionCategory, TransactionType } from "@prisma/client";
import { addDays } from "date-fns";

export async function GET() {
  try {
    const invoices = await prisma.invoice.findMany({
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ success: true, invoices });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { clientName, clientEmail, clientType = "CORPORATE", amount, description, dueInDays = 14 } = body;

    if (!clientName || !amount) {
      return NextResponse.json({ success: false, error: "Client name and amount are required." }, { status: 400 });
    }

    const now = new Date();
    const invoiceNumber = `INV-${now.getFullYear()}-${Math.floor(100 + Math.random() * 900)}`;
    const baseAmount = Number(amount);
    const taxAmount = Number((baseAmount * 0.18).toFixed(2)); // 18% GST for corporate service
    const totalAmount = baseAmount + taxAmount;

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber,
        clientName,
        clientEmail: clientEmail || "finance@client.corp",
        clientType,
        amount: baseAmount,
        taxAmount,
        totalAmount,
        dueDate: addDays(now, dueInDays),
        description: description || "Sports club reservation & corporate package",
        status: PaymentStatus.PENDING,
      },
    });

    return NextResponse.json({
      success: true,
      invoice,
      message: `Invoice ${invoice.invoiceNumber} created for ${invoice.clientName}.`,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { invoiceId, paymentMethod = PaymentMethod.CARD } = body;

    if (!invoiceId) {
      return NextResponse.json({ success: false, error: "Invoice ID required" }, { status: 400 });
    }

    const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
    if (!invoice) {
      return NextResponse.json({ success: false, error: "Invoice not found" }, { status: 404 });
    }

    const now = new Date();
    const refNo = `TXN-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}-${Math.floor(
      1000 + Math.random() * 9000
    )}`;

    const result = await prisma.$transaction(async (tx) => {
      // 1. Update invoice
      const updated = await tx.invoice.update({
        where: { id: invoiceId },
        data: { status: PaymentStatus.PAID },
      });

      // 2. Record corporate settlement in unified ledger
      const transaction = await tx.transaction.create({
        data: {
          referenceNo: refNo,
          type: TransactionType.CORPORATE_INVOICE,
          category: TransactionCategory.CORPORATE,
          amount: invoice.totalAmount,
          paymentMethod: paymentMethod as PaymentMethod,
          notes: `Settlement for Invoice #${invoice.invoiceNumber} (${invoice.clientName})`,
        },
      });

      return { invoice: updated, transaction };
    });

    return NextResponse.json({
      success: true,
      invoice: result.invoice,
      transaction: result.transaction,
      message: `Invoice ${invoice.invoiceNumber} settled and written to unified ledger!`,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
