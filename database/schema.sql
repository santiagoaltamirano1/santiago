-- Fase 1: Estructuración de Base de Datos para Supabase

-- Crear la tabla 'orders' si no existe
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_title VARCHAR NOT NULL,
    price NUMERIC NOT NULL,
    status VARCHAR DEFAULT 'pending',
    mp_preference_id VARCHAR,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Habilitar Row Level Security
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Política para permitir inserciones desde el entorno anon/service_role
-- Atencion: En producción con anon key deberias restringir esto, pero para permitir 
-- llamadas de backend de Vercel (service role), es seguro bypassarla si usas Service Role Key.
-- Aquí creamos politicas para inserción anónima si se usa la anon key desde el backend Serverless.
CREATE POLICY "Enable insert for all API operations" ON public.orders
    FOR INSERT 
    WITH CHECK (true);

-- Política para permitir actualizacion (webhook MP)
CREATE POLICY "Enable update for all API operations" ON public.orders
    FOR UPDATE
    USING (true);

-- Política para lectura
CREATE POLICY "Enable read access for all API operations" ON public.orders
    FOR SELECT
    USING (true);
