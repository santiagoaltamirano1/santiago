export interface ProductVariant {
    size: string;
    price_cop: number;
}

export interface Product {
    id: string;
    slug: string;
    name: string;
    category: string;
    description: string;
    variants: ProductVariant[];
    colors_available: string;
    colorSwatches: string[];
    mainColor: "negro" | "verde" | "azul" | "blanco" | "acero" | "beige";
    material: string;
    type: string;
    usageTags: string[];
    featured?: boolean;
    bestseller?: boolean;
}

export const staticProducts: Product[] = [
    {
        id: "stanley-001",
        slug: "wellspring-bottle",
        name: "Stanley Wellspring Bottle",
        category: "hidratacion",
        description: "Botella térmica clásica con aislamiento al vacío para mantener bebidas frías o calientes por horas.",
        variants: [
            { size: "16oz", price_cop: 160000 },
            { size: "24oz", price_cop: 170000 }
        ],
        colors_available: "Varía según tamaño",
        colorSwatches: ["#2E5D4B", "#5C4033", "#E8E2D5", "#8B9D77"],
        mainColor: "negro",
        material: "Acero inoxidable 18/8",
        type: "Botella térmica",
        usageTags: ["montaña", "oficina", "outdoor"],
        featured: false
    },
    {
        id: "stanley-002",
        slug: "quencher-protour",
        name: "Stanley Quencher ProTour",
        category: "hidratacion",
        description: "Tumbler térmico icónico con mango ergonómico y pitillo integrado. Ideal para uso diario y alto consumo de agua.",
        variants: [
            { size: "20oz", price_cop: 198000 },
            { size: "30oz", price_cop: 208000 },
            { size: "40oz", price_cop: 218000 }
        ],
        colors_available: "Múltiples colores",
        colorSwatches: ["#1D3D2F", "#C2825A", "#A8B5A2", "#F2EFE4", "#4A6FA5"],
        mainColor: "verde",
        material: "Acero inoxidable con aislamiento al vacío",
        type: "Tumbler térmico",
        usageTags: ["gym", "oficina", "diario"],
        featured: true,
        bestseller: true
    },
    {
        id: "stanley-003",
        slug: "iceflow-flip-straw-tumbler-2",
        name: "Stanley IceFlow Flip Straw Tumbler 2.0",
        category: "hidratacion",
        description: "Tumbler deportivo con tapa Flip Straw para hidratación rápida y segura.",
        variants: [
            { size: "24oz", price_cop: 189000 },
            { size: "30oz", price_cop: 199000 }
        ],
        colors_available: "Colores deportivos",
        colorSwatches: ["#1A5276", "#117A65", "#E74C3C", "#F39C12"],
        mainColor: "azul",
        material: "Acero inoxidable",
        type: "Tumbler deportivo",
        usageTags: ["gym", "outdoor", "correr"],
        featured: false
    },
    {
        id: "stanley-004",
        slug: "classic-flask-easy-fill",
        name: "Stanley Classic Flask Easy Fill",
        category: "bar",
        description: "Licorera térmica compacta con boca ancha para llenado fácil.",
        variants: [
            { size: "8oz", price_cop: 127000 }
        ],
        colors_available: "Acero clásico",
        colorSwatches: ["#AAA9A9", "#2C3E50", "#1A1A1A"],
        mainColor: "acero",
        material: "Acero inoxidable",
        type: "Licorera",
        usageTags: ["regalo", "bar", "evento", "viaje"],
        featured: false
    },
    {
        id: "stanley-005",
        slug: "adventure-all-in-one-food-jar",
        name: "Stanley Adventure All-in-One Food Jar",
        category: "comida",
        description: "Tarro térmico para alimentos con cuchara integrada. Mantiene comida caliente o fría por horas.",
        variants: [
            { size: "18oz", price_cop: 176000 }
        ],
        colors_available: "Varía por temporada",
        colorSwatches: ["#2E5D4B", "#8B4513", "#4A4A4A", "#E8E2D5"],
        mainColor: "verde",
        material: "Acero inoxidable con aislamiento térmico",
        type: "Termo para comida",
        usageTags: ["comida", "oficina", "viaje"],
        featured: false
    }
];

// Helper to get image paths dynamically based on generated images
export const getProductImage = (slug: string) => {
    switch (slug) {
        case 'quencher-protour':
            return '/images/products/bestseller_quencher.webp';
        case 'wellspring-bottle':
            return '/images/products/wellspring_bottle.webp';
        case 'iceflow-flip-straw-tumbler-2':
            return '/images/products/iceflow_flip_straw.webp';
        case 'classic-flask-easy-fill':
            return '/images/products/classic_flask.webp';
        case 'adventure-all-in-one-food-jar':
            return '/images/products/food_jar.webp';
        default:
            return `/images/fallback.webp`;
    }
};
