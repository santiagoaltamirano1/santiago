import { useEffect } from 'react';
import { useStore } from '../store/useStore';
import { Link } from 'react-router-dom';
import { ShoppingBag } from 'lucide-react';
import { getProductImage } from '../data/products';
import ImageSafe from '../components/ImageSafe';

export default function Collections() {
    const { products, isLoading, fetchProducts, addToCart } = useStore();

    useEffect(() => {
        fetchProducts();
    }, [fetchProducts]);

    if (isLoading) {
        return (
            <div className="w-full min-h-screen pt-32 flex items-center justify-center">
                <div className="w-8 h-8 rounded-full border-2 border-moss border-t-transparent animate-spin" />
            </div>
        );
    }

    return (
        <div className="w-full min-h-screen pt-32 pb-32 px-4 md:px-16 bg-cream border-t border-charcoal/5">
            <div className="max-w-7xl mx-auto">

                <div className="mb-16">
                    <h1 className="text-4xl md:text-5xl font-outfit uppercase tracking-tight text-charcoal mb-4">La Colección Completa</h1>
                    <p className="font-sans text-lg text-charcoal/60 max-w-2xl">Descubre todas nuestras botellas, termos y equipamiento construidos para toda la vida.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {products.map((product) => (
                        <div key={product.id} className="relative group p-4 border border-charcoal/10 rounded-2xl bg-white hover:shadow-xl transition-shadow flex flex-col h-full">

                            <Link to={`/ producto / ${product.slug} `} className="block relative h-48 w-full bg-cream/30 rounded-xl mb-4 p-4 overflow-hidden">
                                <ImageSafe
                                    src={getProductImage(product.slug)}
                                    alt={product.name}
                                    className="w-full h-full mix-blend-multiply drop-shadow-md group-hover:scale-105 transition-transform duration-500"
                                />
                                {product.featured && (
                                    <div className="absolute top-4 left-4 bg-clay text-cream text-[10px] font-bold px-3 py-1 tracking-widest rounded-full uppercase font-sans z-10">
                                        Destacado
                                    </div>
                                )}
                            </Link>

                            <div className="flex-1 flex flex-col">
                                <div className="flex justify-between items-start mb-2 gap-2">
                                    <h3 className="font-outfit font-medium text-lg leading-tight line-clamp-2">
                                        <Link to={`/ producto / ${product.slug} `} className="hover:text-moss transition-colors">
                                            {product.name}
                                        </Link>
                                    </h3>
                                    <span className="font-metrics text-clay whitespace-nowrap">
                                        ${product.variants[0]?.price_cop.toLocaleString('es-CO')}
                                    </span>
                                </div>
                                <div className="font-sans text-xs text-charcoal/50 mb-3 uppercase tracking-wider">{product.category}</div>
                                <p className="text-xs text-charcoal/60 mb-4 line-clamp-2">{product.description}</p>

                                <div className="mt-auto flex items-center justify-between">
                                    <div className="text-xs font-sans text-charcoal/60 font-medium">
                                        {product.colors_available}
                                    </div>
                                    <button
                                        onClick={() => addToCart(product, product.variants[0], 1)}
                                        className="w-10 h-10 rounded-full bg-moss/10 text-moss flex items-center justify-center hover:bg-moss hover:text-white transition-colors"
                                        aria-label="Añadir al carrito"
                                    >
                                        <ShoppingBag className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
