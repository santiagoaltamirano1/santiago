-- Fase 1: Estructuración de Base de Datos para Supabase

-- Crear la tabla 'orders' si no existe
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_title VARCHAR NOT NULL,
    price NUMERIC NOT NULL,
    status VARCHAR DEFAULT 'pending',
    mp_preference_id VARCHAR,
    -- Campos enriquecidos del cliente (agregados en v2)
    customer_name VARCHAR,
    customer_email VARCHAR,
    shipping_address VARCHAR,
    customer_phone VARCHAR,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Habilitar Row Level Security
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable insert for all API operations" ON public.orders
    FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Enable update for all API operations" ON public.orders
    FOR UPDATE
    USING (true);

CREATE POLICY "Enable read access for all API operations" ON public.orders
    FOR SELECT
    USING (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- MIGRACION v2: Columnas nuevas en tabla existente (ejecutar si la tabla ya existe)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS customer_name VARCHAR,
    ADD COLUMN IF NOT EXISTS customer_email VARCHAR,
    ADD COLUMN IF NOT EXISTS shipping_address VARCHAR,
    ADD COLUMN IF NOT EXISTS customer_phone VARCHAR;

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLA quiz_leads: Captura automática de leads del Quiz "Descubre tu Stanley"
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.quiz_leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recommended_product VARCHAR NOT NULL,
    answers JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.quiz_leads ENABLE ROW LEVEL SECURITY;

-- Permite que el frontend (anon key) inserte leads sin autenticación
CREATE POLICY "Enable insert for quiz leads" ON public.quiz_leads
    FOR INSERT
    WITH CHECK (true);

-- Lectura restringida al service role (solo backend/admin puede leer leads)
CREATE POLICY "Enable read for service role only" ON public.quiz_leads
    FOR SELECT
    USING (false);
