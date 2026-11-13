import { useState, useEffect } from 'react';
import { Disc3 } from 'lucide-react';

interface TrackArtworkProps {
  src?: string;
  alt: string;
  className?: string;
  imgClassName?: string;
  iconClassName?: string;
}

export function TrackArtwork({
  src,
  alt,
  className = '',
  imgClassName = '',
  iconClassName = 'w-5 h-5',
}: TrackArtworkProps) {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [src]);

  if (!src || hasError) {
    return (
      <div
        className={`flex items-center justify-center bg-[var(--fm-glass)] text-[var(--fm-accent)] ${className}`}
        aria-label={alt}
      >
        <Disc3 className={iconClassName} />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setHasError(true)}
      className={`object-cover ${imgClassName || 'w-full h-full'} ${className}`}
    />
  );
}
