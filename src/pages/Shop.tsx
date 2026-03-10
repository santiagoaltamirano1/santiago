import { useEffect } from 'react';
import { useStore } from '../store/useStore';
import { Link } from 'react-router-dom';
import { getProductImage } from '../data/products';
import ImageSafe from '../components/ImageSafe';

export default function Shop() {
    const { products, isLoading, fetchProducts, addToCart } = useStore();

    useEffect(() => {
        fetchProducts();
    }, [fetchProducts]);

    if (isLoading) {
        return (
            <div className="w-full min-h-[400px] flex items-center justify-center">
                <div className="w-8 h-8 rounded-full border-2 border-moss border-t-transparent animate-spin" />
            </div>
        );
    }

    // Grab top 3 products
    const top3 = products.slice(0, 3);
    if (top3.length < 3) return null;

    // Podium Order: [Second, Center (Bestseller), Third]
    const podiumOrder = [top3[1], top3[0], top3[2]];

    return (
        <section className="bg-[#F4F1EA] py-24 px-6 overflow-hidden">
            <div className="max-w-6xl mx-auto text-center">

                <span className="font-metrics tracking-widest text-clay uppercase text-sm mb-2 block">Selección Premium</span>
                <h2 className="text-4xl md:text-5xl font-bold font-outfit uppercase mb-16 text-charcoal">
                    Los Más Elegidos
                </h2>

                <div className="flex flex-col md:flex-row justify-center items-end gap-10 min-h-[500px]">

                    {podiumOrder.map((product, idx) => {
                        const isCenter = idx === 1;
                        const isLeft = idx === 0;
                        const isRight = idx === 2;

                        let styleClasses = "";

                        // Podium sizing and visual hierarchy
                        if (isCenter) {
                            styleClasses = "scale-105 z-20 shadow-xl relative md:-translate-y-8";
                        } else if (isLeft) {
                            styleClasses = "scale-95 opacity-90 hover:opacity-100 z-10 hidden md:flex";
                        } else if (isRight) {
                            styleClasses = "scale-95 opacity-90 hover:opacity-100 z-10 hidden md:flex";
                        }

                        return (
                            <div
                                key={product.id}
                                className={`flex flex-col bg-white rounded-3xl overflow-hidden transition-all duration-300 md:w-1/3 hover:shadow-2xl hover:scale-[1.07] ${styleClasses}`}
                            >
                                {isCenter && (
                                    <span className="absolute top-4 left-4 bg-yellow-500 text-white px-4 py-1 rounded-full text-sm font-semibold z-30 shadow-sm">
                                        Más Vendido
                                    </span>
                                )}

                                <Link to={`/producto/${product.slug}`} className="w-full h-64 md:h-80 bg-cream/30 p-8 flex items-center justify-center relative group">
                                    <ImageSafe
                                        src={getProductImage(product.slug)}
                                        alt={product.name}
                                        className="h-full w-full object-contain mix-blend-multiply transition-transform duration-300 group-hover:scale-105"
                                        loading="lazy"
                                    />
                                    <div className="absolute bottom-4 w-1/2 h-2 bg-charcoal/5 blur-[8px] rounded-[100%]" />
                                </Link>

                                <div className="p-8 flex flex-col flex-1 text-left bg-white">
                                    <div className="mb-6">
                                        <h3 className="font-outfit text-xl font-semibold text-charcoal line-clamp-1">{product.name}</h3>
                                        <span className="font-metrics text-clay font-medium text-lg">${product.variants[0]?.price_cop.toLocaleString('es-CO')}</span>
                                    </div>

                                    <button
                                        onClick={() => addToCart(product, product.variants[0], 1)}
                                        data-title={product.name}
                                        data-price={product.variants[0]?.price_cop}
                                        className={`w-full py-4 rounded-full font-semibold transition-colors mt-auto ${isCenter
                                            ? 'bg-moss text-cream hover:bg-moss/90'
                                            : 'bg-charcoal/5 text-charcoal hover:bg-charcoal/10'}`}
                                    >
                                        Comprar Ahora
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="mt-20">
                    <Link
                        to="/personalizacion"
                        className="inline-flex items-center gap-2 font-semibold text-charcoal hover:text-clay transition-colors"
                    >
                        Ver catálogo completo <span className="text-xl">→</span>
                    </Link>
                </div>
            </div>
        </section>
    );
}

