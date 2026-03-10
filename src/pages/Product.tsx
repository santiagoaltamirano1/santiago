import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { getProductImage } from '../data/products';
import { ArrowLeft } from 'lucide-react';
import ImageSafe from '../components/ImageSafe';

export default function Product() {
    const { slug } = useParams<{ slug: string }>();
    const navigate = useNavigate();
    const { products, fetchProducts, isLoading, addToCart } = useStore();
    const [selectedVariant, setSelectedVariant] = useState<{ size: string, price_cop: number } | null>(null);

    useEffect(() => {
        if (products.length === 0) {
            fetchProducts();
        }
    }, [products, fetchProducts]);

    const product = products.find(p => p.slug === slug);

    // Set default variant
    useEffect(() => {
        if (product && !selectedVariant && product.variants.length > 0) {
            setSelectedVariant(product.variants[0]);
        }
    }, [product, selectedVariant]);

    if (isLoading || !product) {
        return (
            <div className="w-full min-h-[80vh] flex items-center justify-center">
                {isLoading ? <div className="w-8 h-8 rounded-full border-2 border-moss border-t-transparent animate-spin" /> : <p>Producto no encontrado.</p>}
            </div>
        );
    }

    const handleAddToCart = () => {
        if (selectedVariant) {
            addToCart(product, selectedVariant, 1);
        }
    };

    return (
        <div className="w-full min-h-screen pt-24 pb-24 px-8 md:px-16 bg-[#F2F0E9]">
            <div className="max-w-7xl mx-auto">

                <button onClick={() => navigate(-1)} className="flex items-center gap-2 font-sans font-medium text-charcoal/60 hover:text-charcoal transition-colors mb-12">
                    <ArrowLeft size={18} /> Volver
                </button>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">

                    {/* Product Image */}
                    <div className="bg-white rounded-[3rem] p-8 md:p-12 min-h-[400px] md:min-h-[600px] flex items-center justify-center border border-charcoal/5 shadow-sm overflow-hidden">
                        <ImageSafe
                            src={getProductImage(product.slug)}
                            alt={product.name}
                            className="w-full h-[300px] md:h-[500px] drop-shadow-2xl mix-blend-multiply"
                        />
                    </div>

                    {/* Product Info */}
                    <div className="flex flex-col justify-center">

                        <span className="font-metrics text-clay text-sm mb-4 uppercase tracking-wider">{product.category}</span>
                        <h1 className="text-4xl md:text-5xl lg:text-6xl font-outfit uppercase tracking-tight text-charcoal mb-4">{product.name}</h1>
                        <div className="font-metrics text-3xl text-charcoal/90 mb-8 border-b border-charcoal/10 pb-8">
                            ${(selectedVariant?.price_cop || product.variants[0].price_cop).toLocaleString('es-CO')} COP
                        </div>

                        <p className="font-sans text-lg text-charcoal/70 mb-12 leading-relaxed">
                            {product.description}
                        </p>

                        {/* Variant Selector */}
                        <div className="mb-6">
                            <span className="font-sans text-sm font-bold tracking-wider text-charcoal mb-4 block uppercase">
                                Tamaño: <span className="text-charcoal/50 ml-2 capitalize">{selectedVariant?.size}</span>
                            </span>
                            <div className="flex flex-wrap gap-4">
                                {product.variants.map((v) => (
                                    <button
                                        key={v.size}
                                        onClick={() => setSelectedVariant(v)}
                                        className={`px-4 py-2 rounded-full border-2 transition-all font-sans text-sm ${selectedVariant?.size === v.size ? 'border-clay shadow-sm bg-clay/5' : 'border-charcoal/20 hover:border-charcoal/50 text-charcoal/80'}`}
                                    >
                                        {v.size}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Colors text representation */}
                        <div className="mb-12 font-sans text-charcoal/60 text-sm">
                            <span className="font-bold text-charcoal">Colores:</span> {product.colors_available}
                        </div>

                        <button
                            onClick={handleAddToCart}
                            data-title={product.name}
                            data-price={selectedVariant?.price_cop || product.variants[0].price_cop}
                            className="w-full lg:w-3/4 py-5 rounded-full bg-moss text-cream font-sans text-lg font-semibold tracking-wide hover:bg-opacity-90 transition-opacity flex justify-center items-center shadow-lg"
                        >
                            Comprar Ahora
                        </button>
                        <p className="font-sans text-xs text-charcoal/40 text-center lg:text-left mt-4 pl-4">Pago seguro. Envío estándar gratuito.</p>
                    </div>

                </div>
            </div>
        </div>
    );
}
