import { imageVariants } from "@/lib/assets";

/**
 * Raw <img> wrapper that emits a WebP srcset using the backend's variant
 * convention. Use for images that are not rendered through next/image.
 */
export default function SmartImage({
  src,
  alt,
  className,
  sizes,
  loading = "lazy",
  decoding = "async",
}: {
  src?: string | null;
  alt: string;
  className?: string;
  sizes?: string;
  loading?: "lazy" | "eager";
  decoding?: "sync" | "async" | "auto";
}) {
  if (!src) return null;
  const { src: resolved, srcSet } = imageVariants(src);
  return (
    <img
      src={resolved}
      srcSet={srcSet}
      sizes={srcSet ? sizes : undefined}
      alt={alt}
      loading={loading}
      decoding={decoding}
      className={className}
    />
  );
}
