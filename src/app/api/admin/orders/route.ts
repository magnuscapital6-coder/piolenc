import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAdminUser } from '@/lib/auth';
import { getSiteSettings } from '@/lib/settings';
import { dispatchTransactionalEmail, generateEmailTemplate } from '@/lib/email';
import { STOCK_RELEASING_STATUS } from '@/lib/stock';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const user = await getAdminUser();
  if (!user) {
    return NextResponse.json({ error: 'Accès interdit : session administrateur requise' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search') || '';
  const paymentStatus = searchParams.get('paymentStatus') || '';
  const fulfillmentStatus = searchParams.get('fulfillmentStatus') || '';

  try {
    const where: any = {};

    if (paymentStatus) {
      where.paymentStatus = paymentStatus;
    }
    if (fulfillmentStatus) {
      where.fulfillmentStatus = fulfillmentStatus;
    }
    if (search) {
      where.OR = [
        { orderNumber: { contains: search } },
        { customerFirstName: { contains: search } },
        { customerLastName: { contains: search } },
        { customerEmail: { contains: search } },
      ];
    }

    const orders = await prisma.order.findMany({
      where,
      include: {
        items: true,
        deliveryShipment: {
          include: { carrier: true },
        },
        paymentRecords: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return NextResponse.json({ orders });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const user = await getAdminUser();
  if (!user) {
    return NextResponse.json({ error: 'Accès interdit : session administrateur requise' }, { status: 401 });
  }

  // Aucun repli anonyme : l'action est imputée au compte administrateur connecté.
  const effectiveUser = user;

  try {
    const body = await request.json();
    const { orderId, fulfillmentStatus, paymentStatus, internalNotes } = body;

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { deliveryShipment: true, items: true },
    });

    if (!order) {
      return NextResponse.json({ error: 'Commande introuvable' }, { status: 404 });
    }

    const updateData: any = {};
    if (fulfillmentStatus) updateData.fulfillmentStatus = fulfillmentStatus;
    if (paymentStatus) updateData.paymentStatus = paymentStatus;
    if (internalNotes !== undefined) updateData.internalNotes = internalNotes;

    const previousFulfillment = order.fulfillmentStatus;
    const previousPayment = order.paymentStatus;

    // Annuler une commande rend sa marchandise au stock ; la « désannuler »
    // la reprend. Fait dans la même transaction que le changement de statut
    // pour qu'un échec ne laisse jamais le stock et la commande en désaccord.
    const wasCancelled = previousFulfillment === STOCK_RELEASING_STATUS;
    const willBeCancelled = (fulfillmentStatus || previousFulfillment) === STOCK_RELEASING_STATUS;
    const stockDirection = !wasCancelled && willBeCancelled ? 1 : wasCancelled && !willBeCancelled ? -1 : 0;

    const updated = await prisma.$transaction(async (tx) => {
      if (stockDirection !== 0) {
        for (const item of order.items) {
          await tx.product.updateMany({
            where: { id: item.productId },
            data: { stock: { increment: stockDirection * item.quantity } },
          });
        }
      }
      return tx.order.update({
        where: { id: order.id },
        data: updateData,
        include: {
          items: true,
          deliveryShipment: true,
        },
      });
    });

    // Record status history if changed
    if (fulfillmentStatus && fulfillmentStatus !== previousFulfillment) {
      await prisma.orderStatusHistory.create({
        data: {
          orderId: order.id,
          previousStatus: previousFulfillment,
          newStatus: fulfillmentStatus,
          statusType: 'FULFILLMENT',
          changedBy: `${effectiveUser.firstName} ${effectiveUser.lastName} (${effectiveUser.role})`,
        },
      });

      const siteSettings = await getSiteSettings();

      // Email 4: Order Validated
      if (fulfillmentStatus === 'VALIDATED') {
        const email4 = generateEmailTemplate(4, { siteSettings, order: updated });
        await dispatchTransactionalEmail({
          templateId: 4,
          recipientEmail: order.customerEmail,
          orderId: order.id,
          subject: email4.subject,
          htmlContent: email4.htmlContent,
          textContent: email4.textContent,
          idempotencyKey: `email-4-${order.orderNumber}-${Date.now()}`,
        });
      }

      // Email 5: In Preparation
      if (fulfillmentStatus === 'IN_PREPARATION') {
        const email5 = generateEmailTemplate(5, { siteSettings, order: updated });
        await dispatchTransactionalEmail({
          templateId: 5,
          recipientEmail: order.customerEmail,
          orderId: order.id,
          subject: email5.subject,
          htmlContent: email5.htmlContent,
          textContent: email5.textContent,
          idempotencyKey: `email-5-${order.orderNumber}-${Date.now()}`,
        });
      }
    }

    return NextResponse.json({ success: true, order: updated });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
