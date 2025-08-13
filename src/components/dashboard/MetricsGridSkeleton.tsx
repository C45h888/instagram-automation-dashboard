interface SkeletonCardProps {
  style?: React.CSSProperties;
}

// Then fix the component usage:
{Array.from({ length: 6 }).map((_, index) => (
  <SkeletonCard
    key={index}
    style={{ animationDelay: `${index * 100}ms` }}
  />
))}