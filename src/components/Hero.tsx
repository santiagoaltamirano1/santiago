import { Link } from 'react-router-dom';

export default function Hero() {
    return (
        <section className="min-h-screen bg-black text-white flex items-center">
            <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-2 items-center gap-12">

                {/* Texto */}
                <div className="space-y-6">
                    <h1 className="text-5xl md:text-7xl font-bold leading-tight">
                        Hidratación sin límites.
                    </h1>
                    <p className="text-xl text-gray-300 max-w-md leading-relaxed">
                        Diseñado para durar generaciones.
                        Listo para acompañarte en cada momento.
                    </p>

                    <div className="flex gap-4 pt-4">
                        <Link to="/shop"
                            className="bg-white text-black px-8 py-4 rounded-full font-bold hover:scale-105 transition-transform">
                            Explorar catálogo
                        </Link>

                        <Link to="/descubre-tu-stanley"
                            className="border border-white/30 px-8 py-4 rounded-full font-semibold hover:bg-white hover:text-black transition-all">
                            Descubre tu Stanley
                        </Link>
                    </div>
                </div>

                {/* Imagen */}
                <div className="flex justify-center relative">
                    {/* Subtle backglow for the hero image */}
                    <div className="absolute inset-0 bg-blue-500/10 blur-[120px] rounded-full" />
                    <img
                        src="/images/hero-main.webp"
                        alt="Stanley Quencher Splash"
                        className="w-full max-w-[600px] object-contain relative z-10"
                        loading="eager"
                    />
                </div>

            </div>
        </section>
    );
}
