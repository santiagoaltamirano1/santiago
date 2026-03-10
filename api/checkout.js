import { createClient } from '@supabase/supabase-js';
import { MercadoPagoConfig, Preference } from 'mercadopago';

// Fase 2: Backend Serverless - Checkout (Método POST)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { title, price } = req.body;

    if (!title || !price) {
      return res.status(400).json({ error: 'Missing title or price' });
    }

    // Inicializar Supabase
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase credentials missing in env');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Paso Crítico 1: Insertar nuevo registro en 'orders' con status 'pending'
    const { data: orderData, error: insertError } = await supabase
      .from('orders')
      .insert([{ product_title: title, price: Number(price), status: 'pending' }])
      .select('id')
      .single();

    if (insertError || !orderData) {
      console.error('Error inserting order in Supabase:', insertError);
      throw new Error('Database error');
    }

    const orderId = orderData.id;

    // Inicializar Mercado Pago
    const mpAccessToken = process.env.MP_ACCESS_TOKEN;
    if (!mpAccessToken) {
      throw new Error('Mercado Pago credentials missing in env');
    }

    const client = new MercadoPagoConfig({ accessToken: mpAccessToken });
    const preference = new Preference(client);

    const host = req.headers.origin || `https://${req.headers.host}`;

    // Paso Crítico 2: Crear preferencia en MP
    const prefResult = await preference.create({
      body: {
        items: [
          {
            id: orderId,
            title: title,
            quantity: 1,
            unit_price: Number(price),
          }
        ],
        external_reference: orderId,
        notification_url: `${host}/api/webhook`,
        back_urls: {
          success: `${host}/success`,
          failure: `${host}/failure`,
          pending: `${host}/pending`
        },
        auto_return: 'approved'
      }
    });

    // Actualizar registro con el preference_id
    await supabase
      .from('orders')
      .update({ mp_preference_id: prefResult.id })
      .eq('id', orderId);

    // Responder al frontend HTTP 200 con { init_point: URL }
    res.status(200).json({ init_point: prefResult.init_point });

  } catch (error) {
    console.error('Checkout error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}
