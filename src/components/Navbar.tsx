import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import gsap from 'gsap';
import { ShoppingBag, Search, Menu, X, ArrowRight } from 'lucide-react';
import { useStore } from '../store/useStore';
import { getProductImage } from '../data/products';

export default function Navbar() {
    const [isScrolled, setIsScrolled] = useState(false);
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedQuery, setDebouncedQuery] = useState('');

    const navRef = useRef<HTMLElement>(null);
    const searchModalRef = useRef<HTMLDivElement>(null);
    const { pathname } = useLocation();
    const navigate = useNavigate();

    const { cart, toggleCart, products, fetchProducts, isLoading } = useStore();
    const cartItemsCount = cart.reduce((acc, item) => acc + item.quantity, 0);

    const isHome = pathname === '/';

    // Fetch products for search index if not already loaded
    useEffect(() => {
        if (products.length === 0) fetchProducts();
    }, [products.length, fetchProducts]);

    // Handle Navbar Scroll
    useEffect(() => {
        const handleScroll = () => {
            const scrollPosition = window.scrollY;
            if (scrollPosition > 50 && !isScrolled) setIsScrolled(true);
            else if (scrollPosition <= 50 && isScrolled) setIsScrolled(false);
        };

        // Always style inner pages
        if (isHome) {
            window.addEventListener('scroll', handleScroll);
            return () => window.removeEventListener('scroll', handleScroll);
        } else {
            setIsScrolled(true);
        }
    }, [isScrolled, isHome]);

    // GSAP Navbar styles
    useEffect(() => {
        const ctx = gsap.context(() => {
            if (isScrolled || isSearchOpen) {
                gsap.to(navRef.current, {
                    backgroundColor: 'rgba(242, 240, 233, 0.95)',
                    backdropFilter: 'blur(12px)',
                    color: '#2E4036',
                    borderColor: 'rgba(26, 26, 26, 0.1)',
                    duration: 0.4,
                    ease: 'power2.out',
                });
            } else {
                gsap.to(navRef.current, {
                    backgroundColor: 'transparent',
                    backdropFilter: 'blur(0px)',
                    color: '#F2F0E9',
                    borderColor: 'transparent',
                    duration: 0.4,
                    ease: 'power2.out',
                });
            }
        });
        return () => ctx.revert();
    }, [isScrolled, isSearchOpen]);

    // Search Debounce (300ms)
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedQuery(searchQuery);
        }, 300);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    // Intent-based search map (occasion → product names)
    const intentMap: Record<string, string[]> = {
        gym: ["Stanley IceFlow Flip Straw Tumbler 2.0"],
        cafe: ["Stanley Wellspring Bottle"],
        correr: ["Stanley IceFlow Flip Straw Tumbler 2.0"],
        oficina: ["Stanley Quencher ProTour", "Stanley Wellspring Bottle"],
        montaña: ["Stanley Wellspring Bottle"],
        regalo: ["Stanley Quencher ProTour", "Stanley Classic Flask Easy Fill"],
        comida: ["Stanley Adventure All-in-One Food Jar"]
    };

    // Detect user intent from query
    const detectIntent = (query: string): string | null => {
        const normalized = query.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        for (const keyword of Object.keys(intentMap)) {
            const normalizedKey = keyword.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            if (normalized.includes(normalizedKey)) return keyword;
        }
        return null;
    };

    const detectedIntent = debouncedQuery ? detectIntent(debouncedQuery) : null;

    // Products for the detected intent
    const intentProducts = detectedIntent
        ? (intentMap[detectedIntent] || []).map(name => products.find(p => p.name === name)).filter(Boolean)
        : [];

    // Regular text search (name, category, description)
    const searchResults = products.filter(p => {
        const q = debouncedQuery.toLowerCase();
        if (!q) return false;
        return (
            p.name.toLowerCase().includes(q) ||
            p.category.toLowerCase().includes(q) ||
            p.description.toLowerCase().includes(q)
        );
    });

    const handleSearchKeyDown = (e: React.KeyboardEvent) => {
        const firstResult = intentProducts[0] || searchResults[0];
        if (e.key === 'Enter' && firstResult) {
            closeSearch();
            navigate(`/producto/${firstResult!.slug}`);
        }
    };

    const closeSearch = () => {
        setIsSearchOpen(false);
        setSearchQuery('');
        setDebouncedQuery('');
    };

    return (
        <div className="fixed top-0 left-0 w-full z-50 pointer-events-none">

            {/* Main Navbar */}
            <div className="flex justify-center pt-6 px-4">
                <nav
                    ref={navRef}
                    className={`pointer-events-auto flex items-center justify-between px-8 py-4 w-full max-w-7xl clip-pill border border-transparent transition-all relative z-50 ${isHome && !isScrolled && !isSearchOpen ? 'bg-transparent absolute' : ''}`}
                >
                    {/* Logo */}
                    <Link to="/" onClick={closeSearch} className="flex-1 font-outfit font-bold tracking-widest text-2xl uppercase hover:opacity-80 transition-opacity">
                        Stanley
                    </Link>

                    {/* Links (Desktop) */}
                    <div className="hidden md:flex items-center justify-center gap-8 flex-1 font-sans text-sm font-medium tracking-wide">
                        <Link to="/shop" className="hover:opacity-70 transition-opacity">Shop</Link>
                        <Link to="/opiniones" className="hover:opacity-70 transition-opacity">Opiniones</Link>
                        <Link to="/historia" className="hover:opacity-70 transition-opacity">Historia</Link>
                        <Link to="/personalizacion" className="hover:opacity-70 transition-opacity flex items-center gap-1">
                            Personalización <span className="w-1.5 h-1.5 rounded-full bg-clay animate-pulse" />
                        </Link>
                    </div>

                    {/* CTA & Icons */}
                    <div className="flex items-center justify-end gap-6 flex-1 text-inherit">
                        <Link to="/descubre-tu-stanley" className="hidden lg:flex font-sans text-sm font-medium tracking-wide px-5 py-2 clip-pill bg-clay text-cream hover:bg-opacity-90 transition-colors cursor-pointer">
                            Descubre tu Stanley
                        </Link>

                        {/* Search Icon */}
                        <button
                            onClick={() => setIsSearchOpen(!isSearchOpen)}
                            className="hover:opacity-70 cursor-pointer transition-opacity"
                        >
                            {isSearchOpen ? <X size={20} /> : <Search size={20} />}
                        </button>

                        {/* Cart Icon */}
                        <button
                            onClick={toggleCart}
                            className="relative hover:opacity-70 cursor-pointer transition-opacity"
                        >
                            <ShoppingBag size={20} />
                            {cartItemsCount > 0 && (
                                <span className="absolute -top-2 -right-2 bg-clay text-cream text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                                    {cartItemsCount}
                                </span>
                            )}
                        </button>

                        <Menu size={24} className="md:hidden hover:opacity-70 cursor-pointer transition-opacity" />
                    </div>
                </nav>
            </div>

            {/* Search Dropdown Modal */}
            {isSearchOpen && (
                <div
                    ref={searchModalRef}
                    className="absolute top-0 left-0 w-full bg-cream/95 backdrop-blur-xl border-b border-charcoal/10 shadow-2xl pt-32 pb-12 px-8 min-h-[50vh] flex flex-col items-center z-40 pointer-events-auto"
                >
                    <div className="w-full max-w-3xl relative">
                        <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-charcoal/40" size={24} />
                        <input
                            autoFocus
                            type="text"
                            placeholder="Buscar termos, colores, usos..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onKeyDown={handleSearchKeyDown}
                            className="w-full bg-white border border-charcoal/20 rounded-full py-5 pl-16 pr-6 text-xl text-charcoal outline-none focus:border-moss/50 focus:ring-4 focus:ring-moss/10 transition-all font-sans"
                        />
                        {searchQuery && (
                            <button onClick={closeSearch} className="absolute right-6 top-1/2 -translate-y-1/2 bg-charcoal/5 p-1 rounded-full text-charcoal/50 hover:bg-charcoal/10 hover:text-charcoal transition-colors">
                                <X size={16} />
                            </button>
                        )}
                    </div>

                    {/* Results Container */}
                    <div className="w-full max-w-3xl mt-8">
                        {debouncedQuery === '' ? (
                            <div className="text-center text-charcoal/50 py-12">
                                <span className="block font-outfit uppercase tracking-widest text-sm mb-4">Busca por ocasión</span>
                                <div className="flex flex-wrap justify-center gap-3">
                                    {["para el gym", "para tomar café", "para la montaña", "para regalo", "para oficina", "para correr"].map(term => (
                                        <button
                                            key={term}
                                            onClick={() => setSearchQuery(term)}
                                            className="px-4 py-2 rounded-full border border-charcoal/20 hover:border-moss hover:bg-moss/5 text-sm transition-colors text-charcoal/70"
                                        >
                                            {term}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ) : isLoading ? (
                            <div className="text-center py-12 text-charcoal/50">Cargando catálogo...</div>
                        ) : (intentProducts.length > 0 || searchResults.length > 0) ? (
                            <div className="w-full space-y-8">
                                {/* Intent-Based Recommendations */}
                                {intentProducts.length > 0 && (
                                    <div>
                                        <div className="flex items-center gap-3 mb-4">
                                            <span className="flex-shrink-0 px-3 py-1 bg-moss/10 text-moss text-xs font-outfit tracking-widest uppercase rounded-full border border-moss/20">
                                                ✦ Recomendado para tu ocasión
                                            </span>
                                            <div className="flex-1 h-px bg-charcoal/10" />
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {intentProducts.map(product => product && (
                                                <Link
                                                    key={product.id}
                                                    to={`/producto/${product.slug}`}
                                                    onClick={closeSearch}
                                                    className="flex items-center gap-4 p-4 rounded-2xl bg-moss/5 border border-moss/20 hover:border-moss/50 hover:shadow-lg transition-all group"
                                                >
                                                    <div className="w-16 h-16 bg-cream rounded-xl p-2 shrink-0">
                                                        <img src={getProductImage(product.slug)} alt={product.name} className="w-full h-full object-contain mix-blend-multiply group-hover:scale-110 transition-transform" />
                                                    </div>
                                                    <div className="flex-1">
                                                        <h4 className="font-sans font-semibold text-charcoal truncate">{product.name}</h4>
                                                        <p className="font-outfit uppercase text-xs tracking-widest text-charcoal/50 mt-1">{product.category}</p>
                                                    </div>
                                                    <ArrowRight size={18} className="text-moss opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all" />
                                                </Link>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Regular Results */}
                                {searchResults.length > 0 && (
                                    <div>
                                        <div className="flex items-center gap-3 mb-4">
                                            <span className="text-charcoal/40 text-xs font-sans">{searchResults.length} resultado{searchResults.length !== 1 ? 's' : ''} por nombre</span>
                                            <div className="flex-1 h-px bg-charcoal/10" />
                                            <span className="font-sans text-charcoal/30 text-xs flex items-center gap-1">Enter <span className="px-1.5 py-0.5 bg-charcoal/5 rounded font-mono">↵</span></span>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[40vh] overflow-y-auto pr-2">
                                            {searchResults.map(product => (
                                                <Link
                                                    key={product.id}
                                                    to={`/producto/${product.slug}`}
                                                    onClick={closeSearch}
                                                    className="flex items-center gap-4 p-4 rounded-2xl bg-white border border-charcoal/5 hover:border-moss/30 hover:shadow-lg transition-all group"
                                                >
                                                    <div className="w-14 h-14 bg-cream rounded-xl p-2 shrink-0">
                                                        <img src={getProductImage(product.slug)} alt={product.name} className="w-full h-full object-contain mix-blend-multiply group-hover:scale-110 transition-transform" />
                                                    </div>
                                                    <div className="flex-1">
                                                        <h4 className="font-sans font-semibold text-charcoal truncate">{product.name}</h4>
                                                        <p className="font-outfit uppercase text-xs tracking-widest text-charcoal/50 mt-1">{product.category}</p>
                                                    </div>
                                                    <ArrowRight size={18} className="text-moss opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all" />
                                                </Link>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="text-center text-charcoal/50 py-16">
                                <Search size={48} className="mx-auto text-charcoal/20 mb-4" />
                                <p className="font-sans text-lg">Sin resultados para tu búsqueda: <span className="font-semibold">"{debouncedQuery}"</span></p>
                                <p className="text-sm mt-2 text-charcoal/40">Intenta buscar por una ocasión, color o uso.</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

