import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createHmac } from 'https://deno.land/std@0.177.0/node/crypto.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface VerifyRequest {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
  payment_transaction_id: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const body: VerifyRequest = await req.json();
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, payment_transaction_id } = body;

    console.log('Verifying payment:', { razorpay_order_id, razorpay_payment_id });

    // Get payment transaction
    const { data: paymentTxn, error: txnError } = await supabase
      .from('payment_transactions')
      .select('*')
      .eq('id', payment_transaction_id)
      .single();

    if (txnError || !paymentTxn) {
      throw new Error('Payment transaction not found');
    }

    // Verify signature
    const RAZORPAY_KEY_SECRET = Deno.env.get('RAZORPAY_KEY_SECRET');
    if (!RAZORPAY_KEY_SECRET) {
      throw new Error('Razorpay secret not configured');
    }

    const text = `${razorpay_order_id}|${razorpay_payment_id}`;
    const hmac = createHmac('sha256', RAZORPAY_KEY_SECRET);
    hmac.update(text);
    const expectedSignature = hmac.digest('hex');

    if (expectedSignature !== razorpay_signature) {
      console.error('Signature verification failed');
      
      // Update payment transaction as failed
      await supabase
        .from('payment_transactions')
        .update({
          payment_status: 'failed',
          failure_reason: 'Invalid signature',
          updated_at: new Date().toISOString(),
        })
        .eq('id', payment_transaction_id);

      throw new Error('Invalid payment signature');
    }

    console.log('Signature verified successfully');

    // Fetch payment details from Razorpay
    const RAZORPAY_KEY_ID = Deno.env.get('RAZORPAY_KEY_ID');
    const razorpayAuth = btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`);

    const paymentDetailsResponse = await fetch(
      `https://api.razorpay.com/v1/payments/${razorpay_payment_id}`,
      {
        headers: {
          'Authorization': `Basic ${razorpayAuth}`,
        },
      }
    );

    const paymentDetails = await paymentDetailsResponse.json();

    // Update payment transaction
    await supabase
      .from('payment_transactions')
      .update({
        razorpay_payment_id,
        razorpay_signature,
        payment_status: 'success',
        payment_method: paymentDetails.method,
        completed_at: new Date().toISOString(),
        metadata: { ...paymentTxn.metadata, payment_details: paymentDetails },
        updated_at: new Date().toISOString(),
      })
      .eq('id', payment_transaction_id);

    console.log('Payment transaction updated to success');

    // Process based on transaction type
    if (paymentTxn.transaction_type === 'subscription_payment') {
      // Handle subscription payment
      if (paymentTxn.invoice_id) {
        // Update invoice
        await supabase
          .from('subscription_invoices')
          .update({
            paid_amount: paymentTxn.amount,
            payment_status: 'paid',
            paid_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', paymentTxn.invoice_id);

        console.log('Invoice updated to paid');
      }

      // Update subscription
      const nextBillingDate = new Date();
      nextBillingDate.setDate(nextBillingDate.getDate() + 30);

      await supabase
        .from('organization_subscriptions')
        .update({
          subscription_status: 'active',
          last_payment_date: new Date().toISOString(),
          next_billing_date: nextBillingDate.toISOString().split('T')[0],
          suspension_date: null,
          suspension_reason: null,
          updated_at: new Date().toISOString(),
        })
        .eq('org_id', paymentTxn.org_id);

      // Enable services
      await supabase
        .from('organizations')
        .update({ services_enabled: true })
        .eq('id', paymentTxn.org_id);

      console.log('Subscription restored to active');

      // If initial payment, add wallet balance
      if (paymentTxn.metadata?.is_initial_payment) {
        const { data: pricing } = await supabase
          .from('subscription_pricing')
          .select('min_wallet_balance')
          .eq('is_active', true)
          .single();

        if (pricing) {
          const { data: sub } = await supabase
            .from('organization_subscriptions')
            .select('wallet_balance')
            .eq('org_id', paymentTxn.org_id)
            .single();

          await supabase
            .from('organization_subscriptions')
            .update({
              wallet_balance: (sub?.wallet_balance || 0) + pricing.min_wallet_balance,
              wallet_last_topup_date: new Date().toISOString(),
            })
            .eq('org_id', paymentTxn.org_id);

          // Create wallet transaction
          await supabase
            .from('wallet_transactions')
            .insert({
              org_id: paymentTxn.org_id,
              transaction_type: 'topup',
              amount: pricing.min_wallet_balance,
              balance_before: sub?.wallet_balance || 0,
              balance_after: (sub?.wallet_balance || 0) + pricing.min_wallet_balance,
              payment_transaction_id: payment_transaction_id,
              description: 'Initial wallet top-up',
            });

          console.log('Initial wallet balance added');
        }
      }

      // Send services restored email
      await supabase.functions.invoke('send-subscription-email', {
        body: {
          org_id: paymentTxn.org_id,
          template_type: 'services_restored',
          data: { invoice_id: paymentTxn.invoice_id },
        },
      });
    } else {
      // Handle wallet top-up
      const { data: sub } = await supabase
        .from('organization_subscriptions')
        .select('wallet_balance')
        .eq('org_id', paymentTxn.org_id)
        .single();

      const newBalance = (sub?.wallet_balance || 0) + paymentTxn.amount;

      await supabase
        .from('organization_subscriptions')
        .update({
          wallet_balance: newBalance,
          wallet_last_topup_date: new Date().toISOString(),
        })
        .eq('org_id', paymentTxn.org_id);

      // Create wallet transaction
      await supabase
        .from('wallet_transactions')
        .insert({
          org_id: paymentTxn.org_id,
          transaction_type: paymentTxn.transaction_type === 'wallet_auto_topup' ? 'auto_topup' : 'topup',
          amount: paymentTxn.amount,
          balance_before: sub?.wallet_balance || 0,
          balance_after: newBalance,
          payment_transaction_id: payment_transaction_id,
          description: 'Wallet top-up',
        });

      console.log('Wallet topped up:', newBalance);
    }

    // Send payment successful email
    await supabase.functions.invoke('send-subscription-email', {
      body: {
        org_id: paymentTxn.org_id,
        template_type: 'payment_successful',
        data: {
          amount: paymentTxn.amount,
          payment_id: razorpay_payment_id,
        },
      },
    });

    return new Response(
      JSON.stringify({ success: true, message: 'Payment verified successfully' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in verify-razorpay-payment:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
