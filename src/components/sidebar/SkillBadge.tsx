import { useEffect, useRef, useState, useCallback } from "react";
import { Badge } from "@/components/ui/badge";

export function SkillBadges({ skills }: { skills: string[] }) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState(skills.length);

  const measure = useCallback(() => {
    const ruler = measureRef.current;
    if (!ruler) return;

    // Measure against the hidden ruler which always contains ALL badges
    const children = Array.from(ruler.children) as HTMLElement[];
    if (children.length === 0) return;

    const top = children[0].offsetTop;
    let fits = children.length;
    for (let i = 1; i < children.length; i++) {
      if (children[i].offsetTop > top) {
        // The "+N" badge is always the last child in the ruler.
        // If the overflow badge itself is on the first row, we can show (i-1) real badges.
        // Otherwise trim one more to make room for overflow.
        fits = Math.max(1, i - 1);
        break;
      }
    }

    setVisibleCount(fits);
  }, []);

  useEffect(() => {
    // Observe the WRAPPER (whose width is determined by the parent layout),
    // NOT the visible badge container (whose size changes with visibleCount).
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(wrapper);
    return () => observer.disconnect();
  }, [skills, measure]);

  const overflow = skills.length - visibleCount;

  return (
    <div ref={wrapperRef} className="relative overflow-hidden max-h-[20px]">
      {/* Hidden ruler — always renders ALL badges + a fake overflow badge.
          Positioned off-screen so it never paints, but still participates in layout measurement.
          Its content never changes when visibleCount changes, so no feedback loop. */}
      <div
        ref={measureRef}
        aria-hidden
        className="flex flex-wrap gap-1 absolute top-0 left-0 right-0 invisible pointer-events-none"
      >
        {skills.map((skill) => (
          <Badge
            key={skill}
            variant="outline"
            className="text-[10px] px-1.5 py-0 h-[18px] font-normal whitespace-nowrap"
          >
            {skill}
          </Badge>
        ))}
        {/* Fake overflow badge so we always reserve space for it */}
        <Badge
          variant="outline"
          className="text-[10px] px-1.5 py-0 h-[18px] font-normal whitespace-nowrap"
        >
          +{skills.length}
        </Badge>
      </div>

      {/* Visible badges */}
      <div className="flex flex-wrap gap-1">
        {skills.slice(0, visibleCount).map((skill) => (
          <Badge
            key={skill}
            variant="outline"
            className="text-[10px] px-1.5 py-0 h-[18px] font-normal text-foreground/70 border-foreground/20"
          >
            {skill}
          </Badge>
        ))}
        {overflow > 0 && (
          <Badge
            variant="outline"
            className="text-[10px] px-1.5 py-0 h-[18px] font-normal text-muted-foreground"
            title={skills.slice(visibleCount).join(", ")}
          >
            +{overflow}
          </Badge>
        )}
      </div>
    </div>
  );
}
