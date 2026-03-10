import { useEffect, useState, useMemo } from 'react';
import { useStore } from '../store/useStore';
import type { Product } from '../data/products';
import { getProductImage } from '../data/products';
import ImageSafe from '../components/ImageSafe';
import { Link } from 'react-router-dom';
import { X, SlidersHorizontal } from 'lucide-react';

// --- Filter Configuration ---
const USAGE_TAGS = [
    { id: 'gym', label: 'Gym', emoji: '🏋' },
    { id: 'oficina', label: 'Oficina', emoji: '🏢' },
    { id: 'outdoor', label: 'Outdoor', emoji: '🏔' },
    { id: 'regalo', label: 'Regalo', emoji: '🎁' },
    { id: 'comida', label: 'Comida', emoji: '🥗' },
    { id: 'viaje', label: 'Viaje', emoji: '✈' },
];

const CATEGORIES = [
    { id: 'todos', label: 'Todos' },
    { id: 'hidratacion', label: 'Hidratación' },
    { id: 'bar', label: 'Bar' },
    { id: 'comida', label: 'Comida' },
];

const PRODUCT_TYPES = [
    'Botella térmica',
    'Tumbler térmico',
    'Tumbler deportivo',
    'Licorera',
    'Termo para comida',
];

interface Filters {
    category: string;
    types: string[];
    sizes: string[];
    usageTags: string[];
    color: string | null;
}

const defaultFilters: Filters = {
    category: 'todos',
    types: [],
    sizes: [],
    usageTags: [],
    color: null,
};

const MAIN_COLORS = [
    { id: 'negro', label: 'Negro', hex: '#1A1A1A' },
    { id: 'verde', label: 'Verde', hex: '#1D3D2F' },
    { id: 'azul', label: 'Azul', hex: '#1A5276' },
    { id: 'blanco', label: 'Blanco', hex: '#F2EFE4' },
    { id: 'acero', label: 'Acero', hex: '#AAA9A9' },
    { id: 'beige', label: 'Beige', hex: '#E8E2D5' },
];

function toggle<T>(arr: T[], item: T): T[] {
    return arr.includes(item) ? arr.filter(x => x !== item) : [...arr, item];
}

