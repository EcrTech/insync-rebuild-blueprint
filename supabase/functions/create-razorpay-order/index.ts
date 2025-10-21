import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OrderRequest {
  org_id: string;
  amount: number;
  type: 'subscription' | 'wallet_topup';
  invoice_id?: string;
  is_initial_payment?: boolean;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization')!;
    const { data: { user }, error: userError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));

    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const body: OrderRequest = await req.json();
    const { org_id, amount, type, invoice_id, is_initial_payment } = body;

    console.log('Creating Razorpay order:', { org_id, amount, type, invoice_id });

    // Get GST percentage from active pricing
    const { data: pricing } = await supabase
      .from('subscription_pricing')
      .select('gst_percentage')
      .eq('is_active', true)
      .single();

    if (!pricing) {
      throw new Error('No active pricing found');
    }

    // Calculate amount with GST
    const gstAmount = amount * (pricing.gst_percentage / 100);
    const totalAmount = Math.round((amount + gstAmount) * 100) / 100; // Round to 2 decimals
    const amountInPaise = Math.round(totalAmount * 100); // Razorpay expects paise

    // Create Razorpay order
    const RAZORPAY_KEY_ID = Deno.env.get('RAZORPAY_KEY_ID');
    const RAZORPAY_KEY_SECRET = Deno.env.get('RAZORPAY_KEY_SECRET');

    if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
      throw new Error('Razorpay credentials not configured');
    }

    const razorpayAuth = btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`);

    const razorpayResponse = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${razorpayAuth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: amountInPaise,
        currency: 'INR',
        receipt: `${type}_${org_id}_${Date.now()}`,
        notes: {
          org_id,
          type,
          invoice_id: invoice_id || '',
          is_initial_payment: is_initial_payment ? 'true' : 'false',
        },
      }),
    });

    if (!razorpayResponse.ok) {
      const errorData = await razorpayResponse.text();
      console.error('Razorpay order creation failed:', errorData);
      throw new Error('Failed to create Razorpay order');
    }

    const razorpayOrder = await razorpayResponse.json();

    console.log('Razorpay order created:', razorpayOrder.id);

    // Create payment transaction record
    const { data: paymentTxn, error: txnError } = await supabase
      .from('payment_transactions')
      .insert({
        org_id,
        invoice_id,
        transaction_type: type === 'subscription' ? 'subscription_payment' : 'wallet_topup',
        amount: totalAmount,
        razorpay_order_id: razorpayOrder.id,
        payment_status: 'initiated',
        initiated_by: user.id,
        metadata: {
          is_initial_payment,
          base_amount: amount,
          gst_amount: gstAmount,
        },
      })
      .select()
      .single();

    if (txnError) {
      console.error('Failed to create payment transaction:', txnError);
      throw txnError;
    }

    console.log('Payment transaction created:', paymentTxn.id);

    return new Response(
      JSON.stringify({
        order_id: razorpayOrder.id,
        amount: totalAmount,
        amount_in_paise: amountInPaise,
        currency: 'INR',
        payment_transaction_id: paymentTxn.id,
        key_id: RAZORPAY_KEY_ID,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in create-razorpay-order:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
