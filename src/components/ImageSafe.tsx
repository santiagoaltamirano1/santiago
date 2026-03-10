import { useState } from "react";

interface ImageSafeProps extends React.ImgHTMLAttributes<HTMLImageElement> {
    src: string;
    alt: string;
    className?: string;
}

export default function ImageSafe({ src, alt, className = "", ...props }: ImageSafeProps) {
    const [hasError, setHasError] = useState(false);
    const [isLoaded, setIsLoaded] = useState(false);

    /**
     * Fallback rules: 
     * 1. Check if src exists, otherwise return fallback
     * 2. Replace the source with Universal fallback if an error triggers
     * 3. Hide skeleton until images are fully parsed by browser
     */
    const activeSrc = hasError || !src ? "/images/fallback.webp" : src;

    return (
        <div className={`relative flex items-center justify-center overflow-hidden ${className}`}>
            {!isLoaded && (
                <div className="absolute inset-0 bg-charcoal/5 animate-pulse rounded-xl" />
            )}

            <img
                src={activeSrc}
                alt={alt}
                onError={() => setHasError(true)}
                onLoad={() => setIsLoaded(true)}
                loading="lazy"
                {...props}
                className={`w-full max-h-full object-contain transition-opacity duration-300 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
            />
        </div>
    );
}