export default function Customization() {
    const { fetchProducts, addToCart, isLoading } = useStore();
    const [allProducts, setAllProducts] = useState<Product[]>([]);
    const [filters, setFilters] = useState<Filters>(defaultFilters);
    const [sidebarOpen, setSidebarOpen] = useState(false);

    useEffect(() => { fetchProducts(); }, [fetchProducts]);

    // Grab products from store after fetch
    const { products } = useStore();
    useEffect(() => {
        if (!isLoading && products.length > 0) setAllProducts(products);
    }, [isLoading, products]);

    // Collect all unique sizes dynamically
    const allSizes = useMemo(() => {
        const sizeSet = new Set<string>();
        allProducts.forEach(p => p.variants.forEach(v => sizeSet.add(v.size)));
        return Array.from(sizeSet).sort();
    }, [allProducts]);

    // Filtered results
    const filtered = useMemo(() => {
        return allProducts.filter(p => {
            if (filters.category !== 'todos' && p.category !== filters.category) return false;
            if (filters.types.length > 0 && !filters.types.includes(p.type)) return false;
            if (filters.sizes.length > 0) {
                const productSizes = p.variants.map(v => v.size);
                if (!filters.sizes.some(s => productSizes.includes(s))) return false;
            }
            if (filters.usageTags.length > 0) {
                if (!filters.usageTags.some(t => p.usageTags.includes(t))) return false;
            }
            if (filters.color) {
                if (p.mainColor !== filters.color) return false;
            }
            return true;
        });
    }, [allProducts, filters]);

    const hasActiveFilters = filters.category !== 'todos'
        || filters.types.length > 0
        || filters.sizes.length > 0
        || filters.usageTags.length > 0
        || filters.color !== null;

    if (isLoading) {
        return (
            <div className="w-full min-h-screen pt-32 flex items-center justify-center">
                <div className="w-8 h-8 rounded-full border-2 border-moss border-t-transparent animate-spin" />
            </div>
        );
    }

    // Sidebar content (reused on mobile and desktop)
    const FilterSidebar = () => (
        <div className="space-y-8">
            {/* Clear */}
            {hasActiveFilters && (
                <button
                    onClick={() => setFilters(defaultFilters)}
                    className="flex items-center gap-2 text-clay font-sans text-sm font-semibold hover:underline"
                >
                    <X className="w-3.5 h-3.5" /> Limpiar filtros
                </button>
            )}

            {/* Category */}
            <div>
                <h3 className="font-sans text-xs font-bold tracking-widest text-charcoal/50 uppercase mb-3">Categoría</h3>
                <div className="flex flex-wrap gap-2">
                    {CATEGORIES.map(c => (
                        <button
                            key={c.id}
                            onClick={() => setFilters(f => ({ ...f, category: c.id }))}
                            className={`px-3 py-1.5 rounded-full text-sm font-sans transition-all border ${filters.category === c.id
                                ? 'bg-moss text-cream border-moss'
                                : 'bg-white border-charcoal/15 text-charcoal/70 hover:border-moss/50'
                                }`}
                        >
                            {c.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Type */}
            <div>
                <h3 className="font-sans text-xs font-bold tracking-widest text-charcoal/50 uppercase mb-3">Tipo de Producto</h3>
                <div className="flex flex-wrap gap-2">
                    {PRODUCT_TYPES.map(t => (
                        <button
                            key={t}
                            onClick={() => setFilters(f => ({ ...f, types: toggle(f.types, t) }))}
                            className={`px-3 py-1.5 rounded-full text-sm font-sans transition-all border ${filters.types.includes(t)
                                ? 'bg-clay text-cream border-clay'
                                : 'bg-white border-charcoal/15 text-charcoal/70 hover:border-clay/50'
                                }`}
                        >
                            {t}
                        </button>
                    ))}
                </div>
            </div>

            {/* Size */}
            <div>
                <h3 className="font-sans text-xs font-bold tracking-widest text-charcoal/50 uppercase mb-3">Tamaño</h3>
                <div className="flex flex-wrap gap-2">
                    {allSizes.map(s => (
                        <button
                            key={s}
                            onClick={() => setFilters(f => ({ ...f, sizes: toggle(f.sizes, s) }))}
                            className={`px-3 py-1.5 rounded-full text-sm font-sans transition-all border ${filters.sizes.includes(s)
                                ? 'bg-charcoal text-cream border-charcoal'
                                : 'bg-white border-charcoal/15 text-charcoal/70 hover:border-charcoal/40'
                                }`}
                        >
                            {s}
                        </button>
                    ))}
                </div>
            </div>

            {/* Usage Tags */}
            <div>
                <h3 className="font-sans text-xs font-bold tracking-widest text-charcoal/50 uppercase mb-3">Tipo de Uso</h3>
                <div className="flex flex-wrap gap-2">
                    {USAGE_TAGS.map(tag => (
                        <button
                            key={tag.id}
                            onClick={() => setFilters(f => ({ ...f, usageTags: toggle(f.usageTags, tag.id) }))}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-sans transition-all border ${filters.usageTags.includes(tag.id)
                                ? 'bg-moss/90 text-cream border-moss'
                                : 'bg-white border-charcoal/15 text-charcoal/70 hover:border-moss/40'
                                }`}
                        >
                            <span>{tag.emoji}</span> {tag.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Colors */}
            <div>
                <h3 className="font-sans text-xs font-bold tracking-widest text-charcoal/50 uppercase mb-3">Color</h3>
                <div className="flex flex-wrap gap-3">
                    {MAIN_COLORS.map(c => (
                        <button
                            key={c.id}
                            onClick={() => setFilters(f => ({ ...f, color: f.color === c.id ? null : c.id }))}
                            title={c.label}
                            className={`w-7 h-7 rounded-full border-2 transition-transform hover:scale-110 ${filters.color === c.id
                                ? 'border-charcoal scale-110 shadow-md'
                                : 'border-white/80 shadow-sm'
                                }`}
                            style={{ backgroundColor: c.hex }}
                        />
                    ))}
                </div>
            </div>
        </div>
    );

    return (
        <div className="w-full min-h-screen pt-28 pb-24 bg-[#F2F0E9]">
            <div className="max-w-7xl mx-auto px-4 md:px-12">

                {/* Header */}
                <div className="flex items-end justify-between mb-10 border-b border-charcoal/10 pb-6">
                    <div>
                        <span className="font-sans text-xs tracking-widest text-clay uppercase">Encuentra el tuyo</span>
                        <h1 className="text-4xl font-outfit uppercase tracking-tight text-charcoal mt-1">Personalización</h1>
                    </div>
                    <div className="flex items-center gap-4">
                        <span className="font-sans text-sm text-charcoal/50">
                            {filtered.length} {filtered.length === 1 ? 'producto' : 'productos'}
                        </span>
                        {/* Mobile filter toggle */}
                        <button
                            onClick={() => setSidebarOpen(true)}
                            className="lg:hidden flex items-center gap-2 px-4 py-2 border border-charcoal/20 rounded-full font-sans text-sm"
                        >
                            <SlidersHorizontal className="w-4 h-4" /> Filtros
                        </button>
                    </div>
                </div>

                <div className="flex gap-10">
                    {/* Desktop Sidebar */}
                    <aside className="hidden lg:block w-64 flex-shrink-0">
                        <div className="sticky top-28">
                            <FilterSidebar />
                        </div>
                    </aside>

                    {/* Mobile Sidebar Overlay */}
                    {sidebarOpen && (
                        <div className="fixed inset-0 z-50 flex">
                            <div
                                className="absolute inset-0 bg-charcoal/40 backdrop-blur-sm"
                                onClick={() => setSidebarOpen(false)}
                            />
                            <div className="relative ml-auto w-80 h-full bg-cream shadow-2xl p-8 overflow-y-auto">
                                <button
                                    onClick={() => setSidebarOpen(false)}
                                    className="absolute top-4 right-4 text-charcoal/50 hover:text-charcoal"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                                <h2 className="font-outfit text-xl uppercase tracking-tight text-charcoal mb-8">Filtros</h2>
                                <FilterSidebar />
                            </div>
                        </div>
                    )}

                    {/* Product Grid */}
                    <div className="flex-1">
                        {filtered.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-32 text-charcoal/40">
                                <span className="text-6xl mb-4">🔍</span>
                                <span className="font-outfit text-2xl mb-2">Sin resultados</span>
                                <span className="font-sans text-sm">Prueba con otra combinación de filtros.</span>
                                {hasActiveFilters && (
                                    <button
                                        onClick={() => setFilters(defaultFilters)}
                                        className="mt-6 px-6 py-2 rounded-full bg-moss text-cream font-sans text-sm"
                                    >
                                        Limpiar filtros
                                    </button>
                                )}
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                                {filtered.map(product => (
                                    <div
                                        key={product.id}
                                        className="bg-white rounded-3xl border border-charcoal/5 hover:border-clay/30 hover:shadow-xl transition-all duration-300 flex flex-col overflow-hidden group"
                                    >
                                        {/* Image */}
                                        <Link to={`/producto/${product.slug}`} className="block bg-cream/40 min-h-[200px] flex items-center justify-center p-6">
                                            <ImageSafe
                                                src={getProductImage(product.slug)}
                                                alt={product.name}
                                                className="h-40 w-full mix-blend-multiply group-hover:scale-105 transition-transform duration-500"
                                            />
                                        </Link>

                                        <div className="p-5 flex flex-col flex-1">
                                            {/* Tags */}
                                            <div className="flex flex-wrap gap-1 mb-3">
                                                {product.usageTags.slice(0, 3).map(tag => {
                                                    const match = USAGE_TAGS.find(u => u.id === tag);
                                                    return (
                                                        <span key={tag} className="text-[10px] font-sans uppercase tracking-wider bg-cream text-charcoal/60 px-2 py-0.5 rounded-full border border-charcoal/10">
                                                            {match ? `${match.emoji} ${match.label}` : tag}
                                                        </span>
                                                    );
                                                })}
                                            </div>

                                            {/* Name + Price */}
                                            <div className="flex justify-between items-start gap-2 mb-1">
                                                <h3 className="font-outfit text-base tracking-wide text-charcoal line-clamp-2 flex-1">{product.name}</h3>
                                                <span className="font-metrics text-clay text-sm whitespace-nowrap">
                                                    ${product.variants[0]?.price_cop.toLocaleString('es-CO')}
                                                </span>
                                            </div>

                                            {/* Type */}
                                            <span className="font-sans text-xs text-charcoal/50 mb-3">{product.type}</span>

                                            {/* Color Swatch */}
                                            <div className="flex gap-1.5 mb-4">
                                                <div
                                                    className="w-4 h-4 rounded-full border border-charcoal/10 shadow-sm"
                                                    style={{ backgroundColor: MAIN_COLORS.find(c => c.id === product.mainColor)?.hex || '#ccc' }}
                                                    title={product.mainColor}
                                                />
                                            </div>

                                            <button
                                                onClick={() => addToCart(product, product.variants[0], 1)}
                                                className="mt-auto w-full py-2.5 rounded-full border border-moss text-moss font-sans text-sm font-semibold hover:bg-moss hover:text-cream transition-colors"
                                            >
                                                Añadir al Carrito
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Removed Quiz CTA */}
                    </div>
                </div>
            </div>
        </div>
    );
}
