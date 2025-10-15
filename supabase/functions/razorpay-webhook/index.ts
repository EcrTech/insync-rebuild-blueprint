import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createHmac } from 'https://deno.land/std@0.177.0/node/crypto.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-razorpay-signature',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const signature = req.headers.get('x-razorpay-signature');
    const body = await req.text();

    console.log('Webhook received from Razorpay');

    // Verify webhook signature
    const RAZORPAY_KEY_SECRET = Deno.env.get('RAZORPAY_KEY_SECRET');
    if (!RAZORPAY_KEY_SECRET) {
      throw new Error('Razorpay secret not configured');
    }

    const hmac = createHmac('sha256', RAZORPAY_KEY_SECRET);
    hmac.update(body);
    const expectedSignature = hmac.digest('hex');

    if (signature !== expectedSignature) {
      console.error('Webhook signature verification failed');
      throw new Error('Invalid webhook signature');
    }

    const event = JSON.parse(body);
    console.log('Webhook event:', event.event);

    // Process webhook based on event type
    switch (event.event) {
      case 'payment.authorized':
      case 'payment.captured': {
        const payment = event.payload.payment.entity;
        console.log('Payment authorized/captured:', payment.id);

        // Find payment transaction by order_id
        const { data: paymentTxn } = await supabase
          .from('payment_transactions')
          .select('*')
          .eq('razorpay_order_id', payment.order_id)
          .single();

        if (paymentTxn && paymentTxn.payment_status !== 'success') {
          // Update transaction status
          await supabase
            .from('payment_transactions')
            .update({
              razorpay_payment_id: payment.id,
              payment_status: 'success',
              payment_method: payment.method,
              completed_at: new Date().toISOString(),
              metadata: { ...paymentTxn.metadata, webhook_event: event },
            })
            .eq('id', paymentTxn.id);

          console.log('Payment transaction updated from webhook');
        }
        break;
      }

      case 'payment.failed': {
        const payment = event.payload.payment.entity;
        console.log('Payment failed:', payment.id);

        const { data: paymentTxn } = await supabase
          .from('payment_transactions')
          .select('*')
          .eq('razorpay_order_id', payment.order_id)
          .single();

        if (paymentTxn) {
          await supabase
            .from('payment_transactions')
            .update({
              razorpay_payment_id: payment.id,
              payment_status: 'failed',
              failure_reason: payment.error_description || 'Payment failed',
              metadata: { ...paymentTxn.metadata, webhook_event: event },
            })
            .eq('id', paymentTxn.id);

          console.log('Payment marked as failed from webhook');
        }
        break;
      }

      case 'order.paid': {
        const order = event.payload.order.entity;
        console.log('Order paid:', order.id);

        const { data: paymentTxn } = await supabase
          .from('payment_transactions')
          .select('*')
          .eq('razorpay_order_id', order.id)
          .single();

        if (paymentTxn && paymentTxn.payment_status !== 'success') {
          await supabase
            .from('payment_transactions')
            .update({
              payment_status: 'success',
              completed_at: new Date().toISOString(),
              metadata: { ...paymentTxn.metadata, webhook_event: event },
            })
            .eq('id', paymentTxn.id);

          console.log('Order marked as paid from webhook');
        }
        break;
      }

      default:
        console.log('Unhandled webhook event:', event.event);
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Webhook processed' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in razorpay-webhook:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
