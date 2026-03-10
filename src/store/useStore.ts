import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Product } from '../data/products';
import { staticProducts } from '../data/products';

export interface CartItem {
    id: string; // Unique ID for cart item (product_id + size)
    product: Product;
    selectedVariant: Pick<Product['variants'][0], 'size' | 'price_cop'>;
    quantity: number;
}

interface StoreState {
    // Products
    products: Product[];
    isLoading: boolean;
    fetchProducts: () => Promise<void>;
    filterProducts: (category: string | null) => Product[];

    // Cart
    cart: CartItem[];
    isCartOpen: boolean;
    toggleCart: () => void;
    addToCart: (product: Product, selectedVariant: Pick<Product['variants'][0], 'size' | 'price_cop'>, quantity?: number) => void;
    removeFromCart: (cartItemId: string) => void;
    updateQuantity: (cartItemId: string, quantity: number) => void;
    clearCart: () => void;
    getCartTotal: () => number;
}

export const useStore = create<StoreState>()(
    persist(
        (set, get) => ({
            // --- Products State ---
            products: [],
            isLoading: true,

            fetchProducts: async () => {
                set({ isLoading: true });
                // Simulate network delay to fetch products
                await new Promise(resolve => setTimeout(resolve, 800));
                set({ products: staticProducts, isLoading: false });
            },

            filterProducts: (category) => {
                const { products } = get();
                return products.filter(product => {
                    return category ? product.category === category : true;
                });
            },

            // --- Cart State ---
            cart: [],
            isCartOpen: false,

            toggleCart: () => set((state) => ({ isCartOpen: !state.isCartOpen })),

            addToCart: (product, selectedVariant, quantity = 1) => {
                set((state) => {
                    const cartItemId = `${product.id}-${selectedVariant.size}`;
                    const existingItem = state.cart.find(item => item.id === cartItemId);

                    if (existingItem) {
                        return {
                            cart: state.cart.map(item =>
                                item.id === cartItemId
                                    ? { ...item, quantity: item.quantity + quantity }
                                    : item
                            ),
                            isCartOpen: true // Auto open cart on add
                        };
                    }

                    return {
                        cart: [...state.cart, { id: cartItemId, product, selectedVariant, quantity }],
                        isCartOpen: true
                    };
                });
            },

            removeFromCart: (cartItemId) => {
                set((state) => ({
                    cart: state.cart.filter(item => item.id !== cartItemId)
                }));
            },

            updateQuantity: (cartItemId, quantity) => {
                if (quantity < 1) return;
                set((state) => ({
                    cart: state.cart.map(item =>
                        item.id === cartItemId ? { ...item, quantity } : item
                    )
                }));
            },

            clearCart: () => set({ cart: [] }),

            getCartTotal: () => {
                return get().cart.reduce((total, item) => total + (item.selectedVariant.price_cop * item.quantity), 0);
            }
        }),
        {
            name: 'stanley-cart-storage', // clave en localStorage
            partialize: (state) => ({ cart: state.cart }), // solo persistir el carrito, no productos ni UI state
        }
    )
);
