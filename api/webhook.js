import { createClient } from '@supabase/supabase-js';
import { MercadoPagoConfig, Payment } from 'mercadopago';

// Fase 2: Backend Serverless - Webhook (Método POST)

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { topic, type } = req.query;

        // Verificar si es notificacion por MP
        const isPayment = topic === 'payment' || type === 'payment';

        // Extraemos el id de PAGO
        const paymentId = req.query['data.id'] || req.query.id;

        if (!isPayment || !paymentId) {
            console.log('Not a payment event, or missing payment ID');
            // Regla de Oro MP: siempre responder 200 para evitar reintentos innecesarios
            return res.status(200).send('OK');
        }

        const mpAccessToken = process.env.MP_ACCESS_TOKEN;
        const client = new MercadoPagoConfig({ accessToken: mpAccessToken });
        const paymentClient = new Payment(client);

        // Consultar API MP para estado real
        const paymentData = await paymentClient.get({ id: paymentId });

        if (paymentData && paymentData.status === 'approved') {
            const orderId = paymentData.external_reference;

            if (!orderId) {
                console.error('Payment approved but no external_reference (orderId) available');
                return res.status(200).send('OK');
            }

            // Inicializar Supabase y actualizar orden de pending → paid
            const supabaseUrl = process.env.SUPABASE_URL;
            const supabaseKey = process.env.SUPABASE_ANON_KEY;
            const supabase = createClient(supabaseUrl, supabaseKey);

            const { error } = await supabase
                .from('orders')
                .update({ status: 'paid' })
                .eq('id', orderId);

            if (error) {
                console.error('Error updating order to paid in Supabase:', error);
            } else {
                console.log(`Order ${orderId} successfully marked as paid.`);
            }
        }

        // Responder DESPUÉS de procesar (correcto para Vercel serverless)
        return res.status(200).send('OK');

    } catch (error) {
        console.error('Webhook error:', error);
        // MP requiere 200 siempre para no reintentar indefinidamente
        return res.status(200).send('OK');
    }
}
