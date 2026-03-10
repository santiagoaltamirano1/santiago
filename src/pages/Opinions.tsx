import { useEffect, useState } from 'react';
import { Star, ChevronLeft, ChevronRight } from 'lucide-react';
import { useStore } from '../store/useStore';
import { getProductImage } from '../data/products';
import ImageSafe from '../components/ImageSafe';

export default function Opinions() {
    const { products, fetchProducts, isLoading } = useStore();
    const [activeIndex, setActiveIndex] = useState(0);

    useEffect(() => {
        fetchProducts();
    }, [fetchProducts]);

    if (isLoading) {
        return (
            <div className="w-full min-h-[400px] flex items-center justify-center bg-[#000]">
                <div className="w-8 h-8 rounded-full border-2 border-clay border-t-transparent animate-spin" />
            </div>
        );
    }

    const reviews = products.slice(0, 5).map((p, index) => ({
        id: p.id,
        product: p,
        author: ["Laura M.", "Carlos T.", "David O.", "Emma W.", "Michael B."][index],
        comment: [
            "Mantiene el agua fría todo el día en el gym. Mi compañero inseparable.",
            "Estética intachable y rendimiento brutal. Literalmente no salgo de casa sin mi Stanley. Vale cada centavo invertido.",
            "El color es espectacular y el material se siente indestructible. Lo he llevado de campamento 3 veces y está como nuevo.",
            "Lo compré por la fama y me convenció por la utilidad. La capacidad térmica es de otro planeta.",
            "Sobrio, elegante, premium. Para los que buscan lo mejor en hidratación y no se conforman."
        ][index],
        rating: 5,
        date: ["Hace 2 días", "Hace 1 semana", "Hace 3 semanas", "Hace 1 mes", "Hace 2 meses"][index]
    }));

    const nextReview = () => setActiveIndex((prev) => (prev + 1) % reviews.length);
    const prevReview = () => setActiveIndex((prev) => (prev === 0 ? reviews.length - 1 : prev - 1));

    const review = reviews[activeIndex];

    return (
        <section className="w-full bg-[#000] text-white py-24 px-6">
            <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-16 items-center">

                <div className="space-y-6">
                    <span className="font-metrics tracking-widest text-clay uppercase text-sm block">Comunidad Stanley</span>
                    <h2 className="text-5xl md:text-7xl font-outfit uppercase tracking-tight leading-[0.9]">
                        Confiado por<br />Generaciones
                    </h2>
                    <p className="text-lg text-gray-400 max-w-md">
                        Historias reales de durabilidad extrema. Cada reseña respalda nuestro legado de resistencia.
                    </p>

                    <div className="flex items-center gap-4 pt-6">
                        <button
                            onClick={prevReview}
                            className="w-12 h-12 rounded-full border border-white/20 flex items-center justify-center hover:bg-white/10 transition-colors"
                        >
                            <ChevronLeft size={24} />
                        </button>
                        <button
                            onClick={nextReview}
                            className="w-12 h-12 rounded-full border border-white/20 flex items-center justify-center hover:bg-white/10 transition-colors"
                        >
                            <ChevronRight size={24} />
                        </button>
                    </div>
                </div>

                {/* Review Card with Product Context */}
                <div key={activeIndex} className="bg-white text-charcoal p-8 rounded-3xl shadow-xl flex flex-col md:flex-row gap-6 items-start md:items-center relative overflow-hidden animate-fade-in">

                    <div className="w-24 h-24 md:w-32 md:h-32 shrink-0 bg-[#F4F1EA] rounded-2xl p-2 flex border border-charcoal/5 items-center justify-center">
                        <ImageSafe
                            src={getProductImage(review.product.slug)}
                            alt={review.product.name}
                            className="w-full h-full object-contain mix-blend-multiply drop-shadow-sm"
                            loading="lazy"
                        />
                    </div>

                    <div className="flex-1 space-y-4">
                        <div>
                            <h4 className="font-outfit text-xl font-bold line-clamp-1">{review.product.name}</h4>
                            <div className="flex text-yellow-500 mt-1">
                                {[...Array(review.rating)].map((_, i) => (
                                    <Star key={i} size={16} fill="currentColor" />
                                ))}
                            </div>
                        </div>

                        <p className="text-charcoal/70 font-sans leading-relaxed min-h-[80px]">
                            “{review.comment}”
                        </p>

                        <div className="pt-2 border-t border-charcoal/10 flex justify-between items-center">
                            <span className="font-semibold text-sm">
                                — {review.author}
                            </span>
                            <span className="text-xs text-charcoal/40">
                                {review.date}
                            </span>
                        </div>
                    </div>

                </div>

            </div>
        </section>
    );
}
